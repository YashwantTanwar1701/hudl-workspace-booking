'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Apple, Monitor, Eye, ChevronRight, RefreshCw } from 'lucide-react'
import ShiftPicker from '../components/ShiftPicker'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { FLOOR_SECTIONS, ALL_TIME_SLOTS, OS_META, getCurrentTimeSlot, getDefaultEndTime, getSectionMeta, buildRoomMap, roomNameFromMap } from '../types'
import type { Seat, Booking, OsType, Room, RoomMap } from '../types'

/* ─── helpers ─── */
function OsIcon({ os, size = 12 }: { os: OsType; size?: number }) {
  if (os === 'mac') return <Apple size={size} />
  if (os === 'windows') return <Monitor size={size} />
  return <span style={{ fontSize: size, lineHeight: 1 }}>🪑</span>
}

function sectionEmoji(id: string): string {
  if (id.includes('server'))      return '🖥️'
  if (id.includes('town-hall-lane')) return '🏢'
  if (id.includes('hr-it-lane'))  return '💼'
  if (id.includes('hr-ops'))      return '⚙️'
  if (id.includes('2s-'))         return '📟'
  if (id.includes('training'))    return '📚'
  if (id.includes('1s-'))         return '📞'
  if (id.includes('wellness'))    return '🧘'
  if (id.includes('conference'))  return '🏛️'
  if (id.includes('meeting'))     return '🤝'
  if (id.includes('product'))     return '🚀'
  if (id.includes('cafeteria'))   return '☕'
  return '💡'
}

/* ─── Blueprint grid layout matching actual floor plan ─── */
const BLUEPRINT = [
  // Top: large lanes
  { id: 'town-hall-lane',    col: 9,  row: 1,  cs: 8,  rs: 8,  label: 'Town Hall\nLane' },
  { id: 'server-room-lane',  col: 1,  row: 1,  cs: 8,  rs: 8,  label: 'Server\nRoom Lane' },
  { id: 'hr-it-lane',        col: 17, row: 1,  cs: 6,  rs: 8,  label: 'HR/IT\nRoom Lane' },
  // Right side: HR room + cafeteria
  { id: 'hr-ops-it',         col: 23, row: 1,  cs: 3,  rs: 4,  label: 'HR/OPS\n/IT' },
  { id: 'cafeteria-zone',    col: 23, row: 5,  cs: 3,  rs: 7,  label: 'Cafeteria\nZone' },
  // Middle row: booths + product
  { id: 'phone-booth-2s-1',  col: 1,  row: 9,  cs: 2,  rs: 2,  label: 'Booth\n2S-1' },
  { id: 'phone-booth-2s-2',  col: 3,  row: 9,  cs: 2,  rs: 2,  label: 'Booth\n2S-2' },
  { id: 'phone-booth-2s-3',  col: 5,  row: 9,  cs: 2,  rs: 2,  label: 'Booth\n2S-3' },
  { id: 'phone-booth-1s-1',  col: 7,  row: 9,  cs: 2,  rs: 2,  label: 'Booth\n1-A' },
  { id: 'phone-booth-1s-2',  col: 9,  row: 9,  cs: 2,  rs: 2,  label: 'Booth\n1-B' },
  { id: 'phone-booth-1s-3',  col: 11, row: 9,  cs: 2,  rs: 2,  label: 'Booth\n1-C' },
  { id: 'wellness-room',     col: 13, row: 9,  cs: 3,  rs: 2,  label: 'Wellness\nRoom' },
  { id: 'product-team',      col: 16, row: 9,  cs: 4,  rs: 4,  label: 'Product\nTeam' },
  { id: 'conference-12pax',  col: 20, row: 9,  cs: 3,  rs: 4,  label: '12 PAX\nConf' },
  // Bottom: training rooms + meeting rooms
  { id: 'training-room-1',   col: 1,  row: 11, cs: 5,  rs: 5,  label: 'Training\nRoom 1' },
  { id: 'training-room-2',   col: 6,  row: 11, cs: 5,  rs: 5,  label: 'Training\nRoom 2' },
  { id: 'training-room-3',   col: 11, row: 11, cs: 5,  rs: 5,  label: 'Training\nRoom 3' },
  { id: 'meeting-4pax-1',    col: 16, row: 13, cs: 2,  rs: 3,  label: 'Mtg\n4-1' },
  { id: 'meeting-4pax-2',    col: 18, row: 13, cs: 2,  rs: 3,  label: 'Mtg\n4-2' },
  { id: 'meeting-4pax-3',    col: 20, row: 13, cs: 2,  rs: 3,  label: 'Mtg\n4-3' },
] as const

/* ─── Portal Tooltip ─── */
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

/* ─── Seat Tooltip ─── */
function SeatTip({ seat, windowBooked, isMine, allDayBookings }: {
  seat: Seat; windowBooked: boolean; isMine: boolean; allDayBookings: Booking[]
}) {
  const sec = FLOOR_SECTIONS.find(s => s.id === seat.section)
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
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>{sectionEmoji(seat.section ?? '')} {sec?.label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: statusColor, marginBottom: freeFrom ? 6 : 8 }}>{statusLabel}</div>
      {isInactive && seat.notes && <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>📝 {seat.notes}</div>}
      {freeFrom && <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {freeFrom}</div>}
      {seatBks.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Today</div>
          {seatBks.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#fca5a5', marginBottom: 3 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 11 }}>
        <OsIcon os={seat.os_type} size={11} />
        {OS_META[seat.os_type].label}
        {seat.machine_number != null && <span style={{ marginLeft: 4 }}>· #{seat.machine_number}</span>}
      </div>
    </div>
  )
}

/* ─── Section Tooltip ─── */
function SecTip({ sectionId, seats, bookedIds }: { sectionId: string; seats: Seat[]; bookedIds: Set<string> }) {
  const sec = FLOOR_SECTIONS.find(s => s.id === sectionId)
  if (!sec) return null
  const avail = seats.filter(s => !bookedIds.has(s.id) && s.is_active).length
  const pct = seats.length > 0 ? avail / seats.length : 1
  const osCounts: Record<string, number> = {}
  seats.forEach(s => { osCounts[s.os_type] = (osCounts[s.os_type] ?? 0) + 1 })
  return (
    <div style={{ background: '#0f172a', color: '#fff', borderRadius: 12, padding: '13px 15px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{sectionEmoji(sectionId)} {sec.label}</div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 10 }}>{sec.description}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: '#86efac', fontWeight: 600 }}>{avail} available</span>
        <span style={{ color: '#64748b' }}>{seats.length} total</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: pct === 0 ? '#ef4444' : pct < 0.35 ? '#f59e0b' : '#22c55e', borderRadius: 99 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(Object.entries(osCounts) as [string, number][]).filter(([, n]) => n > 0).map(([os, n]) => (
          <div key={os} style={{ fontSize: 10, color: '#94a3b8' }}>{OS_META[os as keyof typeof OS_META]?.label} ×{n}</div>
        ))}
      </div>
    </div>
  )
}

/* ─── Zone Component ─── */
function Zone({ zone, seats, bookedIds, myIds, allDayBookedIds, allDayBookings, onSeatHover, onSeatLeave, onSecHover, onSecLeave, hovSeat }: {
  zone: typeof BLUEPRINT[number]; seats: Seat[]
  bookedIds: Set<string>; myIds: Set<string>; allDayBookedIds: Set<string>
  allDayBookings: Booking[]
  onSeatHover: (s: Seat, x: number, y: number) => void
  onSeatLeave: () => void
  onSecHover: (id: string, x: number, y: number) => void
  onSecLeave: () => void
  hovSeat: string | null
}) {
  const sec = FLOOR_SECTIONS.find(s => s.id === zone.id)
  if (!sec) return null

  // Count only active available seats
  const availInWindow = seats.filter(s => !bookedIds.has(s.id) && s.is_active).length
  const pct = seats.length > 0 ? availInWindow / seats.length : 1
  const headerDot = seats.length === 0 ? '#94a3b8' : pct === 0 ? '#ef4444' : pct < 0.35 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{
      gridColumn: `${zone.col} / span ${zone.cs}`,
      gridRow: `${zone.row} / span ${zone.rs}`,
      background: sec.color, border: `1.5px solid ${sec.accent}55`,
      borderRadius: 8, display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: sec.accent, borderRadius: '6px 6px 0 0', zIndex: 1 }} />

      {/* Header */}
      <div
        onMouseEnter={e => onSecHover(zone.id, e.clientX, e.clientY)}
        onMouseLeave={onSecLeave}
        onMouseMove={e => onSecHover(zone.id, e.clientX, e.clientY)}
        style={{ padding: '9px 8px 4px', zIndex: 2, position: 'relative', cursor: 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
            {zone.label.split('\n').map((l, i) => <span key={i}>{l}{i < zone.label.split('\n').length - 1 && <br />}</span>)}
          </div>
          {seats.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: headerDot }} />
              <span style={{ fontSize: 7.5, fontWeight: 700, color: headerDot }}>{availInWindow}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dots */}
      {seats.length > 0 && (
        <div style={{ padding: '2px 6px 6px', display: 'flex', flexWrap: 'wrap', gap: 3, alignContent: 'flex-start', flex: 1, zIndex: 2 }}>
          {seats.map(seat => {
            // KEY FIX: dot color is based ONLY on the time-window query (bookedIds)
            // not allDayBookedIds — so a seat booked at 10:30 won't show red at 18:00
            const isInactive    = !seat.is_active
            const windowBooked   = bookedIds.has(seat.id)
            const mine           = myIds.has(seat.id)
            const isHov          = hovSeat === seat.id

            const bg = isInactive
              ? '#94a3b8'   // grey — inactive seat
              : mine
              ? '#7c3aed'   // purple — my booking
              : windowBooked
              ? '#ef4444'   // red — occupied this window
              : '#22c55e'   // green — available

            const border = isInactive ? '#64748b' : mine ? '#5b21b6' : windowBooked ? '#b91c1c' : '#15803d'

            return (
              <div
                key={seat.id}
                onMouseEnter={e => onSeatHover(seat, e.clientX, e.clientY)}
                onMouseLeave={onSeatLeave}
                onMouseMove={e => onSeatHover(seat, e.clientX, e.clientY)}
                style={{
                  width: 13, height: 13, borderRadius: 3,
                  background: bg, border: `1.5px solid ${border}`,
                  opacity: isHov ? 1 : 0.85,
                  transform: isHov ? 'scale(1.5)' : 'scale(1)',
                  transition: 'all 0.1s', cursor: 'default', flexShrink: 0,
                  zIndex: isHov ? 10 : 1,
                  boxShadow: isHov ? `0 2px 10px ${bg}aa` : 'none',
                }}
              />
            )
          })}
        </div>
      )}
      {seats.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <span style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center' }}>No seats</span>
        </div>
      )}
    </div>
  )
}

/* ─── Main ─── */
function FloorMapInner() {
  const { user } = useAuth()
  const router = useRouter()
  const today = new Date().toLocaleDateString('en-CA')

  // Default to CURRENT time on page load — key fix
  const initStart = getCurrentTimeSlot()
  const initEnd   = getDefaultEndTime(initStart)

  const [seats,          setSeats]          = useState<Seat[]>([])
  const [roomMap,        setRoomMap]        = useState<RoomMap>({})
  const [bookings,       setBookings]       = useState<Booking[]>([])
  const [allDayBookings, setAllDayBookings] = useState<Booking[]>([])
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [date,           setDate]           = useState(today)
  const [startTime,      setStartTime]      = useState(initStart)
  const [endTime,        setEndTime]        = useState(initEnd)
  const [filterOs,       setFilterOs]       = useState('')
  const [filterSection,  setFilterSection]  = useState('')
  const [seatTip,        setSeatTip]        = useState<{ seat: Seat; x: number; y: number } | null>(null)
  const [secTip,         setSecTip]         = useState<{ id: string; x: number; y: number } | null>(null)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchSeats(); fetchRooms() }, [])
  useEffect(() => { fetchBookings() }, [date, startTime, endTime])
  useEffect(() => { fetchAllDay() }, [date])

  async function fetchSeats() {
    const { data } = await supabase.from('seats').select('*').order('seat_number')
    if (data) setSeats(data as Seat[])
    setLoading(false)
  }

  async function fetchRooms() {
    const { data } = await supabase.from('room').select('*')
    if (data) setRoomMap(buildRoomMap(data as Room[]))
  }

  async function fetchBookings() {
    setRefreshing(true)
    // CORRECT overlap query: strictly between window start and end
    // A booking 10:30-18:00 will NOT show as occupied when window is 18:00-20:00
    const { data } = await supabase.from('bookings').select('*')
      .eq('booking_date', date).eq('status', 'active')
      .lt('start_ts', `${date}T${endTime}:00`)
      .gt('end_ts',   `${date}T${startTime}:00`)
    if (data) setBookings(data as Booking[])
    setRefreshing(false)
  }

  async function fetchAllDay() {
    const { data } = await supabase.from('bookings').select('*').eq('booking_date', date).eq('status', 'active')
    if (data) setAllDayBookings(data as Booking[])
  }

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchBookings(), fetchAllDay()])
    setRefreshing(false)
  }

  // IMPORTANT: bookedIds comes ONLY from time-window query — not allDay
  const bookedIds       = new Set(bookings.map(b => b.seat_id))
  const allDayBookedIds = new Set(allDayBookings.map(b => b.seat_id))
  const myIds           = new Set(bookings.filter(b => b.user_id === user?.id).map(b => b.seat_id))

  const filteredSeats = (id: string) => seats.filter(s => s.section === id && (!filterOs || s.os_type === filterOs))

  const totalBooked = seats.filter(s => bookedIds.has(s.id)).length
  const totalAvail  = seats.filter(s => !bookedIds.has(s.id) && s.is_active).length

  const onSeatHover = useCallback((seat: Seat, x: number, y: number) => {
    if (tipTimer.current) clearTimeout(tipTimer.current)
    setSecTip(null); setSeatTip({ seat, x, y })
  }, [])
  const onSeatLeave = useCallback(() => { tipTimer.current = setTimeout(() => setSeatTip(null), 80) }, [])
  const onSecHover  = useCallback((id: string, x: number, y: number) => {
    if (tipTimer.current) clearTimeout(tipTimer.current)
    setSeatTip(null); setSecTip({ id, x, y })
  }, [])
  const onSecLeave  = useCallback(() => { tipTimer.current = setTimeout(() => setSecTip(null), 80) }, [])


  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', background: '#f1f5f9', overflow: 'hidden' }}>

      {/* ── Row 1: Controls ── */}
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={14} color="#2563eb" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Floor Map</span>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontWeight: 600, border: '1px solid #fde68a' }}>View Only</span>
            <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>· Hover seats for details</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px' }}>
              <Calendar size={12} color="#3b82f6" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }} />
            </div>
            {/* Shift / Time picker */}
            <ShiftPicker
              date={date}
              startTime={startTime} endTime={endTime} isOvernight={false}
              onStartChange={t => { setStartTime(t); setBookings([]) }}
              onEndChange={t => { setEndTime(t); setBookings([]) }}
              onOvernightChange={() => {}}
            />
            {/* OS filter */}
            <div style={{ display: 'flex', gap: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 3 }}>
              {([['', 'All'], ['mac', 'Mac'], ['windows', 'Win'], ['other', 'Seat Only']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilterOs(val)}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: filterOs === val ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', background: filterOs === val ? '#fff' : 'transparent', color: filterOs === val ? '#0f172a' : '#64748b', boxShadow: filterOs === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  {val === 'mac' && <Apple size={10} />}{val === 'windows' && <Monitor size={10} />}{val === 'other' && <span style={{ fontSize: 10 }}>🪑</span>}{label}
                </button>
              ))}
            </div>
            <button onClick={() => router.push('/book')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <ChevronRight size={13} /> Book a Seat
            </button>
            <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1.5px solid #2563eb', background: refreshing ? '#eff6ff' : '#2563eb', color: refreshing ? '#2563eb' : '#fff', fontSize: 12, fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* ── Row 2: Stats + Legend ── */}
        <div style={{ padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          {[
            { label: 'Available', val: loading ? '…' : totalAvail,        dot: '#22c55e', color: '#15803d' },
            { label: 'Occupied',  val: loading ? '…' : totalBooked,       dot: '#ef4444', color: '#991b1b' },
            { label: 'Inactive',  val: loading ? '…' : seats.filter(s => !s.is_active).length, dot: '#94a3b8', color: '#475569' },
            { label: 'Total',     val: loading ? '…' : seats.length,      dot: '#64748b', color: '#374151' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.dot }} />
              <span style={{ fontWeight: 700, color: s.color }}>{s.val}</span>
              <span style={{ color: '#94a3b8' }}>{s.label}</span>
            </div>
          ))}
          <span style={{ color: '#e2e8f0' }}>·</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{date} · {startTime}–{endTime}</span>
          {refreshing && <span style={{ fontSize: 10, color: '#3b82f6' }}>Refreshing…</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {[
              { c: '#22c55e', b: '#15803d', l: 'Available' },
              { c: '#ef4444', b: '#b91c1c', l: 'Occupied' },
              { c: '#7c3aed', b: '#5b21b6', l: 'Mine' },
              { c: '#94a3b8', b: '#64748b', l: 'Inactive' },
            ].map(lg => (
              <div key={lg.l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#475569' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: lg.c, border: `1.5px solid ${lg.b}` }} />
                {lg.l}
              </div>
            ))}
          </div>
        </div>

        {/* ── Row 3: Section pills ── */}
        <div style={{ padding: '6px 16px', display: 'flex', gap: 5, alignItems: 'center', overflowX: 'auto', background: '#fafafa' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Sections:</span>
          <button onClick={() => setFilterSection('')} style={{ padding: '3px 10px', borderRadius: 99, border: `1.5px solid ${filterSection === '' ? '#1e3a5f' : '#e2e8f0'}`, background: filterSection === '' ? '#1e3a5f' : '#fff', color: filterSection === '' ? '#fff' : '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>All</button>
          {FLOOR_SECTIONS.map(sec => {
            const ss = filteredSeats(sec.id)
            const avail = ss.filter(s => !bookedIds.has(s.id) && s.is_active).length
            const active = filterSection === sec.id
            return (
              <button key={sec.id} onClick={() => setFilterSection(active ? '' : sec.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, border: `1.5px solid ${active ? sec.accent : '#e2e8f0'}`, background: active ? sec.color : '#fff', color: active ? '#0f172a' : '#64748b', fontSize: 11, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}>
                {sectionEmoji(sec.id)} {sec.shortLabel}
                {ss.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: avail === 0 ? '#ef4444' : '#15803d' }}>({avail})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Scrollable map ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(25, 1fr)', gridTemplateRows: 'repeat(15, 66px)', gap: 5, background: '#e9ecf0', border: '2px solid #cbd5e1', borderRadius: 14, padding: 8, minWidth: 900 }}>
          {BLUEPRINT.map(zone => {
            if (filterSection && filterSection !== zone.id) {
              return <div key={zone.id} style={{ gridColumn: `${zone.col} / span ${zone.cs}`, gridRow: `${zone.row} / span ${zone.rs}`, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, opacity: 0.2 }} />
            }
            return (
              <Zone key={zone.id} zone={zone} seats={filteredSeats(zone.id)}
                bookedIds={bookedIds} myIds={myIds} allDayBookedIds={allDayBookedIds}
                allDayBookings={allDayBookings}
                onSeatHover={onSeatHover} onSeatLeave={onSeatLeave}
                onSecHover={onSecHover} onSecLeave={onSecLeave}
                hovSeat={seatTip?.seat.id ?? null}
              />
            )
          })}
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
          View only — use <button onClick={() => router.push('/book')} style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', padding: '0 3px' }}>Book Seat</button> to reserve
        </p>
      </div>

      {seatTip && (
        <PortalTooltip x={seatTip.x} y={seatTip.y}>
          <SeatTip seat={seatTip.seat} windowBooked={bookedIds.has(seatTip.seat.id)} isMine={myIds.has(seatTip.seat.id)} allDayBookings={allDayBookings} />
        </PortalTooltip>
      )}
      {secTip && (
        <PortalTooltip x={secTip.x} y={secTip.y}>
          <SecTip sectionId={secTip.id} seats={filteredSeats(secTip.id)} bookedIds={bookedIds} />
        </PortalTooltip>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function FloorMapPage() {
  return <Suspense><FloorMapInner /></Suspense>
}
