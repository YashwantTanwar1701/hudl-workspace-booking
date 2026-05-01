'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Eye, Calendar, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import ShiftPicker from '../components/ShiftPicker'
import { getCurrentTimeSlot, getDefaultEndTime } from '../types'
import type { Seat, Booking } from '../types'

/* ───────────────────────────────────────────────────────────────
   Lane spec — single source of truth for the row × column layout.
   colsRows[i] = number of rows in column (i+1).
   readFromBottom = true → row 1 sits at the BOTTOM of the lane;
   higher row numbers are stacked upward.
   excludeCells (optional) = list of {col, row} cells to skip even
   though colsRows would otherwise include them.
   colGaps / rowGaps = positions AFTER which to insert an aisle.
   ─────────────────────────────────────────────────────────────── */
type LaneGroup = 'top-left' | 'top-hr' | 'top-th' | 'cafeteria' | 'training' | 'rooms' | 'booth'

type LaneSpec = {
  id: string
  prefix: string
  title: string
  subtitle: string
  icon: string                     // emoji OR raw SVG markup string
  iconIsSvg?: boolean              // hint: render with dangerouslySetInnerHTML
  sectionId: string                // matches FLOOR_SECTIONS.id
  cols: number
  colsRows: number[]
  readFromBottom: boolean
  bgColor: string
  accentColor: string
  excludeCells?: { col: number; row: number }[]
  colGaps?: number[]
  rowGaps?: number[]
  group: LaneGroup
}

const SERVER_ROWS = Array(6).fill(24)

const TH_ROWS: number[] = (() => {
  const arr: number[] = []
  for (let c = 1; c <= 20; c++) {
    if (c === 1) arr.push(7)
    else if ([2, 3, 4, 15, 16, 17, 18, 19, 20].includes(c)) arr.push(8)
    else if ([5, 6].includes(c)) arr.push(7)
    else arr.push(6)
  }
  return arr
})()

const HR_ROWS: number[] = (() => {
  const arr: number[] = []
  for (let c = 1; c <= 20; c++) {
    if ([1, 2, 3, 4, 15, 16, 17, 18, 19, 20].includes(c)) arr.push(7)
    else if ([5, 6].includes(c)) arr.push(6)
    else arr.push(5)
  }
  return arr
})()

const WELLNESS_BED_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>'

const LANES: LaneSpec[] = [
  /* ── Top L-section: Server (left, full height) ── */
  {
    id: 'server',
    prefix: 'SRL',
    title: 'Server Room Lane',
    subtitle: '6 columns × 24 rows · 144 seats · paired rows',
    icon: '🖥️',
    sectionId: 'server-room-lane',
    cols: 6,
    colsRows: SERVER_ROWS,
    readFromBottom: false,
    rowGaps: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
    bgColor: '#EDE7F6',
    accentColor: '#7B1FA2',
    group: 'top-left',
  },
  /* ── Top right top: HR/OPS ── */
  {
    id: 'hr',
    prefix: 'HRL',
    title: 'HR / OPS Lane',
    subtitle: '20 columns · variable rows · 122 seats · 2-col bands',
    icon: '💼',
    sectionId: 'hr-it-lane',
    cols: 20,
    colsRows: HR_ROWS,
    readFromBottom: false,
    colGaps: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    bgColor: '#E8F5E9',
    accentColor: '#2E7D32',
    group: 'top-hr',
  },
  /* ── Top right bottom: Town Hall ── */
  {
    id: 'th',
    prefix: 'THL',
    title: 'Town Hall Lane',
    subtitle: '20 columns · variable rows (read bottom-up) · 141 seats · 2-col bands',
    icon: '🏢',
    sectionId: 'town-hall-lane',
    cols: 20,
    colsRows: TH_ROWS,
    readFromBottom: true,
    colGaps: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    bgColor: '#E3F2FD',
    accentColor: '#1565C0',
    group: 'top-th',
  },
  /* ── Cafeteria full width ── */
  {
    id: 'cafeteria',
    prefix: 'CAF',
    title: 'Cafeteria Zone',
    subtitle: '10 columns × 10 rows · Col 5 R2/R3 missing · 98 seats',
    icon: '☕',
    sectionId: 'cafeteria-zone',
    cols: 10,
    colsRows: Array(10).fill(10),
    readFromBottom: false,
    excludeCells: [
      { col: 5, row: 2 },
      { col: 5, row: 3 },
    ],
    colGaps: [4],
    rowGaps: [2, 4, 6, 8],
    bgColor: '#FBE9E7',
    accentColor: '#795548',
    group: 'cafeteria',
  },
  /* ── Training rooms grouped ── */
  {
    id: 'training1',
    prefix: 'TR1',
    title: 'Training Room 1',
    subtitle: '4 columns × 5 rows · 20 seats',
    icon: '📚',
    sectionId: 'training-room-1',
    cols: 4,
    colsRows: Array(4).fill(5),
    readFromBottom: false,
    colGaps: [1, 3],
    bgColor: '#FFF8E1',
    accentColor: '#FF9800',
    group: 'training',
  },
  {
    id: 'training2',
    prefix: 'TR2',
    title: 'Training Room 2',
    subtitle: '6 columns × 4 rows · 24 seats',
    icon: '📚',
    sectionId: 'training-room-2',
    cols: 6,
    colsRows: Array(6).fill(4),
    readFromBottom: false,
    rowGaps: [1, 3],
    colGaps: [3],
    bgColor: '#FFF3E0',
    accentColor: '#FF5722',
    group: 'training',
  },
  {
    id: 'training3',
    prefix: 'TR3',
    title: 'Training Room 3',
    subtitle: '6 columns × 4 rows · 24 seats',
    icon: '📚',
    sectionId: 'training-room-3',
    cols: 6,
    colsRows: Array(6).fill(4),
    readFromBottom: false,
    rowGaps: [1, 3],
    colGaps: [3],
    bgColor: '#FBE9E7',
    accentColor: '#BF360C',
    group: 'training',
  },
  /* ── Other Rooms ── */
  {
    id: 'product',
    prefix: 'PT',
    title: 'Product Team Room',
    subtitle: '5 cols · bottom-row 5 + top-row 3 (Cols 3-5) · 8 seats',
    icon: '🚀',
    sectionId: 'product-team',
    cols: 5,
    colsRows: [1, 1, 2, 2, 2],
    readFromBottom: true,
    rowGaps: [1],
    bgColor: '#E8F5E9',
    accentColor: '#4CAF50',
    group: 'rooms',
  },
  {
    id: 'conf12',
    prefix: 'C12',
    title: '12 PAX Conference Room',
    subtitle: '3 cols × 7 rows · Col 2 only R1+R7, Cols 1&3 only R2-R6 · 12 seats',
    icon: '🏛️',
    sectionId: 'conference-12pax',
    cols: 3,
    colsRows: [7, 7, 7],
    readFromBottom: false,
    excludeCells: [
      // Col 1: R1, R7 missing
      { col: 1, row: 1 },
      { col: 1, row: 7 },
      // Col 2: R2-R6 missing (only R1 and R7 have seats)
      { col: 2, row: 2 },
      { col: 2, row: 3 },
      { col: 2, row: 4 },
      { col: 2, row: 5 },
      { col: 2, row: 6 },
      // Col 3: R1, R7 missing
      { col: 3, row: 1 },
      { col: 3, row: 7 },
    ],
    bgColor: '#E8EAF6',
    accentColor: '#3F51B5',
    group: 'rooms',
  },
  {
    id: 'hritroom',
    prefix: 'HRR',
    title: 'HR / IT Room',
    subtitle: '3 cols · Cols 1-2 = 3 rows, Col 3 = 4 rows · 10 seats',
    icon: '⚙️',
    sectionId: 'hr-ops-it',
    cols: 3,
    colsRows: [3, 3, 4],
    readFromBottom: false,
    colGaps: [2],
    bgColor: '#F3E5F5',
    accentColor: '#9C27B0',
    group: 'rooms',
  },
  {
    id: 'wellness',
    prefix: 'WEL',
    title: 'Wellness Room',
    subtitle: '1 seat · Relaxation space',
    icon: WELLNESS_BED_SVG,
    iconIsSvg: true,
    sectionId: 'wellness-room',
    cols: 1,
    colsRows: [1],
    readFromBottom: false,
    bgColor: '#FCE4EC',
    accentColor: '#E91E63',
    group: 'rooms',
  },
  /* ── Meeting & Phone Booths ── */
  {
    id: 'mtg4_1',
    prefix: 'M4A',
    title: '4 PAX Meeting Room - 1',
    subtitle: '2 cols × 2 rows · 4 seats',
    icon: '🤝',
    sectionId: 'meeting-4pax-1',
    cols: 2,
    colsRows: [2, 2],
    readFromBottom: false,
    bgColor: '#FCE4EC',
    accentColor: '#C62828',
    group: 'booth',
  },
  {
    id: 'mtg4_2',
    prefix: 'M4B',
    title: '4 PAX Meeting Room - 2',
    subtitle: '2 cols × 2 rows · 4 seats',
    icon: '🤝',
    sectionId: 'meeting-4pax-2',
    cols: 2,
    colsRows: [2, 2],
    readFromBottom: false,
    bgColor: '#FBE9E7',
    accentColor: '#FF7043',
    group: 'booth',
  },
  {
    id: 'booth2_1',
    prefix: 'B2A',
    title: '2 PAX Phone Booth - 1',
    subtitle: '2 cols × 1 row · 2 seats',
    icon: '📟',
    sectionId: 'phone-booth-2s-1',
    cols: 2,
    colsRows: [1, 1],
    readFromBottom: false,
    bgColor: '#F1F8E9',
    accentColor: '#558B2F',
    group: 'booth',
  },
  {
    id: 'booth2_2',
    prefix: 'B2B',
    title: '2 PAX Phone Booth - 2',
    subtitle: '2 cols × 1 row · 2 seats',
    icon: '📟',
    sectionId: 'phone-booth-2s-2',
    cols: 2,
    colsRows: [1, 1],
    readFromBottom: false,
    bgColor: '#F1F8E9',
    accentColor: '#558B2F',
    group: 'booth',
  },
  {
    id: 'booth2_3',
    prefix: 'B2C',
    title: '2 PAX Phone Booth - 3',
    subtitle: '2 cols × 1 row · 2 seats',
    icon: '📟',
    sectionId: 'phone-booth-2s-3',
    cols: 2,
    colsRows: [1, 1],
    readFromBottom: false,
    bgColor: '#F1F8E9',
    accentColor: '#558B2F',
    group: 'booth',
  },
  {
    id: 'booth1_1',
    prefix: 'B1A',
    title: '1 PAX Phone Booth - 1',
    subtitle: '1 col × 1 row · 1 seat',
    icon: '📞',
    sectionId: 'phone-booth-1s-1',
    cols: 1,
    colsRows: [1],
    readFromBottom: false,
    bgColor: '#E8F5E9',
    accentColor: '#388E3C',
    group: 'booth',
  },
  {
    id: 'booth1_2',
    prefix: 'B1B',
    title: '1 PAX Phone Booth - 2',
    subtitle: '1 col × 1 row · 1 seat',
    icon: '📞',
    sectionId: 'phone-booth-1s-2',
    cols: 1,
    colsRows: [1],
    readFromBottom: false,
    bgColor: '#E8F5E9',
    accentColor: '#388E3C',
    group: 'booth',
  },
  {
    id: 'booth1_3',
    prefix: 'B1C',
    title: '1 PAX Phone Booth - 3',
    subtitle: '1 col × 1 row · 1 seat',
    icon: '📞',
    sectionId: 'phone-booth-1s-3',
    cols: 1,
    colsRows: [1],
    readFromBottom: false,
    bgColor: '#E8F5E9',
    accentColor: '#388E3C',
    group: 'booth',
  },
]

const BIG_GROUPS: LaneGroup[] = ['top-left', 'top-hr', 'top-th', 'cafeteria']

/* ───────── Cell descriptor ───────── */
type Cell =
  | { kind: 'seat'; col: number; row: number; visualRow: number; id: string; dbSeat?: Seat }
  | { kind: 'empty'; col: number; visualRow: number }
  | { kind: 'col-header'; col: number }
  | { kind: 'row-header'; visualRow: number; row: number }
  | { kind: 'corner' }

function buildCells(lane: LaneSpec, dbSeatsForLane: Seat[]): { cells: Cell[]; maxRows: number; seatCount: number } {
  const maxRows = Math.max(...lane.colsRows)
  const cells: Cell[] = []
  const excludedKey = (col: number, row: number) => `${col}:${row}`
  const excluded = new Set(
    (lane.excludeCells || []).map(c => excludedKey(c.col, c.row))
  )

  cells.push({ kind: 'corner' })

  for (let c = 1; c <= lane.cols; c++) {
    cells.push({ kind: 'col-header', col: c })
  }

  for (let visualRow = 1; visualRow <= maxRows; visualRow++) {
    const logicalRow = lane.readFromBottom ? maxRows - visualRow + 1 : visualRow
    cells.push({ kind: 'row-header', visualRow, row: logicalRow })
    for (let c = 1; c <= lane.cols; c++) {
      const rowsInCol = lane.colsRows[c - 1]
      const inHeight = logicalRow <= rowsInCol
      const notExcluded = !excluded.has(excludedKey(c, logicalRow))
      const hasSeat = inHeight && notExcluded
      if (hasSeat) {
        const id = `${lane.prefix}-C${c}R${logicalRow}`
        cells.push({ kind: 'seat', col: c, row: logicalRow, visualRow, id })
      } else {
        cells.push({ kind: 'empty', col: c, visualRow })
      }
    }
  }

  const seatCount = cells.filter(c => c.kind === 'seat').length

  if (dbSeatsForLane.length === seatCount) {
    let i = 0
    for (const cell of cells) {
      if (cell.kind === 'seat') {
        cell.dbSeat = dbSeatsForLane[i++]
      }
    }
  }

  return { cells, maxRows, seatCount }
}

/* ───────── Page ───────── */
export default function SeatLayoutPage() {
  const { user } = useAuth()
  const today = new Date().toLocaleDateString('en-CA')
  const initStart = getCurrentTimeSlot()
  const initEnd = getDefaultEndTime(initStart)

  const [seats, setSeats] = useState<Seat[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState(initStart)
  const [endTime, setEndTime] = useState(initEnd)
  const [localStates, setLocalStates] = useState<Record<string, 'occupied' | 'mine' | 'inactive'>>({})

  useEffect(() => { fetchSeats() }, [])
  useEffect(() => { fetchBookings() }, [date, startTime, endTime])

  async function fetchSeats() {
    setLoading(true)
    const { data } = await supabase.from('seats').select('*').order('seat_number')
    if (data) setSeats(data as Seat[])
    setLoading(false)
  }

  async function fetchBookings() {
    setRefreshing(true)
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_date', date)
      .eq('status', 'active')
      .lt('start_ts', `${date}T${endTime}:00`)
      .gt('end_ts', `${date}T${startTime}:00`)
    if (data) setBookings(data as Booking[])
    setRefreshing(false)
  }

  const bookedIds = useMemo(() => new Set(bookings.map(b => b.seat_id)), [bookings])
  const myIds = useMemo(
    () => new Set(bookings.filter(b => b.user_id === user?.id).map(b => b.seat_id)),
    [bookings, user]
  )

  const seatsByLane: Record<string, Seat[]> = useMemo(() => {
    const result: Record<string, Seat[]> = {}
    LANES.forEach(lane => {
      result[lane.id] = seats.filter(s => s.room_id != null && s.room_id === (lane as any).roomId)
    })
    return result
  }, [seats])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchSeats(), fetchBookings()])
    setRefreshing(false)
  }

  const cycleLocalState = useCallback((cellId: string) => {
    setLocalStates(prev => {
      const cur = prev[cellId]
      const next: Record<string, 'occupied' | 'mine' | 'inactive'> = { ...prev }
      if (!cur) next[cellId] = 'occupied'
      else if (cur === 'occupied') next[cellId] = 'mine'
      else if (cur === 'mine') next[cellId] = 'inactive'
      else delete next[cellId]
      return next
    })
  }, [])

  const lanesByGroup = useMemo(() => {
    const m: Record<LaneGroup, LaneSpec[]> = {
      'top-left': [], 'top-hr': [], 'top-th': [], 'cafeteria': [],
      'training': [], 'rooms': [], 'booth': [],
    }
    LANES.forEach(l => m[l.group].push(l))
    return m
  }, [])

  const renderLane = (lane: LaneSpec) => (
    <LaneCard
      key={lane.id}
      lane={lane}
      dbSeatsForLane={seatsByLane[lane.id] || []}
      bookedIds={bookedIds}
      myIds={myIds}
      localStates={localStates}
      onCellClick={cycleLocalState}
      loading={loading}
      compact={!BIG_GROUPS.includes(lane.group)}
    />
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div
          style={{
            maxWidth: 1500,
            margin: '0 auto',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={16} color="#2563eb" />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Seat Layout</span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 99,
                background: '#dbeafe',
                color: '#1d4ed8',
                fontWeight: 700,
              }}
            >
              Preview
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
              · Row × Column grid view
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '5px 10px',
              }}
            >
              <Calendar size={12} color="#3b82f6" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>
            <ShiftPicker
              date={date}
              startTime={startTime}
              endTime={endTime}
              isOvernight={false}
              onStartChange={setStartTime}
              onEndChange={setEndTime}
              onOvernightChange={() => {}}
            />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                fontSize: 12,
                fontWeight: 600,
                color: '#475569',
                cursor: refreshing ? 'wait' : 'pointer',
              }}
            >
              <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: 20 }}>
        <Legend />

        {/* Top L-section: Server tall on left, HR + TH stacked on right */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div className="seatlayout-top-left">
            {lanesByGroup['top-left'].map(renderLane)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {lanesByGroup['top-hr'].map(renderLane)}
            {lanesByGroup['top-th'].map(renderLane)}
          </div>
        </div>

        {/* Cafeteria: full width */}
        <div>{lanesByGroup['cafeteria'].map(renderLane)}</div>

        {/* Training rooms */}
        <SectionHeader title="Training Rooms" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 16,
            marginBottom: 18,
          }}
        >
          {lanesByGroup['training'].map(renderLane)}
        </div>

        {/* Other rooms */}
        <SectionHeader title="Other Rooms" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 16,
            marginBottom: 18,
          }}
        >
          {lanesByGroup['rooms'].map(renderLane)}
        </div>

        {/* Meeting & Phone Booths */}
        <SectionHeader title="Meeting Rooms & Phone Booths" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}
        >
          {lanesByGroup['booth'].map(renderLane)}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .spin { animation: spin 0.8s linear infinite; }
        .seatlayout-top-left > div {
          margin-bottom: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      ` }} />
    </div>
  )
}

/* ───────── Legend ───────── */
function Legend() {
  const items = [
    { label: 'Available', bg: '#22c55e', border: '#15803d' },
    { label: 'Occupied', bg: '#ef4444', border: '#b91c1c' },
    { label: 'Mine', bg: '#7c3aed', border: '#5b21b6' },
    { label: 'Inactive', bg: '#cbd5e1', border: '#94a3b8' },
  ]
  return (
    <div
      style={{
        background: 'white',
        border: '1.5px solid #e2e8f0',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Legend</span>
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: '#64748b' }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: it.bg,
              border: `1.5px solid ${it.border}`,
            }}
          />
          {it.label}
        </div>
      ))}
    </div>
  )
}

/* ───────── Section heading ───────── */
function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </div>
  )
}

/* ───────── Lane card ───────── */
function LaneCard({
  lane,
  dbSeatsForLane,
  bookedIds,
  myIds,
  localStates,
  onCellClick,
  loading,
  compact = false,
}: {
  lane: LaneSpec
  dbSeatsForLane: Seat[]
  bookedIds: Set<string>
  myIds: Set<string>
  localStates: Record<string, 'occupied' | 'mine' | 'inactive'>
  onCellClick: (id: string) => void
  loading: boolean
  compact?: boolean
}) {
  const CELL = compact ? 18 : 22
  const HEADER_H = compact ? 14 : 18

  const { cells, maxRows, seatCount } = useMemo(
    () => buildCells(lane, dbSeatsForLane),
    [lane, dbSeatsForLane]
  )

  let av = 0, oc = 0, mn = 0, ia = 0
  for (const cell of cells) {
    if (cell.kind !== 'seat') continue
    const dbId = cell.dbSeat?.id
    let state: 'av' | 'oc' | 'mn' | 'ia' = 'av'
    if (dbId) {
      if (!cell.dbSeat?.is_active) state = 'ia'
      else if (myIds.has(dbId)) state = 'mn'
      else if (bookedIds.has(dbId)) state = 'oc'
    } else {
      const local = localStates[cell.id]
      if (local === 'inactive') state = 'ia'
      else if (local === 'mine') state = 'mn'
      else if (local === 'occupied') state = 'oc'
    }
    if (state === 'av') av++
    else if (state === 'oc') oc++
    else if (state === 'mn') mn++
    else ia++
  }

  return (
    <div
      style={{
        background: 'white',
        border: '1.5px solid #e2e8f0',
        borderRadius: 12,
        marginBottom: 18,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: lane.accentColor,
        }}
      />

      {/* header */}
      <div
        style={{
          padding: compact ? '14px 18px 10px' : '16px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: compact ? 30 : 32,
              height: compact ? 30 : 32,
              borderRadius: 8,
              background: lane.bgColor,
              color: lane.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: compact ? 15 : 16,
            }}
            {...(lane.iconIsSvg
              ? { dangerouslySetInnerHTML: { __html: lane.icon } }
              : {})}
          >
            {lane.iconIsSvg ? null : lane.icon}
          </div>
          <div>
            <div style={{ fontSize: compact ? 14 : 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
              {lane.title}
            </div>
            <div style={{ fontSize: compact ? 10.5 : 11, color: '#64748b', marginTop: 2 }}>
              {lane.subtitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatChip dot="#22c55e" label={`${av} avail`} />
          <StatChip dot="#ef4444" label={`${oc} occupied`} />
          <StatChip dot="#7c3aed" label={`${mn} mine`} />
          <StatChip dot="#cbd5e1" label={`${ia} inactive`} />
          <StatChip dot="#64748b" label={`${seatCount} total`} />
        </div>
      </div>

      {/* body */}
      <div
        style={{
          padding: compact ? '14px 18px 16px' : '16px 20px 18px',
          overflowX: 'auto',
          overflowY: 'hidden',
          flex: 1,
        }}
      >
        {loading ? (
          <div style={{ fontSize: 12, color: '#94a3b8', padding: 20 }}>Loading…</div>
        ) : (
          (() => {
            const AISLE = compact ? 8 : 12
            const colGapsSet = new Set(lane.colGaps || [])
            const rowGapsSet = new Set(lane.rowGaps || [])

            const colTracks: string[] = [`${CELL}px`]
            for (let c = 1; c <= lane.cols; c++) {
              const w = colGapsSet.has(c) ? CELL + AISLE : CELL
              colTracks.push(`${w}px`)
            }

            const rowTracks: string[] = [`${HEADER_H}px`]
            for (let visualRow = 1; visualRow <= maxRows; visualRow++) {
              const logicalRow = lane.readFromBottom ? maxRows - visualRow + 1 : visualRow
              const hasGap = rowGapsSet.has(logicalRow)
              const h = hasGap ? CELL + AISLE : CELL
              rowTracks.push(`${h}px`)
            }

            return (
              <div
                style={{
                  display: 'grid',
                  gap: 4,
                  width: 'max-content',
                  margin: '0 auto',
                  gridTemplateColumns: colTracks.join(' '),
                  gridTemplateRows: rowTracks.join(' '),
                }}
              >
                {cells.map((cell, idx) => {
                  if (cell.kind === 'corner') return <div key={idx} />
                  if (cell.kind === 'col-header') {
                    return (
                      <div
                        key={idx}
                        style={{
                          gridColumn: cell.col + 1,
                          gridRow: 1,
                          justifySelf: 'start',
                          alignSelf: 'start',
                          width: CELL,
                          height: HEADER_H,
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          letterSpacing: '0.04em',
                        }}
                      >
                        C{cell.col}
                      </div>
                    )
                  }
                  if (cell.kind === 'row-header') {
                    return (
                      <div
                        key={idx}
                        style={{
                          gridColumn: 1,
                          gridRow: cell.visualRow + 1,
                          justifySelf: 'start',
                          alignSelf: 'start',
                          width: CELL,
                          height: CELL,
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          letterSpacing: '0.04em',
                        }}
                      >
                        R{cell.row}
                      </div>
                    )
                  }
                  if (cell.kind === 'empty') {
                    return (
                      <div
                        key={idx}
                        style={{
                          gridColumn: cell.col + 1,
                          gridRow: cell.visualRow + 1,
                        }}
                      />
                    )
                  }
                  // seat
                  const dbId = cell.dbSeat?.id
                  let bg = '#22c55e', bd = '#15803d'
                  if (dbId) {
                    if (!cell.dbSeat?.is_active) {
                      bg = '#cbd5e1'; bd = '#94a3b8'
                    } else if (myIds.has(dbId)) {
                      bg = '#7c3aed'; bd = '#5b21b6'
                    } else if (bookedIds.has(dbId)) {
                      bg = '#ef4444'; bd = '#b91c1c'
                    }
                  } else {
                    const local = localStates[cell.id]
                    if (local === 'inactive') {
                      bg = '#cbd5e1'; bd = '#94a3b8'
                    } else if (local === 'mine') {
                      bg = '#7c3aed'; bd = '#5b21b6'
                    } else if (local === 'occupied') {
                      bg = '#ef4444'; bd = '#b91c1c'
                    }
                  }
                  const labelText = cell.dbSeat?.seat_number || cell.id
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => !dbId && onCellClick(cell.id)}
                      title={labelText}
                      style={{
                        gridColumn: cell.col + 1,
                        gridRow: cell.visualRow + 1,
                        justifySelf: 'start',
                        alignSelf: 'start',
                        width: CELL,
                        height: CELL,
                        borderRadius: 4,
                        background: bg,
                        border: `1.5px solid ${bd}`,
                        cursor: dbId ? 'default' : 'pointer',
                        padding: 0,
                        transition: 'transform 0.1s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.18)'
                        e.currentTarget.style.zIndex = '5'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.zIndex = '1'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  )
                })}
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}

function StatChip({ dot, label }: { dot: string; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        borderRadius: 99,
        fontSize: 10.5,
        fontWeight: 700,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        color: '#64748b',
      }}
    >
      <span style={{ width: 6.5, height: 6.5, borderRadius: '50%', background: dot }} />
      {label}
    </span>
  )
}
