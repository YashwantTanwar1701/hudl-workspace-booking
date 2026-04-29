'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Apple, Monitor, Calendar, Clock, Filter,
  ShoppingCart, Trash2, Zap, CheckCircle2, Lock,
  Moon, Info, Users, LayoutGrid, RefreshCw,
  AlertTriangle, X, Heart,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import ShiftPicker from '../components/ShiftPicker'
import { useAuth } from '../components/AuthProvider'
import {
  FLOOR_SECTIONS, OS_META, getValidStartSlots, buildRoomMap, roomNameFromMap,
} from '../types'
import type { Seat, Booking, OsType, Room, RoomMap } from '../types'
import { LANES, buildLaneCells, isWellnessLane, type LaneSpec } from '../lib/seat-grid'

/* ─── helpers ─── */
function OsIconSmall({ os, size = 12 }: { os: OsType; size?: number }) {
  if (os === 'mac') return <Apple size={size} />
  if (os === 'windows') return <Monitor size={size} />
  return <span style={{ fontSize: size - 2, lineHeight: 1 }}>🪑</span>
}

function minutesBetween(a: string, b: string, overnight = false) {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  let d = (bh * 60 + bm) - (ah * 60 + am)
  if (overnight || d <= 0) d += 1440
  return d
}

function fmtDur(mins: number) {
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/* ─── Lane card with selectable seats (booking-flavor) ─── */
type SeatState = 'available' | 'booked' | 'selected' | 'mine' | 'inactive' | 'no-seat'

function LaneBookingCard({
  lane, dbSeats, bookedIds, myIds, selectedIds, onToggle, bookings,
  filterOs, highlighted, cardRef,
}: {
  lane: LaneSpec
  dbSeats: Seat[]
  bookedIds: Set<string>
  myIds: Set<string>
  selectedIds: Set<string>
  onToggle: (seat: Seat) => void
  bookings: Booking[]
  filterOs: string
  highlighted: boolean
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const { cells, maxRows, seatCount } = useMemo(() => buildLaneCells(lane), [lane])
  // Lenient match: fill what we have from DB into spec cells; cells beyond
  // DB count render as non-interactive ghost placeholders.
  const dbSeatCount = dbSeats.length
  const isShortByDb = dbSeatCount > 0 && dbSeatCount < seatCount

  // Apply OS filter to determine which seats are visible / interactive
  const isFiltered = (seat: Seat) => filterOs && seat.os_type !== filterOs

  // Stats per lane
  let av = 0, bk = 0, sel = 0
  for (const cell of cells) {
    if (cell.kind !== 'seat') continue
    const seat = dbSeats[cell.dbSeatIndex] ?? null
    if (!seat) continue
    if (filterOs && seat.os_type !== filterOs) continue
    if (selectedIds.has(seat.id)) sel++
    else if (!seat.is_active) {} // count inactive separately
    else if (bookedIds.has(seat.id)) bk++
    else av++
  }

  // Aisle / sizing — same as Seat Layout (compact for small rooms, big otherwise)
  const isBig = ['top-left', 'top-hr', 'top-th', 'cafeteria'].includes(lane.group)
  const CELL = isBig ? 26 : 22
  const HEADER_H = isBig ? 16 : 14
  const AISLE = isBig ? 12 : 8

  const colGapsSet = new Set(lane.colGaps || [])
  const rowGapsSet = new Set(lane.rowGaps || [])

  const colTracks: string[] = [`${CELL}px`]
  for (let c = 1; c <= lane.cols; c++) {
    colTracks.push(`${colGapsSet.has(c) ? CELL + AISLE : CELL}px`)
  }
  const rowTracks: string[] = [`${HEADER_H}px`]
  for (let visualRow = 1; visualRow <= maxRows; visualRow++) {
    const logicalRow = lane.readFromBottom ? maxRows - visualRow + 1 : visualRow
    const hasGap = rowGapsSet.has(logicalRow)
    rowTracks.push(`${hasGap ? CELL + AISLE : CELL}px`)
  }

  return (
    <div
      ref={cardRef}
      className={highlighted ? 'seat-card-highlighted' : ''}
      style={{
        background: '#fff',
        border: `1.5px solid ${sel > 0 ? lane.accentColor : '#e2e8f0'}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: sel > 0 ? `0 0 0 3px ${lane.accentColor}22` : '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'all 0.2s',
        scrollMarginTop: 130,
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: lane.accentColor }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px', background: lane.bgColor, borderBottom: `1px solid ${lane.accentColor}33` }}>
        <div
          style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', color: lane.accentColor }}
          {...(lane.iconIsSvg ? { dangerouslySetInnerHTML: { __html: lane.icon } } : {})}
        >
          {lane.iconIsSvg ? null : lane.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{lane.title}</span>
            {sel > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: lane.accentColor, color: '#fff' }}>
                {sel} selected
              </span>
            )}
            {isWellnessLane(lane.id) && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                <Heart size={9} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                Emergency
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{lane.subtitle}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: av === 0 ? '#dc2626' : '#15803d' }}>{av} avail</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{seatCount} total</span>
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '14px 18px 16px', overflowX: 'auto', overflowY: 'hidden' }}>
        {isShortByDb && (
          <div style={{ marginBottom: 10, padding: '6px 10px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, fontSize: 11, color: '#9a3412' }}>
            Showing {dbSeatCount}/{seatCount} seats configured. {seatCount - dbSeatCount} extra slot{seatCount - dbSeatCount !== 1 ? 's' : ''} appear as placeholders — add seats in admin to fill them.
          </div>
        )}
        {seatCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '14px 0', color: '#94a3b8', fontSize: 12 }}>No seats configured</div>
        ) : (
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
              if (cell.kind === 'col-header') return <div key={idx} />
              if (cell.kind === 'row-header') return <div key={idx} />
              if (cell.kind === 'empty') {
                return <div key={idx} style={{ gridColumn: cell.col + 1, gridRow: cell.visualRow + 1 }} />
              }

              const seat = dbSeats[cell.dbSeatIndex]
              if (!seat) {
                // Placeholder for spec cell with no DB seat behind it
                return (
                  <div
                    key={idx}
                    title={`${cell.cellId} — not configured in DB`}
                    style={{
                      gridColumn: cell.col + 1,
                      gridRow: cell.visualRow + 1,
                      justifySelf: 'start',
                      alignSelf: 'start',
                      width: CELL,
                      height: CELL,
                      borderRadius: 4,
                      background: 'transparent',
                      border: '1.5px dashed #e2e8f0',
                      opacity: 0.5,
                    }}
                  />
                )
              }
              const filtered = filterOs ? seat.os_type !== filterOs : false
              const state: SeatState =
                !seat.is_active ? 'inactive'
                : selectedIds.has(seat.id) ? 'selected'
                : myIds.has(seat.id) ? 'mine'
                : bookedIds.has(seat.id) ? 'booked'
                : 'available'

              return (
                <SeatCell
                  key={idx}
                  seat={seat}
                  state={state}
                  filtered={filtered}
                  onClick={() => onToggle(seat)}
                  cellSize={CELL}
                  col={cell.col}
                  visualRow={cell.visualRow}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SeatCell({
  seat, state, filtered, onClick, cellSize, col, visualRow,
}: {
  seat: Seat
  state: SeatState
  filtered: boolean
  onClick: () => void
  cellSize: number
  col: number
  visualRow: number
}) {
  const palette: Record<SeatState, { bg: string; border: string; color: string }> = {
    available: { bg: '#f0fdf4', border: '#86efac', color: '#15803d' },
    booked:    { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b' },
    selected:  { bg: '#1e3a5f', border: '#3b82f6', color: '#fff' },
    mine:      { bg: '#f5f3ff', border: '#a78bfa', color: '#5b21b6' },
    inactive:  { bg: '#f8fafc', border: '#e2e8f0', color: '#94a3b8' },
    'no-seat': { bg: 'transparent', border: 'transparent', color: 'transparent' },
  }
  const p = palette[state]
  const disabled = state === 'booked' || state === 'inactive' || filtered
  const opacity = filtered ? 0.25 : (state === 'inactive' ? 0.55 : (state === 'booked' ? 0.85 : 1))
  const iconSize = Math.max(8, Math.floor(cellSize * 0.45))

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={`${seat.seat_number} · ${OS_META[seat.os_type].label}${state === 'booked' ? ' · Occupied' : ''}`}
      style={{
        gridColumn: col + 1,
        gridRow: visualRow + 1,
        justifySelf: 'start',
        alignSelf: 'start',
        width: cellSize,
        height: cellSize,
        borderRadius: 4,
        background: p.bg,
        border: `1.5px solid ${p.border}`,
        color: p.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.1s ease',
        opacity,
        position: 'relative',
        fontFamily: 'inherit',
      }}
    >
      {state === 'inactive' ? (
        <Lock size={iconSize - 1} style={{ opacity: 0.6 }} />
      ) : state === 'booked' ? (
        <Lock size={iconSize - 1} style={{ opacity: 0.6 }} />
      ) : state === 'selected' ? (
        <CheckCircle2 size={iconSize} />
      ) : (
        <OsIconSmall os={seat.os_type} size={iconSize} />
      )}
    </button>
  )
}

/* ─── Section pills ─── */
function SectionPills({
  lanes, onClick, highlightedId, seatsByLane, bookedIds,
}: {
  lanes: LaneSpec[]
  onClick: (laneId: string) => void
  highlightedId: string | null
  seatsByLane: Record<string, Seat[]>
  bookedIds: Set<string>
}) {
  return (
    <div style={{
      padding: '6px 16px',
      display: 'flex',
      gap: 5,
      alignItems: 'center',
      overflowX: 'auto',
      background: '#fafafa',
      borderTop: '1px solid #f1f5f9',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Sections:</span>
      {lanes.map(lane => {
        const ss = seatsByLane[lane.id] || []
        const avail = ss.filter(s => !bookedIds.has(s.id) && s.is_active).length
        const active = highlightedId === lane.id
        return (
          <button
            key={lane.id}
            onClick={() => onClick(lane.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 99,
              border: `1.5px solid ${active ? lane.accentColor : '#e2e8f0'}`,
              background: active ? lane.bgColor : '#fff',
              color: active ? '#0f172a' : '#64748b',
              fontSize: 11, fontWeight: active ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {lane.iconIsSvg ? (
              <span
                style={{ display: 'inline-flex', width: 12, height: 12, alignItems: 'center', justifyContent: 'center', color: lane.accentColor }}
                dangerouslySetInnerHTML={{ __html: lane.icon.replace('width="18"', 'width="12"').replace('height="18"', 'height="12"') }}
              />
            ) : (
              <span>{lane.icon}</span>
            )}
            <span>{lane.title}</span>
            {ss.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: avail === 0 ? '#ef4444' : '#15803d' }}>
                ({avail})
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ─── Confirm Modal (existing) ─── */
function ConfirmModal({ open, onClose, seats, selectedIds, date, startTime, endTime, isOvernight, endDate, onConfirm, loading, error }: {
  open: boolean; onClose: () => void; seats: Seat[]; selectedIds: Set<string>
  date: string; startTime: string; endTime: string; isOvernight: boolean; endDate: string
  onConfirm: () => void; loading: boolean; error: string
}) {
  if (!open) return null
  const sel = seats.filter(s => selectedIds.has(s.id))
  const dur = fmtDur(minutesBetween(startTime, endTime, isOvernight))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 32px 80px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={18} color="#2563eb" /></div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Confirm {sel.length} Seat{sel.length !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Review before confirming</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#475569' }}>
              <Calendar size={13} color="#3b82f6" />
              {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#475569' }}>
              <Clock size={13} color="#3b82f6" />{startTime} → {endTime} <span style={{ color: '#94a3b8' }}>({dur})</span>
              {isOvernight && <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 99, background: '#ede9fe', color: '#7c3aed', fontWeight: 600 }}>Overnight → {endDate}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
            {sel.map(seat => {
              const lane = LANES.find(l => l.sectionId === seat.section)
              return (
                <div key={seat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9 }}>
                  <div
                    style={{ width: 28, height: 28, borderRadius: 7, background: lane?.bgColor ?? '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: lane?.accentColor ?? '#64748b' }}
                    {...(lane?.iconIsSvg ? { dangerouslySetInnerHTML: { __html: lane.icon.replace('width="18"', 'width="14"').replace('height="18"', 'height="14"') } } : {})}
                  >
                    {lane?.iconIsSvg ? null : lane?.icon ?? '💡'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{seat.seat_number}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{lane?.title ?? seat.section}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{OS_META[seat.os_type].label}</span>
                </div>
              )
            })}
          </div>
          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
              <AlertTriangle size={11} style={{ marginRight: 6, verticalAlign: '-1px' }} /> {error}
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#475569' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Zap size={14} /> {loading ? 'Booking…' : `Confirm ${sel.length}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Wellness Emergency Confirmation Modal ─── */
function WellnessConfirmModal({ open, onClose, onConfirm, count }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  count: number
}) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 32px 80px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
            <Heart size={20} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Wellness Room Booking</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Emergency-only access</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ padding: '18px 22px', fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 10px' }}>
            The <strong>Wellness Room</strong> is reserved for emergencies — when an employee needs immediate rest, recovery, or quiet space due to illness or distress.
          </p>
          <p style={{ margin: 0, color: '#64748b' }}>
            Please confirm your booking is for an emergency reason. The 30-minute advance window does not apply — book whenever you need it.
          </p>
        </div>
        <div style={{ padding: '14px 22px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#475569' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Heart size={14} /> Confirm Emergency Booking
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ─── */
function BookInner() {
  const { user } = useAuth()
  const router = useRouter()
  const today = new Date().toLocaleDateString('en-CA')

  const [date, setDate] = useState<string>(today)
  const [startTime, setStartTime] = useState<string>('09:00')
  const [endTime, setEndTime] = useState<string>('18:00')
  const [isOvernight, setIsOvernight] = useState(false)
  const validStarts = getValidStartSlots(date)
  const effectiveStart = validStarts.includes(startTime) ? startTime : (validStarts[0] ?? '09:00')
  const endDate = isOvernight ? addDays(date, 1) : date

  const [seats, setSeats] = useState<Seat[]>([])
  const [roomMap, setRoomMap] = useState<RoomMap>({})
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingSeats, setLoadingSeats] = useState(true)
  const [loadingBks, setLoadingBks] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [wellnessConfirmOpen, setWellnessConfirmOpen] = useState(false)
  const [filterOs, setFilterOs] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [highlightedLaneId, setHighlightedLaneId] = useState<string | null>(null)
  const laneRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => { if (!user) router.push('/auth') }, [user, router])

  useEffect(() => { fetchSeats(); fetchRooms() }, [])
  useEffect(() => { fetchBookings() }, [date, effectiveStart, endTime, isOvernight])

  async function fetchSeats() {
    const { data } = await supabase.from('seats').select('*').order('seat_number')
    if (data) setSeats(data as Seat[])
    setLoadingSeats(false)
  }

  async function fetchRooms() {
    const { data } = await supabase.from('room').select('*')
    if (data) setRoomMap(buildRoomMap(data as Room[]))
  }

  async function fetchBookings() {
    setLoadingBks(true)
    const r1 = await supabase.from('bookings').select('*').eq('status', 'active').eq('booking_date', date)
    const all = [...(r1.data ?? [])] as Booking[]
    if (isOvernight && endDate !== date) {
      const r2 = await supabase.from('bookings').select('*').eq('status', 'active').eq('booking_date', endDate)
      all.push(...(r2.data ?? []) as Booking[])
    }
    setBookings(all)
    const booked = new Set(all.map(b => b.seat_id))
    setSelectedIds(prev => { const n = new Set(prev); Array.from(prev).forEach(id => { if (booked.has(id)) n.delete(id) }); return n })
    setLoadingBks(false)
  }

  const bookedIds = useMemo(() => new Set(bookings.map(b => b.seat_id)), [bookings])
  const myIds = useMemo(() => new Set(bookings.filter(b => b.user_id === user?.id).map(b => b.seat_id)), [bookings, user])

  const seatsByLane: Record<string, Seat[]> = useMemo(() => {
    const result: Record<string, Seat[]> = {}
    LANES.forEach(lane => { result[lane.id] = seats.filter(s => s.section === lane.sectionId) })
    return result
  }, [seats])

  const toggleSeat = useCallback((seat: Seat) => {
    if (!seat.is_active) return
    if (bookedIds.has(seat.id) && !myIds.has(seat.id)) return
    setSelectedIds(prev => { const n = new Set(prev); n.has(seat.id) ? n.delete(seat.id) : n.add(seat.id); return n })
  }, [bookedIds, myIds])

  /** True iff every selected seat is in the Wellness Room. */
  const allSelectedAreWellness = useMemo(() => {
    if (selectedIds.size === 0) return false
    const wellness = LANES.find(l => l.id === 'wellness')
    if (!wellness) return false
    return seats.filter(s => selectedIds.has(s.id)).every(s => s.section === wellness.sectionId)
  }, [selectedIds, seats])

  async function performBooking() {
    if (!user || selectedIds.size === 0) return
    // 30-min advance check — bypassed entirely for Wellness-only selections
    if (!allSelectedAreWellness && date === today) {
      const [sh, sm] = effectiveStart.split(':').map(Number)
      const nowM = new Date().getHours() * 60 + new Date().getMinutes()
      if ((sh * 60 + sm) - nowM < 30) {
        setError('Must book at least 30 min before start time.')
        return
      }
    }
    setSubmitting(true); setError('')
    const sel = seats.filter(s => selectedIds.has(s.id))
    const inserts = sel.flatMap(seat => isOvernight ? [
      { user_id: user.id, seat_id: seat.id, booking_date: date, start_time: effectiveStart + ':00', end_time: '23:59:59', start_ts: `${date}T${effectiveStart}:00`, end_ts: `${date}T23:59:59`, shift_id: selectedShiftId },
      { user_id: user.id, seat_id: seat.id, booking_date: endDate, start_time: '00:00:00', end_time: endTime + ':00', start_ts: `${endDate}T00:00:00`, end_ts: `${endDate}T${endTime}:00`, shift_id: selectedShiftId },
    ] : [
      { user_id: user.id, seat_id: seat.id, booking_date: date, start_time: effectiveStart + ':00', end_time: endTime + ':00', start_ts: `${date}T${effectiveStart}:00`, end_ts: `${date}T${endTime}:00`, shift_id: selectedShiftId },
    ])
    const { error: err } = await supabase.from('bookings').insert(inserts)
    if (err) setError(err.message.includes('overlap') ? 'One or more seats conflict with existing bookings.' : err.message)
    else { setSuccess(true); setConfirmOpen(false); setWellnessConfirmOpen(false); setSelectedIds(new Set()); await fetchBookings() }
    setSubmitting(false)
  }

  /** "Book" button click. If Wellness-only, show emergency modal first. Otherwise show normal confirm. */
  function handleBookClick() {
    setError('')
    if (allSelectedAreWellness) {
      setWellnessConfirmOpen(true)
    } else {
      setConfirmOpen(true)
    }
  }

  /** After Wellness emergency acknowledged, proceed straight to booking. */
  function handleWellnessConfirm() {
    void performBooking()
  }

  const handlePillClick = useCallback((laneId: string) => {
    setHighlightedLaneId(laneId)
    const el = laneRefs.current[laneId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => {
      setHighlightedLaneId(prev => (prev === laneId ? null : prev))
    }, 2500)
  }, [])

  const setLaneRef = useCallback((laneId: string) => (el: HTMLDivElement | null) => {
    laneRefs.current[laneId] = el
  }, [])

  const totalAvail = seats.filter(s => !bookedIds.has(s.id) && s.is_active).length
  const dur = fmtDur(minutesBetween(effectiveStart, endTime, isOvernight))
  const noSlots = date === today && validStarts.length === 0
  // Note: noSlots disables bookings UNLESS the user only has Wellness selected
  const canBook = selectedIds.size > 0 && (!noSlots || allSelectedAreWellness)

  if (success) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}><CheckCircle2 size={36} color="#059669" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>All Booked!</h2>
        <p style={{ color: '#64748b', marginBottom: 24 }}>Your reservation is confirmed.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => setSuccess(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Book More</button>
          <button onClick={() => router.push('/my-bookings')} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>My Bookings →</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 60, zIndex: 50 }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 9 }}>
                <LayoutGrid size={21} color="#2563eb" /> Book a Seat
              </h1>
              <p style={{ color: '#64748b', fontSize: 13 }}>Multi-seat selection · Same layout as Floor Map · Wellness Room available 24/7</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, padding: '5px 10px', borderRadius: 99, background: '#f0fdf4', color: '#15803d', fontWeight: 600, border: '1px solid #bbf7d0' }}>{loadingBks ? '…' : `${totalAvail} available`}</span>
              <button onClick={fetchBookings} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569', fontFamily: 'inherit' }}><RefreshCw size={11} /> Refresh</button>
            </div>
          </div>

          {/* 30-min warning */}
          {date === today && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', marginBottom: 12, background: noSlots ? '#fef2f2' : '#fffbeb', border: `1px solid ${noSlots ? '#fecaca' : '#fde68a'}`, borderRadius: 9, fontSize: 12, color: noSlots ? '#b91c1c' : '#92400e' }}>
              <AlertTriangle size={12} color={noSlots ? '#dc2626' : '#d97706'} />
              {noSlots
                ? 'No slots available today — all remaining slots are within the 30-min booking window. (Wellness Room remains bookable for emergencies.)'
                : 'Seats must be booked at least 30 min before start time. Past slots are hidden. Wellness Room is exempt.'}
            </div>
          )}

          {/* Row 1: Date + Shift picker (left) · OS filter (right) */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px' }}>
              <Calendar size={12} color="#3b82f6" />
              <input type="date" value={date} min={today} onChange={e => { setDate(e.target.value); setSelectedIds(new Set()) }} style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }} />
            </div>
            <ShiftPicker
              date={date}
              startTime={effectiveStart} endTime={endTime} isOvernight={isOvernight}
              onStartChange={t => { setStartTime(t); setSelectedIds(new Set()) }}
              onEndChange={t => { setEndTime(t); setSelectedIds(new Set()) }}
              onOvernightChange={v => { setIsOvernight(v); setSelectedIds(new Set()) }}
              onShiftIdChange={id => setSelectedShiftId(id)}
              validStartSlots={validStarts}
              disabled={noSlots}
              restrictPastShifts={true}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 3 }}>
              {([['', 'All'], ['mac', 'Mac'], ['windows', 'Win'], ['other', 'Seat Only']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilterOs(val)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: filterOs === val ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', background: filterOs === val ? '#fff' : 'transparent', color: filterOs === val ? '#0f172a' : '#64748b', boxShadow: filterOs === val ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                  {val === 'mac' && <Apple size={10} />}{val === 'windows' && <Monitor size={10} />}{val === 'other' && <span style={{ fontSize: 10 }}>🪑</span>}{val === '' && <Filter size={10} />}{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section pills */}
        <SectionPills lanes={LANES} onClick={handlePillClick} highlightedId={highlightedLaneId} seatsByLane={seatsByLane} bookedIds={bookedIds} />
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 288px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 13px', background: '#fff', borderRadius: 9, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            {[{c:'#86efac',b:'#86efac',l:'Available'},{c:'#fca5a5',b:'#fca5a5',l:'Booked'},{c:'#1e3a5f',b:'#3b82f6',l:'Selected'},{c:'#a78bfa',b:'#a78bfa',l:'Mine'},{c:'#e2e8f0',b:'#e2e8f0',l:'Locked (Remote)'}].map(lg => (
              <div key={lg.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: lg.c, border: `2px solid ${lg.b}` }} />{lg.l}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}><Info size={10} /> Click to multi-select</div>
          </div>

          {loadingSeats ? (
            [1,2,3].map(i => <div key={i} style={{ height: 100, borderRadius: 14, background: '#f1f5f9' }} />)
          ) : LANES.map(lane => (
            <LaneBookingCard
              key={lane.id}
              lane={lane}
              dbSeats={seatsByLane[lane.id] || []}
              bookedIds={bookedIds}
              myIds={myIds}
              selectedIds={selectedIds}
              onToggle={toggleSeat}
              bookings={bookings}
              filterOs={filterOs}
              highlighted={highlightedLaneId === lane.id}
              cardRef={setLaneRef(lane.id)}
            />
          ))}
        </div>

        {/* Cart sidebar */}
        <div style={{ position: 'sticky', top: 180, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 15, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg,#1e3a5f,#2d5282)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <ShoppingCart size={15} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>Selection Cart</span>
                {selectedIds.size > 0 && <span style={{ marginLeft: 'auto', width: 21, height: 21, borderRadius: '50%', background: '#22c55e', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selectedIds.size}</span>}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{date} · {effectiveStart}–{endTime}{isOvernight ? ' (Night)' : ''}</div>
            </div>
            <div style={{ padding: 12 }}>
              {selectedIds.size === 0 ? (
                <div style={{ textAlign: 'center', padding: '18px 0', color: '#94a3b8' }}>
                  <Users size={26} style={{ margin: '0 auto 7px', display: 'block', opacity: 0.35 }} />
                  <div style={{ fontSize: 12 }}>{user ? 'Click seats to select' : 'Sign in to book'}</div>
                  {!user && <button onClick={() => router.push('/auth')} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 7, background: '#1e3a5f', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Sign in</button>}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {seats.filter(s => selectedIds.has(s.id)).map(seat => {
                    const lane = LANES.find(l => l.sectionId === seat.section)
                    return (
                      <div key={seat.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
                        <div
                          style={{ width: 26, height: 26, borderRadius: 6, background: lane?.bgColor ?? '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, color: lane?.accentColor ?? '#64748b' }}
                          {...(lane?.iconIsSvg ? { dangerouslySetInnerHTML: { __html: lane.icon.replace('width="18"', 'width="13"').replace('height="18"', 'height="13"') } } : {})}
                        >
                          {lane?.iconIsSvg ? null : lane?.icon ?? '💡'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{seat.seat_number}</div>
                          <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(seat.room_id ? roomMap[seat.room_id]?.name : null) || lane?.title}</div>
                        </div>
                        <button onClick={() => toggleSeat(seat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 2 }}><Trash2 size={11} /></button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {selectedIds.size > 0 && user && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid #f1f5f9', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Duration</span><span style={{ fontWeight: 600 }}>{dur}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                  <span>Seats</span><span>{selectedIds.size}</span>
                </div>
                {allSelectedAreWellness && (
                  <div style={{ padding: '6px 9px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 11, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Heart size={11} /> Emergency Wellness booking
                  </div>
                )}
                <button
                  onClick={handleBookClick}
                  disabled={!canBook}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 9,
                    border: 'none',
                    background: !canBook ? '#94a3b8' : (allSelectedAreWellness ? 'linear-gradient(135deg,#dc2626,#991b1b)' : 'linear-gradient(135deg,#059669,#047857)'),
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: !canBook ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {allSelectedAreWellness ? <Heart size={14} /> : <Zap size={14} />}
                  {allSelectedAreWellness
                    ? `Book Wellness Emergency`
                    : `Book ${selectedIds.size} Seat${selectedIds.size !== 1 ? 's' : ''}`}
                </button>
                <button onClick={() => setSelectedIds(new Set())} style={{ width: '100%', padding: '6px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <X size={11} /> Clear all
                </button>
              </div>
            )}
          </div>

          {isOvernight && (
            <div style={{ padding: '12px 14px', background: '#faf5ff', border: '1.5px solid #a78bfa', borderRadius: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: '#7c3aed', fontSize: 13, marginBottom: 5 }}><Moon size={13} /> Night Shift Active</div>
              <div style={{ fontSize: 12, color: '#6d28d9', lineHeight: 1.6 }}>
                <strong>{date}</strong> {effectiveStart} →<br /><strong>{endDate}</strong> {endTime}
              </div>
            </div>
          )}

          {/* Quick availability */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 9 }}>Quick Availability</div>
            {LANES.slice(0, 10).map(lane => {
              const ss = seatsByLane[lane.id] || []
              const avail = ss.filter(s => !bookedIds.has(s.id) && s.is_active).length
              const pct = ss.length > 0 ? avail / ss.length : 1
              return (
                <div key={lane.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                  <span style={{ fontSize: 10, flex: 1, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lane.title}</span>
                  <div style={{ width: 50, height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pct * 100}%`, height: '100%', background: pct === 0 ? '#ef4444' : pct < 0.35 ? '#f59e0b' : '#22c55e', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#64748b', width: 18, textAlign: 'right' }}>{avail}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <ConfirmModal open={confirmOpen} onClose={() => setConfirmOpen(false)} seats={seats} selectedIds={selectedIds} date={date} startTime={effectiveStart} endTime={endTime} isOvernight={isOvernight} endDate={endDate} onConfirm={performBooking} loading={submitting} error={error} />
      <WellnessConfirmModal open={wellnessConfirmOpen} onClose={() => setWellnessConfirmOpen(false)} onConfirm={handleWellnessConfirm} count={selectedIds.size} />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes seat-card-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70%  { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .seat-card-highlighted {
          animation: seat-card-pulse 1.2s ease-out 2;
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
        }
      ` }} />
    </div>
  )
}

export default function BookPage() {
  return <Suspense><BookInner /></Suspense>
}
