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
import { LANES, BIG_GROUPS, buildLaneCells, getLaneName, type LaneSpec, type LaneGroup } from '../lib/seat-grid'

// ─── Time overlap helper ───────────────────────────────────────────────────
// Converts "HH:MM:SS" or "HH:MM" to minutes since midnight
function toMins(t: string): number {
  const parts = t.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0')
}

// Does a booking overlap a selected time window?
// Handles overnight bookings (is_overnight=true) and overnight windows (endTime < startTime).
function bookingOverlapsWindow(b: Booking, viewDate: string, winStart: string, winEnd: string): boolean {
  const winStartM = toMins(winStart)
  const winEndM   = toMins(winEnd)
  const bStartM   = toMins(b.start_time)
  const bEndM     = toMins(b.end_time)

  const winIsOvernight = winEndM < winStartM    // e.g. 23:00→07:00
  const bIsOvernight   = b.is_overnight         // from DB column

  // Normalise to intervals on a 0-1440 (midnight) axis by expanding overnight ranges
  // Window interval (absolute minutes):
  const wS = winStartM
  const wE = winIsOvernight ? winEndM + 1440 : winEndM

  // Booking starts on booking_date. If booking_date === viewDate, it starts at bStartM.
  // If booking is overnight and end_date === viewDate (started yesterday), 
  // treat it as starting at 0 (already handled by fetching end_date=viewDate rows).
  let bS: number, bE: number
  if (b.booking_date === viewDate) {
    bS = bStartM
    bE = bIsOvernight ? bEndM + 1440 : bEndM
  } else {
    // This booking started on a previous day (overnight, end_date = viewDate)
    bS = 0          // treat as starting at 00:00 on viewDate
    bE = bEndM      // ends at end_time on viewDate
  }

  // Standard interval overlap: A overlaps B iff A.start < B.end AND A.end > B.start
  return bS < wE && bE > wS
}

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
function SeatTip({ seat, lane, windowBooked, isMine, allDayBookings, isAdmin, roomNames }: {
  seat: Seat
  lane: LaneSpec | undefined
  windowBooked: boolean
  isMine: boolean
  allDayBookings: Booking[]
  isAdmin: boolean
  roomNames: Record<number, string>
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
        {lane ? getLaneName(lane, roomNames) : 'Unknown'}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: statusColor, marginBottom: freeFrom ? 6 : 8 }}>{statusLabel}</div>
      {isInactive && seat.notes && <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>📝 {seat.notes}</div>}
      {freeFrom && <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {freeFrom}</div>}
      {(isAdmin || isMine) && currentBk && (currentBk as any).booked_for && (() => {
        const bf: string = (currentBk as any).booked_for
        const match = bf.match(/^(.+?)\s*\[(.+?)\]$/)
        const name = match ? match[1] : bf
        const empId = match ? match[2] : null
        return (
          <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>👤 {name}</span>
            {isAdmin && empId && <span style={{ fontFamily: 'monospace', color: '#7dd3fc', fontSize: 10, paddingLeft: 16 }}>EMP ID: {empId}</span>}
          </div>
        )
      })()}
      {seatBks.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Today</div>
          {seatBks.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#fca5a5', marginBottom: 3 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
              {isAdmin && (b as any).booked_for && <span style={{ color: '#93c5fd', marginLeft: 4 }}>· {(b as any).booked_for}</span>}
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
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const today = new Date().toLocaleDateString('en-CA')
  const initStart = getCurrentTimeSlot()
  const initEnd = getDefaultEndTime(initStart)

  // All hooks declared first — before any conditional returns
  const [seats, setSeats] = useState<Seat[]>([])
  const [rooms, setRooms] = useState<Record<number, string>>({})
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

  // Fetch seats and rooms once when user loads
  // Bookings are fetched by the date/time useEffect below (which also runs on mount)
  // Using a seatsReady flag so the grid stays in loading state until bookings also arrive
  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      supabase.from('seats').select('*').order('seat_number'),
      supabase.from('room').select('id, name'),
    ]).then(([seatsRes, roomsRes]) => {
      if (seatsRes.data) setSeats(seatsRes.data as Seat[])
      if (roomsRes.data) {
        const map: Record<number, string> = {}
        roomsRes.data.forEach((r: { id: number; name: string }) => { map[r.id] = r.name })
        setRooms(map)
      }
      // Don't set loading=false here — let the booking fetch do it
    })
  }, [user])

  // Single source of truth for bookings — runs on mount AND whenever time window changes
  // Uses booking_date/end_date for simple querying + time comparison in JS for window overlap
  useEffect(() => {
    if (!user) return

    // For the selected window, a booking overlaps if:
    //   its date range covers today AND its time range overlaps our window
    // We fetch all bookings whose date range includes the selected date,
    // then filter in JS for time overlap — this avoids all timestamp comparison issues.
    const isNightWindow = endTime < startTime  // e.g. 23:00 → 07:00

    Promise.all([
      // Bookings starting on this date
      supabase.from('bookings').select('*').eq('status', 'active').eq('booking_date', date),
      // Overnight bookings that STARTED yesterday and end today
      // (their end_date = today)
      supabase.from('bookings').select('*').eq('status', 'active').eq('end_date', date).eq('is_overnight', true),
    ]).then(([startRes, endRes]) => {
      const startDay = (startRes.data ?? []) as Booking[]
      const endDay   = (endRes.data ?? []) as Booking[]

      // Merge + deduplicate
      const seen = new Set<string>()
      const all = [...startDay, ...endDay].filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true })

      // Filter to only bookings that overlap our selected time window
      const overlapping = all.filter(b => bookingOverlapsWindow(b, date, startTime, endTime))

      setBookings(overlapping)
      setAllDayBookings(all)
      setLoading(false)
    })
  }, [date, startTime, endTime, user])

  // Refetch rooms when user returns to this tab (e.g. after renaming in admin)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        supabase.from('room').select('id, name').then(({ data }: { data: { id: number; name: string }[] | null }) => {
          if (data) {
            const map: Record<number, string> = {}
            data.forEach((r: { id: number; name: string }) => { map[r.id] = r.name })
            setRooms(map)
          }
        })
        fetchBookings()
        fetchAllDay()
      }
    }
    const handleFocus = () => { if (user) { fetchBookings(); fetchAllDay() } }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user, date, startTime, endTime])

  async function fetchSeats() {
    setLoading(true)
    const [seatsRes, roomsRes] = await Promise.all([
      supabase.from('seats').select('*').order('seat_number'),
      supabase.from('room').select('id, name'),
    ])
    if (seatsRes.data) setSeats(seatsRes.data as Seat[])
    if (roomsRes.data) {
      const map: Record<number, string> = {}
      roomsRes.data.forEach((r: { id: number; name: string }) => { map[r.id] = r.name })
      setRooms(map)
    }
    setLoading(false)
  }

  async function fetchBookings() {
    setRefreshing(true)
    const [startRes, endRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('status', 'active').eq('booking_date', date),
      supabase.from('bookings').select('*').eq('status', 'active').eq('end_date', date).eq('is_overnight', true),
    ])
    const seen = new Set<string>()
    const all = [...(startRes.data ?? []), ...(endRes.data ?? [])] as Booking[]
    const deduped = all.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true })
    const overlapping = deduped.filter(b => bookingOverlapsWindow(b, date, startTime, endTime))
    setBookings(overlapping)
    setAllDayBookings(deduped)
    setRefreshing(false)
  }

  async function fetchAllDay() {
    // All bookings that touch this calendar date
    const dayStart = `${date}T00:00:00`
    const dayEnd   = `${date}T23:59:59`
    const { data } = await supabase.from('bookings').select('*')
      .eq('status', 'active')
      .lt('start_ts', dayEnd)
      .gt('end_ts', dayStart)
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
  // Map room.id → room.name from DB — used to override hardcoded lane titles
  const roomNames = useMemo<Record<number, string>>(() => {
    const m: Record<number, string> = {}
    Object.entries(rooms).forEach(([id, name]) => { m[Number(id)] = name })
    return m
  }, [rooms])
  const myIds = useMemo(
    () => new Set(bookings.filter(b => b.user_id === user?.id).map(b => b.seat_id)),
    [bookings, user]
  )

  const seatsByLane: Record<string, Seat[]> = useMemo(() => {
    const result: Record<string, Seat[]> = {}
    LANES.forEach(lane => {
      result[lane.id] = seats.filter(s => s.room_id != null && lane.roomId != null && s.room_id === lane.roomId)
    })
    return result
  }, [seats, rooms])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchSeats(), fetchBookings(), fetchAllDay()])
    setRefreshing(false)
  }

  const lanesByGroup = useMemo(() => {
    const m: Record<LaneGroup, LaneSpec[]> = {
      'top-left': [], 'top-hr': [], 'top-th': [], 'cafeteria': [],
      'training': [], 'rooms': [], 'booth': [],
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
      roomNames={roomNames}
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
            <div
              onClick={() => { const el = document.querySelector<HTMLInputElement>('.date-picker-input'); el?.showPicker?.() }}
              style={{ display: 'flex', alignItems: 'center', background: 'var(--muted-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
            >
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="date-picker-input"
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

        <SectionPills lanes={LANES} onClick={handlePillClick} highlightedId={highlightedLaneId} seatsByLane={seatsByLane} bookedIds={bookedIds} roomNames={roomNames} />
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

      </div>

      {seatTip && (
        <PortalTooltip x={seatTip.x} y={seatTip.y}>
          <SeatTip
            seat={seatTip.seat}
            lane={LANES.find(l => l.roomId != null && l.roomId === seatTip.seat.room_id)}
            windowBooked={bookedIds.has(seatTip.seat.id)}
            isMine={myIds.has(seatTip.seat.id)}
            allDayBookings={allDayBookings}
            isAdmin={profile?.role === 'admin'}
            roomNames={roomNames}
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
  lanes, onClick, highlightedId, seatsByLane, bookedIds, roomNames,
}: {
  lanes: LaneSpec[]
  onClick: (laneId: string) => void
  highlightedId: string | null
  seatsByLane: Record<string, Seat[]>
  bookedIds: Set<string>
  roomNames: Record<number, string>
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
  onSeatHover, onSeatLeave, roomNames,
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
  roomNames: Record<number, string>
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
        scrollMarginTop: 200,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: lane.accentColor }} />

      <div style={{ padding: compact ? '14px 18px 10px' : '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{ width: compact ? 30 : 32, height: compact ? 30 : 32, borderRadius: 8, background: cardBg, color: lane.accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 15 : 16, flexShrink: 0 }}
            {...(lane.iconIsSvg ? { dangerouslySetInnerHTML: { __html: lane.icon } } : {})}
          >
            {lane.iconIsSvg ? null : lane.icon}
          </div>
          <div>
            <div style={{ fontSize: compact ? 14 : 15, fontWeight: 800, color: 'var(--ink-900)', lineHeight: 1.1 }}>{getLaneName(lane, roomNames)}</div>
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
