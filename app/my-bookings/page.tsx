'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, Clock, Apple, Monitor, CheckCircle2,
  XCircle, AlertTriangle, Trash2, ChevronRight,
  ClipboardList, Moon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { FLOOR_SECTIONS, OS_META, buildRoomMap } from '../types'
import type { Booking, Seat, OsType, Room, RoomMap } from '../types'

type BFull = Booking & { seat: Seat }
type FilterTab = 'today' | 'upcoming' | 'past' | 'cancelled' | 'all'

/* ── Overnight merge helpers ── */
const ROOM_EMOJI: Record<number, string> = {
  1:'🖥️', 2:'🏢', 3:'💼', 4:'⚙️',
  5:'📟', 6:'📟', 7:'📟',
  8:'📚', 9:'📚', 10:'📚',
  11:'📞', 12:'📞', 13:'📞',
  14:'🧘', 15:'🏛️',
  16:'🤝', 17:'🤝', 18:'🤝',
  19:'🚀', 20:'☕', 21:'🪑',
}
function roomEmoji(roomId: number | null | undefined) {
  return roomId ? (ROOM_EMOJI[roomId] || '💡') : '💡'
}

interface DisplayBooking {
  primary: BFull
  secondary?: BFull
  isOvernightPair: boolean
  displayDate: string
  displayStart: string
  displayEnd: string
  displayEndDate: string
}

function mergeOvernightBookings(bookings: BFull[]): DisplayBooking[] {
  // New approach: overnight bookings are stored as a SINGLE row where
  // booking_date = start date, start_time = e.g. 23:00, end_time = e.g. 07:00
  // and end_ts spans into the next calendar day.
  // Detect overnight: end_time <= start_time (e.g. 07:00 <= 23:00)
  // Also handle legacy split rows (23:59 / 00:00) for backward compatibility.

  const sorted = [...bookings].sort((a, b) => {
    if (a.booking_date !== b.booking_date) return b.booking_date.localeCompare(a.booking_date)
    return b.start_time.localeCompare(a.start_time)
  })
  const used = new Set<string>()
  const result: DisplayBooking[] = []

  for (const b of sorted) {
    if (used.has(b.id)) continue

    // Single-row overnight: end_time < start_time (crosses midnight)
    const isSingleOvernight = b.end_time < b.start_time && b.start_time >= '20:00:00'

    if (isSingleOvernight) {
      const d = new Date(b.booking_date + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      const endDate = d.toISOString().slice(0, 10)
      used.add(b.id)
      result.push({ primary: b, isOvernightPair: true, displayDate: b.booking_date, displayStart: b.start_time, displayEnd: b.end_time, displayEndDate: endDate })
      continue
    }

    // Legacy split first-half (23:59 end) — try to find companion 00:00 row
    if ((b.end_time.startsWith('23:59')) && b.status === 'active') {
      const d = new Date(b.booking_date + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      const nextDate = d.toISOString().slice(0, 10)
      const companion = sorted.find(c =>
        !used.has(c.id) && c.id !== b.id &&
        c.seat_id === b.seat_id &&
        c.booking_date === nextDate &&
        c.start_time.startsWith('00:00') &&
        c.status === b.status
      )
      if (companion) {
        used.add(b.id); used.add(companion.id)
        result.push({ primary: b, secondary: companion, isOvernightPair: true, displayDate: b.booking_date, displayStart: b.start_time, displayEnd: companion.end_time, displayEndDate: companion.booking_date })
        continue
      }
    }

    // Skip legacy split second-half rows (00:00 start with 23:59 companion already merged)
    if (b.start_time.startsWith('00:00') && b.status === 'active') {
      const d = new Date(b.booking_date + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      const prevDate = d.toISOString().slice(0, 10)
      const alreadyMerged = result.some(r =>
        r.secondary?.id === b.id ||
        (r.primary.seat_id === b.seat_id && r.displayEndDate === b.booking_date && r.isOvernightPair)
      )
      if (alreadyMerged) { used.add(b.id); continue }
    }

    used.add(b.id)
    result.push({ primary: b, isOvernightPair: false, displayDate: b.booking_date, displayStart: b.start_time, displayEnd: b.end_time, displayEndDate: b.booking_date })
  }
  return result
}

function getDur(d: DisplayBooking) {
  const [sh, sm] = d.displayStart.split(':').map(Number)
  const [eh, em] = d.displayEnd.split(':').map(Number)
  let m = (eh * 60 + em) - (sh * 60 + sm)
  if (m <= 0) m += 1440  // overnight crosses midnight
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}` : `${m}m`
}

/* ── Cancel confirm (single) ── */
function CancelDialog({ booking, onConfirm, onClose, loading }: {
  booking: DisplayBooking | null; onConfirm: () => void; onClose: () => void; loading: boolean
}) {
  if (!booking) return null
  const b = booking.primary
  const sec = FLOOR_SECTIONS.find(s => s.roomId === b.seat?.room_id)
  const dur = getDur(booking)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>Cancel Booking?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>This cannot be undone</div>
          </div>
        </div>
        <div style={{ padding: '14px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10, background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: sec?.color || '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{roomEmoji(b.seat?.room_id)}</div>
            <div>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--ink-900)' }}>{b.seat?.seat_number}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{booking.displayDate} · {booking.displayStart.slice(0,5)}–{booking.displayEnd.slice(0,5)}{booking.isOvernightPair ? ' (+1 day)' : ''} · {dur}</div>
            </div>
          </div>
          {booking.isOvernightPair && <div style={{ marginTop: 10, fontSize: 12, color: '#7c3aed', background: '#faf5ff', padding: '7px 10px', borderRadius: 8, border: '1px solid #e9d5ff' }}>🌙 Both halves of this overnight booking will be cancelled.</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={loading} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-700)' }}>Keep it</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: '#dc2626', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>{loading ? 'Cancelling…' : 'Yes, Cancel'}</button>
        </div>
      </div>
    </div>
  )
}

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [bookings, setBookings] = useState<BFull[]>([])
  const [roomMap,  setRoomMap]  = useState<RoomMap>({})
  const [loading,  setLoading]  = useState(true)

  const [tab,         setTab]         = useState<FilterTab>('upcoming')
  const [cancelTarget, setCancelTarget] = useState<DisplayBooking | null>(null)
  const [cancelling,   setCancelling]   = useState(false)

  // Bulk cancel
  const [selected,         setSelected]         = useState<Set<string>>(new Set())
  const [bulkConfirmOpen,  setBulkConfirmOpen]  = useState(false)
  const [bulkCancelling,   setBulkCancelling]   = useState(false)

  // Date range filters (for upcoming, past, all tabs)
  const today = new Date().toISOString().slice(0, 10)
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo,   setRangeTo]   = useState('')

  useEffect(() => { if (!authLoading && !user) router.replace('/') }, [user, authLoading])
  useEffect(() => { if (user) { fetchBookings(); fetchRooms() } }, [user])

  async function fetchRooms() {
    const { data } = await supabase.from('room').select('*')
    if (data) setRoomMap(buildRoomMap(data as Room[]))
  }

  async function fetchBookings() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, seat:seats(*)')
      .eq('user_id', user!.id)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false })
    if (data) setBookings(data as BFull[])
    setLoading(false)
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', cancelTarget.primary.id)
    if (cancelTarget.isOvernightPair && cancelTarget.secondary) {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', cancelTarget.secondary.id)
    }
    await fetchBookings()
    setCancelling(false); setCancelTarget(null)
  }

  async function handleBulkCancel() {
    setBulkCancelling(true)
    const ids: string[] = []
    for (const primaryId of selected) {
      const d = merged.find(m => m.primary.id === primaryId)
      if (!d) continue
      ids.push(d.primary.id)
      if (d.isOvernightPair && d.secondary) ids.push(d.secondary.id)
    }
    await supabase.from('bookings').update({ status: 'cancelled' }).in('id', ids)
    await fetchBookings()
    setSelected(new Set())
    setBulkConfirmOpen(false)
    setBulkCancelling(false)
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── Derived data ──
  const merged = mergeOvernightBookings(bookings)
  const now    = new Date()

  // Today: active bookings for today that are NOT overnight pairs extending to tomorrow
  // (overnight pairs starting today are shown in Upcoming since they run past midnight)
  const todayBookings     = merged.filter(d => d.primary.booking_date === today && d.primary.status === 'active' && !d.isOvernightPair)
  // Upcoming: future bookings + today's overnight bookings (they need cancellation option)
  const upcomingBookings  = merged.filter(d => d.primary.status === 'active' && (d.primary.booking_date > today || (d.primary.booking_date === today && d.isOvernightPair)))
  // Past: active bookings with past dates (completed)
  const pastBookings      = merged.filter(d => d.primary.booking_date < today  && d.primary.status === 'active')
  const cancelledBookings = merged.filter(d => d.primary.status === 'cancelled')
  const allBookings       = merged

  // Apply date range filter where applicable
  function applyRange(list: DisplayBooking[]) {
    if (!rangeFrom && !rangeTo) return list
    return list.filter(d => {
      if (rangeFrom && d.displayDate < rangeFrom) return false
      if (rangeTo   && d.displayDate > rangeTo)   return false
      return true
    })
  }

  const shownMap: Record<FilterTab, DisplayBooking[]> = {
    today:     todayBookings,
    upcoming:  applyRange(upcomingBookings),
    past:      applyRange(pastBookings),
    cancelled: cancelledBookings,
    all:       applyRange(allBookings),
  }
  const shown = shownMap[tab]

  // Only upcoming active bookings can be selected
  const selectableIds = new Set(upcomingBookings.map(d => d.primary.id))

  const TABS: { id: FilterTab; label: string; count: number; hasRange: boolean }[] = [
    { id: 'today',     label: 'Today',     count: todayBookings.length,     hasRange: false },
    { id: 'upcoming',  label: 'Upcoming',  count: upcomingBookings.length,  hasRange: true  },
    { id: 'past',      label: 'Past',      count: pastBookings.length,      hasRange: true  },
    { id: 'cancelled', label: 'Cancelled', count: cancelledBookings.length, hasRange: false },
    { id: 'all',       label: 'All',       count: allBookings.length,       hasRange: true  },
  ]

  const currentTabHasRange = TABS.find(t => t.id === tab)?.hasRange ?? false

  function switchTab(t: FilterTab) {
    setTab(t)
    setSelected(new Set())
    setRangeFrom('')
    setRangeTo('')
  }

  const inp: React.CSSProperties = {
    padding: '5px 9px', borderRadius: 7, border: '1px solid var(--card-border)',
    fontSize: 12, fontFamily: 'inherit', background: 'var(--muted-bg)',
    color: 'var(--ink-900)', outline: 'none', colorScheme: 'light dark',
  }

  if (authLoading) return null

  return (
    <div style={{ background: 'var(--muted-bg)', minHeight: '100vh' }}>

      {/* ── Sticky header ── */}
      <div style={{ position: 'sticky', top: 60, zIndex: 50, background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '14px 24px 0' }}>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 9 }}>
                <ClipboardList size={20} color="#2563eb" /> My Bookings
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>Manage your workspace reservations</p>
            </div>
            <Link href="/book" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 9, background: '#1e3a5f', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <ChevronRight size={14} /> New Booking
            </Link>
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 14 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => switchTab(t.id)} style={{ padding: '10px 8px', borderRadius: 10, border: `1.5px solid ${tab === t.id ? '#2563eb' : 'var(--card-border)'}`, background: tab === t.id ? '#eff6ff' : 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: tab === t.id ? '#2563eb' : 'var(--ink-900)', lineHeight: 1 }}>{loading ? '—' : t.count}</div>
                <div style={{ fontSize: 11, color: tab === t.id ? '#2563eb' : 'var(--muted)', marginTop: 3, fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</div>
              </button>
            ))}
          </div>

          {/* Tabs + date range row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => switchTab(t.id)} style={{ padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, fontFamily: 'inherit', color: tab === t.id ? '#2563eb' : '#64748b', borderBottom: `2.5px solid ${tab === t.id ? '#2563eb' : 'transparent'}`, marginBottom: -1, whiteSpace: 'nowrap' as const }}>
                  {t.label} ({loading ? '—' : t.count})
                </button>
              ))}
            </div>
            {currentTabHasRange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>From</span>
                <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} style={inp} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>To</span>
                <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} style={inp} />
                {(rangeFrom || rangeTo) && (
                  <button onClick={() => { setRangeFrom(''); setRangeTo('') }} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}>Clear</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 24px' }}>

        {/* Bulk action bar — ONLY on upcoming tab */}
        {tab === 'upcoming' && upcomingBookings.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '9px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, flexWrap: 'wrap' }}>
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === upcomingBookings.length}
              onChange={e => e.target.checked ? setSelected(new Set(upcomingBookings.map(d => d.primary.id))) : setSelected(new Set())}
              ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < upcomingBookings.length }}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#dc2626' }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {selected.size === 0 ? 'Select upcoming bookings to cancel in bulk' : `${selected.size} booking${selected.size !== 1 ? 's' : ''} selected`}
            </span>
            {selected.size > 0 && (
              <>
                <button onClick={() => setBulkConfirmOpen(true)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                  <Trash2 size={12} /> Cancel {selected.size} Selected
                </button>
                <button onClick={() => setSelected(new Set())} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Clear</button>
              </>
            )}
          </div>
        )}

        {/* Booking list */}
        {loading ? (
          [1,2,3].map(i => <div key={i} style={{ height: 80, borderRadius: 13, background: 'var(--card-bg)', marginBottom: 9, border: '1px solid var(--card-border)' }} />)
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 24px', background: 'var(--card-bg)', borderRadius: 15, border: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>
              {tab === 'today' ? '☀️' : tab === 'upcoming' ? '📅' : tab === 'cancelled' ? '✕' : '📋'}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: 'var(--ink-900)' }}>
              {tab === 'today' ? 'No bookings today' : tab === 'upcoming' ? 'No upcoming bookings' : tab === 'cancelled' ? 'No cancelled bookings' : 'No bookings found'}
            </div>
            {(rangeFrom || rangeTo) && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Try adjusting the date range filter</div>}
            {(tab === 'today' || tab === 'upcoming') && (
              <Link href="/book" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 20px', borderRadius: 9, background: '#1e3a5f', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Book a seat →</Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map(d => {
              const b = d.primary
              const sec = FLOOR_SECTIONS.find(s => s.roomId === b.seat?.room_id)
              const dur = getDur(d)
              const isActive = b.status === 'active'
              const isUpcomingActive = isActive && b.booking_date > today
              const isTodayActive   = isActive && b.booking_date === today
              const canCancel = isUpcomingActive || isTodayActive
              const isSelected = selected.has(b.id)
              const os = b.seat?.os_type as OsType | undefined

              return (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--card-bg)',
                  border: `1.5px solid ${isSelected ? '#fca5a5' : b.status === 'cancelled' ? 'var(--card-border)' : 'var(--card-border)'}`,
                  borderRadius: 13, padding: '13px 16px',
                  opacity: b.status === 'cancelled' ? 0.6 : 1,
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                  transition: 'border-color 0.15s',
                }}>
                  {/* Checkbox — only on upcoming active */}
                  {tab === 'upcoming' && isUpcomingActive && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(b.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0, accentColor: '#dc2626' }}
                    />
                  )}

                  {/* Icon */}
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: sec?.color || '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: `1px solid ${sec?.accent || '#e2e8f0'}22` }}>
                    {roomEmoji(b.seat?.room_id)}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-900)', fontFamily: 'monospace' }}>{b.seat?.seat_number}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: isActive ? '#dcfce7' : '#f1f5f9', color: isActive ? '#15803d' : '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {isActive ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                        {isActive ? (isTodayActive ? 'Today' : 'Active') : 'Cancelled'}
                      </span>
                      {os && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: OS_META[os].bg, color: OS_META[os].color }}>{OS_META[os].label}</span>}
                      {b.seat?.machine_number != null && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>Machine #{b.seat.machine_number}</span>}
                      {d.isOvernightPair && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', gap: 3 }}><Moon size={9} />Overnight</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Calendar size={10} />
                        {new Date(d.displayDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {d.isOvernightPair && <span style={{ color: '#7c3aed', marginLeft: 2 }}>→ {new Date(d.displayEndDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                      </span>
                      <span style={{ opacity: 0.3 }}>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} />
                        {d.displayStart.slice(0, 5)}–{d.displayEnd.slice(0, 5)}{d.isOvernightPair ? ' (+1)' : ''}
                      </span>
                      <span style={{ opacity: 0.3 }}>·</span>
                      <span>{dur}</span>
                      <span style={{ opacity: 0.3 }}>·</span>
                      <span>{(b.seat?.room_id ? roomMap[b.seat.room_id]?.name : null) || sec?.label || 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Cancel button — only on active (today or upcoming) */}
                  {canCancel && (
                    <button
                      onClick={() => setCancelTarget(d)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                    >
                      <Trash2 size={12} /> Cancel
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Single cancel dialog */}
      <CancelDialog booking={cancelTarget} onConfirm={handleCancel} onClose={() => setCancelTarget(null)} loading={cancelling} />

      {/* Bulk cancel confirmation dialog */}
      {bulkConfirmOpen && (
        <div onClick={() => !bulkCancelling && setBulkConfirmOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} color="#dc2626" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink-900)' }}>Cancel {selected.size} Booking{selected.size !== 1 ? 's' : ''}?</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>This cannot be undone</div>
              </div>
            </div>
            <div style={{ padding: '14px 22px' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-700)', marginBottom: 10 }}>
                The following <strong>{selected.size} upcoming booking{selected.size !== 1 ? 's' : ''}</strong> will be cancelled:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                {merged.filter(d => selected.has(d.primary.id)).map(d => (
                  <div key={d.primary.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--muted-bg)', fontSize: 12 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--ink-900)' }}>{d.primary.seat?.seat_number}</span>
                    <span style={{ opacity: 0.3 }}>·</span>
                    <span style={{ color: 'var(--muted)' }}>{new Date(d.displayDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span style={{ opacity: 0.3 }}>·</span>
                    <span style={{ color: 'var(--muted)' }}>{d.displayStart.slice(0,5)}–{d.displayEnd.slice(0,5)}{d.isOvernightPair ? ' 🌙' : ''}</span>
                  </div>
                ))}
              </div>
              {merged.filter(d => selected.has(d.primary.id) && d.isOvernightPair).length > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#7c3aed', background: '#faf5ff', padding: '7px 10px', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                  🌙 Overnight bookings will have both halves cancelled automatically.
                </div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
              <button onClick={() => setBulkConfirmOpen(false)} disabled={bulkCancelling} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-700)' }}>
                Keep Bookings
              </button>
              <button onClick={handleBulkCancel} disabled={bulkCancelling} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#dc2626', color: '#fff', cursor: bulkCancelling ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                {bulkCancelling ? 'Cancelling…' : `Cancel ${selected.size} Booking${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
