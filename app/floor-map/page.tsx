'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Eye, Calendar, RefreshCw, Apple, Monitor, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { useTheme } from '../components/ThemeProvider'
import ShiftPicker from '../components/ShiftPicker'
import { getCurrentTimeSlot, getDefaultEndTime, OS_META } from '../types'
import type { Seat, Booking, OsType } from '../types'
import { LANES, BIG_GROUPS, buildLaneCells, type LaneSpec, type LaneGroup } from '../lib/seat-grid'

/* ─── Portal-based tooltip (renders at document.body so it isn't clipped by overflow:hidden cards) ─── */
function PortalTooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  const W = 248
  const left = Math.min(Math.max(x - W / 2, 8), (typeof window !== 'undefined' ? window.innerWidth : 1400) - W - 8)
  return createPortal(
    <div style={{ position: 'fixed', left, top: y - 14, transform: 'translateY(-100%)', zIndex: 999999, pointerEvents: 'none', width: W }}>
      {children}
    </div>,
    document.body
  )
}

function OsIcon({ os, size = 12 }: { os: OsType; size?: number }) {
  if (os === 'mac') return <Apple size={size} />
  if (os === 'windows') return <Monitor size={size} />
  return <span style={{ fontSize: size, lineHeight: 1 }}>🪑</span>
}

/* ─── Seat hover details ─── */
function SeatTip({ seat, lane, windowBooked, isMine, allDayBookings }: {
  seat: Seat
  lane: LaneSpec | undefined
  windowBooked: boolean
  isMine: boolean
  allDayBookings: Booking[]
}) {
  const seatBks = allDayBookings
    .filter(b => b.seat_id === seat.id && b.status === 'active')
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const currentBk = seatBks.find(b => {
    const [sh, sm] = b.start_time.split(':').map(Number)
    const [eh, em] = b.end_time.split(':').map(Number)
    return sh * 60 + sm <= nowMins && nowMins < eh * 60 + em
  })
  const freeFrom = currentBk ? `Free from ${currentBk.end_time.slice(0, 5)}` : ''

  const isInactive = !seat.is_active
  const statusColor = isInactive ? '#94a3b8' : isMine ? '#a78bfa' : windowBooked ? '#f87171' : '#4ade80'
  const statusLabel = isInactive ? '⛔ Inactive' : isMine ? '🟣 Your Booking' : windowBooked ? '🔴 Occupied' : '🟢 Available'

  return (
    <div style={{ background: '#0f172a', color: '#fff', borderRadius: 12, padding: '13px 15px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontSize: 12, border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
      <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'monospace', marginBottom: 4 }}>{seat.seat_number}</div>
      <div style={{ color: 'var(--ink-300)', fontSize: 11, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        {lane?.iconIsSvg ? (
          <span
            style={{ display: 'inline-flex', width: 12, height: 12, color: lane.accentColor }}
            dangerouslySetInnerHTML={{ __html: lane.icon.replace('width="18"', 'width="12"').replace('height="18"', 'height="12"') }}
          />
        ) : (
          <span>{lane?.icon ?? '💡'}</span>
        )}
        {lane?.title ?? seat.section}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: statusColor, marginBottom: freeFrom ? 6 : 8 }}>{statusLabel}</div>
      {isInactive && seat.notes && <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>📝 {seat.notes}</div>}
      {freeFrom && <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {freeFrom}</div>}
      {seatBks.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Today</div>
          {seatBks.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#fca5a5', marginBottom: 3 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11 }}>
        <OsIcon os={seat.os_type} size={11} />
        {OS_META[seat.os_type].label}
        {seat.machine_number != null && <span style={{ marginLeft: 4 }}>· #{seat.machine_number}</span>}
      </div>
    </div>
  )
}

/* ───────── Page ───────── */
export default function SeatLayoutPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const today = new Date().toLocaleDateString('en-CA')
  const initStart = getCurrentTimeSlot()
  const initEnd = getDefaultEndTime(initStart)

  // All hooks declared first — before any conditional returns
  const [seats, setSeats] = useState<Seat[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [allDayBookings, setAllDayBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState(initStart)
  const [endTime, setEndTime] = useState(initEnd)
  const [highlightedLaneId, setHighlightedLaneId] = useState<string | null>(null)
  const [seatTip, setSeatTip] = useState<{ seat: Seat; x: number; y: number } | null>(null)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const laneRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/')
  }, [user, authLoading, router])

  useEffect(() => { if (user) fetchSeats() }, [user])
  useEffect(() => { if (user) { fetchBookings(); fetchAllDay() } }, [date, startTime, endTime, user])

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

  async function fetchAllDay() {
    const { data } = await supabase.from('bookings').select('*').eq('booking_date', date).eq('status', 'active')
    if (data) setAllDayBookings(data as Booking[])
  }

  const onSeatHover = useCallback((seat: Seat, x: number, y: number) => {
    if (tipTimer.current) { clearTimeout(tipTimer.current); tipTimer.current = null }
    setSeatTip({ seat, x, y })
  }, [])
  const onSeatLeave = useCallback(() => {
    tipTimer.current = setTimeout(() => setSeatTip(null), 80)
  }, [])

  const bookedIds = useMemo(() => new Set(bookings.map(b => b.seat_id)), [bookings])
  const myIds = useMemo(
    () => new Set(bookings.filter(b => b.user_id === user?.id).map(b => b.seat_id)),
    [bookings, user]
  )

  const seatsByLane: Record<string, Seat[]> = useMemo(() => {
    const result: Record<string, Seat[]> = {}
    LANES.forEach(lane => {
      result[lane.id] = seats.filter(s => s.section === lane.sectionId)
    })
    return result
  }, [seats])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchSeats(), fetchBookings(), fetchAllDay()])
    setRefreshing(false)
  }

  const lanesByGroup = useMemo(() => {
    const m: Record<LaneGroup, LaneSpec[]> = {
      'top-left': [], 'top-hr': [], 'top-th': [], 'cafeteria': [],
      'training': [], 'rooms': [], 'booth': [], 'pod': [],
    }
    LANES.forEach(l => m[l.group].push(l))
    return m
  }, [])

  const handlePillClick = useCallback((laneId: string) => {
    setHighlightedLaneId(laneId)
    const el = laneRefs.current[laneId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.setTimeout(() => {
      setHighlightedLaneId(prev => (prev === laneId ? null : prev))
    }, 2500)
  }, [])

  const setLaneRef = useCallback((laneId: string) => (el: HTMLDivElement | null) => {
    laneRefs.current[laneId] = el
  }, [])

  // ── Early returns AFTER every hook ──────────────────────────────
  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  if (!user) return null

  const renderLane = (lane: LaneSpec) => (
    <LaneCard
      key={lane.id}
      lane={lane}
      dbSeatsForLane={seatsByLane[lane.id] || []}
      bookedIds={bookedIds}
      myIds={myIds}
      loading={loading}
      compact={!BIG_GROUPS.includes(lane.group)}
      highlighted={highlightedLaneId === lane.id}
      cardRef={setLaneRef(lane.id)}
      onSeatHover={onSeatHover}
      onSeatLeave={onSeatLeave}
    />
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: 'var(--page-bg)' }}>
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)', position: 'sticky', top: 60, zIndex: 50 }}>
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
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink-900)' }}>Floor Map</span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 99,
                background: '#fef3c7',
                color: '#92400e',
                fontWeight: 700,
                border: '1px solid #fde68a',
              }}
            >
              View Only
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-300)', marginLeft: 4 }}>
              · Click a section pill to jump to that area
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--muted-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '5px 10px' }}>
              <Calendar size={12} color="#3b82f6" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', colorScheme: 'light dark' }}
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
              restrictPastShifts={false}
            />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', cursor: refreshing ? 'wait' : 'pointer' }}
            >
              <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <SectionPills lanes={LANES} onClick={handlePillClick} highlightedId={highlightedLaneId} seatsByLane={seatsByLane} bookedIds={bookedIds} />
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: 20 }}>
        <Legend />

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

        <div>{lanesByGroup['cafeteria'].map(renderLane)}</div>

        <SectionHeader title="Training Rooms" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 18 }}>
          {lanesByGroup['training'].map(renderLane)}
        </div>

        <SectionHeader title="Other Rooms" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 18 }}>
          {lanesByGroup['rooms'].map(renderLane)}
        </div>

        <SectionHeader title="Meeting Rooms & Phone Booths" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
          {lanesByGroup['booth'].map(renderLane)}
        </div>

        <SectionHeader title="Open Meeting Pod" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 18 }}>
          {lanesByGroup['pod'].map(renderLane)}
        </div>
      </div>

      {seatTip && (
        <PortalTooltip x={seatTip.x} y={seatTip.y}>
          <SeatTip
            seat={seatTip.seat}
            lane={LANES.find(l => l.sectionId === seatTip.seat.section)}
            windowBooked={bookedIds.has(seatTip.seat.id)}
            isMine={myIds.has(seatTip.seat.id)}
            allDayBookings={allDayBookings}
          />
        </PortalTooltip>
      )}

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

/* ───────── Section Pills ───────── */
function SectionPills({
  lanes, onClick, highlightedId, seatsByLane, bookedIds,
}: {
  lanes: LaneSpec[]
  onClick: (laneId: string) => void
  highlightedId: string | null
  seatsByLane: Record<string, Seat[]>
  bookedIds: Set<string>
}) {
  const { theme: pillTheme } = useTheme()
  return (
    <div style={{
      padding: '6px 16px',
      display: 'flex',
      gap: 5,
      alignItems: 'center',
      overflowX: 'auto',
      background: 'var(--surface-1)',
      borderTop: '1px solid var(--card-border)',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-300)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Sections:</span>
      {lanes.map(lane => {
        const ss = seatsByLane[lane.id] || []
        const avail = ss.filter(s => !bookedIds.has(s.id) && s.is_active).length
        const active = highlightedId === lane.id
        return (
          <button
            key={lane.id}
            onClick={() => onClick(lane.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 99,
              border: `1.5px solid ${active ? lane.accentColor : '#e2e8f0'}`,
              background: active ? (pillTheme === 'dark' ? lane.darkBgColor : lane.bgColor) : 'var(--card-bg)',
              color: active ? 'var(--ink-900)' : 'var(--muted)',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
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

function Legend() {
  const items = [
    { label: 'Available', bg: '#22c55e', border: '#15803d' },
    { label: 'Occupied', bg: '#ef4444', border: '#b91c1c' },
    { label: 'Mine', bg: '#7c3aed', border: '#5b21b6' },
    { label: 'Inactive', bg: '#cbd5e1', border: '#94a3b8' },
  ]
  return (
    <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-900)' }}>Legend</span>
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: it.bg, border: `1.5px solid ${it.border}` }} />
          {it.label}
        </div>
      ))}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

/* ───────── Lane card ───────── */
function LaneCard({
  lane, dbSeatsForLane, bookedIds, myIds, loading, compact = false, highlighted = false, cardRef,
  onSeatHover, onSeatLeave,
}: {
  lane: LaneSpec
  dbSeatsForLane: Seat[]
  bookedIds: Set<string>
  myIds: Set<string>
  loading: boolean
  compact?: boolean
  highlighted?: boolean
  cardRef?: (el: HTMLDivElement | null) => void
  onSeatHover: (seat: Seat, x: number, y: number) => void
  onSeatLeave: () => void
}) {
  const CELL = compact ? 18 : 22
  const HEADER_H = compact ? 14 : 18
  const { theme } = useTheme()
  const cardBg = theme === 'dark' ? lane.darkBgColor : lane.bgColor

  const { cells, maxRows, seatCount } = useMemo(() => buildLaneCells(lane), [lane])
  const dbSeats = dbSeatsForLane  // may have fewer than seatCount; rest render as inactive placeholders
  const dbSeatCount = dbSeats.length
  const isShortByDb = dbSeatCount > 0 && dbSeatCount < seatCount

  let av = 0, oc = 0, mn = 0, ia = 0
  for (const cell of cells) {
    if (cell.kind !== 'seat') continue
    const seat = dbSeats[cell.dbSeatIndex] ?? null
    if (!seat) continue  // skip missing DB cells from stats
    if (!seat.is_active) ia++
    else if (myIds.has(seat.id)) mn++
    else if (bookedIds.has(seat.id)) oc++
    else av++
  }

  return (
    <div
      ref={cardRef}
      className={highlighted ? 'seat-card-highlighted' : ''}
      style={{
        background: 'var(--card-bg)',
        border: '1.5px solid var(--card-border)',
        borderRadius: 12,
        marginBottom: 18,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        scrollMarginTop: 130,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: lane.accentColor }} />

      <div style={{ padding: compact ? '14px 18px 10px' : '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{ width: compact ? 30 : 32, height: compact ? 30 : 32, borderRadius: 8, background: cardBg, color: lane.accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 15 : 16 }}
            {...(lane.iconIsSvg ? { dangerouslySetInnerHTML: { __html: lane.icon } } : {})}
          >
            {lane.iconIsSvg ? null : lane.icon}
          </div>
          <div>
            <div style={{ fontSize: compact ? 14 : 15, fontWeight: 800, color: 'var(--ink-900)', lineHeight: 1.1 }}>{lane.title}</div>
            <div style={{ fontSize: compact ? 10.5 : 11, color: 'var(--muted)', marginTop: 2 }}>{lane.subtitle}</div>
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

      <div style={{ padding: compact ? '14px 18px 16px' : '16px 20px 18px', overflowX: 'auto', overflowY: 'hidden', flex: 1 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--ink-300)', padding: 20 }}>Loading…</div>
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
                  if (cell.kind === 'col-header') return <div key={idx} />
                  if (cell.kind === 'row-header') return <div key={idx} />
                  if (cell.kind === 'empty') {
                    return <div key={idx} style={{ gridColumn: cell.col + 1, gridRow: cell.visualRow + 1 }} />
                  }
                  const seat = dbSeats[cell.dbSeatIndex] ?? null
                  if (!seat) {
                    // Spec cell with no DB seat behind it — dashed placeholder
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
                  let bg = '#22c55e', bd = '#15803d'
                  if (!seat.is_active) { bg = '#cbd5e1'; bd = '#94a3b8' }
                  else if (myIds.has(seat.id)) { bg = '#7c3aed'; bd = '#5b21b6' }
                  else if (bookedIds.has(seat.id)) { bg = '#ef4444'; bd = '#b91c1c' }
                  const labelText = seat.seat_number || cell.cellId
                  return (
                    <div
                      key={idx}
                      title={labelText}
                      onMouseEnter={e => onSeatHover(seat, e.clientX, e.clientY)}
                      onMouseMove={e => onSeatHover(seat, e.clientX, e.clientY)}
                      onMouseLeave={onSeatLeave}
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
                        transition: 'transform 0.1s ease',
                        cursor: 'pointer',
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
      <span style={{ width: 6.5, height: 6.5, borderRadius: '50%', background: dot }} />
      {label}
    </span>
  )
}
