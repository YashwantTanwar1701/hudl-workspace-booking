'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Apple, Monitor, Calendar, Clock, Filter, Search,
  ShoppingCart, Trash2, Zap, CheckCircle2, Lock,
  Moon, Info, Users, LayoutGrid, RefreshCw,
  AlertCircle, MapPin, Timer, ChevronDown, ChevronUp,
  X, AlertTriangle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import {
  FLOOR_SECTIONS, ALL_TIME_SLOTS, NIGHT_SLOTS,
  OS_META, getValidStartSlots
} from '../types'
import type { Seat, Booking, OsType } from '../types'

/* ─── helpers ─── */
function OsIconSmall({ os, size = 14 }: { os: OsType; size?: number }) {
  if (os === 'mac') return <Apple size={size} />
  if (os === 'windows') return <Monitor size={size} />
  return <span style={{ fontSize: size - 2, lineHeight: 1 }}>🪑</span>
}

function sectionEmoji(id: string) {
  if (id.includes('server'))       return '🖥️'
  if (id.includes('town-hall-l'))  return '🏢'
  if (id.includes('hr-it-lane'))   return '💼'
  if (id.includes('hr-ops'))       return '⚙️'
  if (id.includes('2s-'))          return '📟'
  if (id.includes('training'))     return '📚'
  if (id.includes('1s-'))          return '📞'
  if (id.includes('wellness'))     return '🧘'
  if (id.includes('conference'))   return '🏛️'
  if (id.includes('meeting'))      return '🤝'
  if (id.includes('product'))      return '🚀'
  if (id.includes('cafeteria'))    return '☕'
  return '💡'
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

/* ─── Seat card ─── */
type SeatState = 'available' | 'booked' | 'selected' | 'mine'

function SeatCard({ seat, state, onClick, bookings = [] }: {
  seat: Seat; state: SeatState; onClick: () => void; bookings?: Booking[]
}) {
  const [hov, setHov] = useState(false)
  const pal: Record<SeatState, { bg: string; border: string; color: string }> = {
    available: { bg: '#f0fdf4', border: '#86efac', color: '#15803d' },
    booked:    { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b' },
    selected:  { bg: '#1e3a5f', border: '#3b82f6', color: '#fff' },
    mine:      { bg: '#f5f3ff', border: '#a78bfa', color: '#5b21b6' },
  }
  const p = pal[state]
  const freeFrom = state === 'booked' ? (() => {
    const bks = bookings.filter(b => b.seat_id === seat.id && b.status === 'active').sort((a,b) => a.start_time.localeCompare(b.start_time))
    return bks.length > 0 ? bks[bks.length - 1].end_time.slice(0, 5) : null
  })() : null

  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <button
        onClick={state !== 'booked' ? onClick : undefined}
        disabled={state === 'booked'}
        style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 3,
          width: 64, height: 64, borderRadius: 10,
          border: `2px solid ${p.border}`, background: p.bg, color: p.color,
          cursor: state === 'booked' ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s', fontFamily: 'inherit',
          opacity: state === 'booked' ? 0.75 : 1,
          transform: state === 'selected' ? 'scale(1.07)' : 'scale(1)',
          boxShadow: state === 'selected' ? '0 4px 14px rgba(30,58,95,0.28)' : 'none',
          pointerEvents: state === 'booked' ? 'none' : 'auto',
        }}
      >
        {state === 'booked' ? <Lock size={13} style={{ opacity: 0.6 }} /> : <OsIconSmall os={seat.os_type} size={14} />}
        <span style={{ fontSize: 8, fontWeight: 800, fontFamily: 'monospace' }}>{seat.seat_number}</span>
        {state === 'selected' && (
          <div style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={10} color="white" />
          </div>
        )}
      </button>
      {hov && state === 'booked' && (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div style={{ background: '#0f172a', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <div style={{ color: '#fca5a5', marginBottom: 3 }}>🔴 {seat.seat_number} — Occupied</div>
            {freeFrom && <div style={{ color: '#86efac', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> Free from {freeFrom}</div>}
            <div style={{ color: '#64748b', marginTop: 3, fontSize: 10 }}>{OS_META[seat.os_type].label}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0f172a' }} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Section Panel ─── */
function SectionPanel({ section, seats, bookedIds, myIds, selectedIds, onToggle, collapsed, onCollapse, bookings }: {
  section: typeof FLOOR_SECTIONS[number]; seats: Seat[]
  bookedIds: Set<string>; myIds: Set<string>; selectedIds: Set<string>
  onToggle: (s: Seat) => void; collapsed: boolean; onCollapse: () => void; bookings: Booking[]
}) {
  const avail = seats.filter(s => !bookedIds.has(s.id) && !s.is_locked).length
  const sel   = seats.filter(s => selectedIds.has(s.id)).length
  const pct   = seats.length > 0 ? avail / seats.length : 1
  const fill  = pct === 0 ? '#ef4444' : pct < 0.35 ? '#f59e0b' : '#22c55e'
  const osCounts: Record<string, number> = {}
  seats.forEach(s => { osCounts[s.os_type] = (osCounts[s.os_type] ?? 0) + 1 })

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${sel > 0 ? section.accent : '#e2e8f0'}`, borderRadius: 14, overflow: 'hidden', boxShadow: sel > 0 ? `0 0 0 3px ${section.accent}22` : '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
      <div onClick={onCollapse} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: section.color, cursor: 'pointer', borderBottom: collapsed ? 'none' : `1px solid ${section.accent}33` }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>{sectionEmoji(section.id)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{section.label}</span>
            {sel > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: section.accent, color: '#fff' }}>{sel} selected</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: fill, fontWeight: 600 }}>{avail}/{seats.length} avail</span>
            {(Object.entries(osCounts) as [string,number][]).filter(([,n]) => n > 0).map(([os,n]) => {
              const meta = OS_META[os as OsType] ?? OS_META['other']
              return (
                <span key={os} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: meta.bg, color: meta.color }}>
                  {meta.label} ×{n}
                </span>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <div style={{ width: 72, height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${pct * 100}%`, height: '100%', background: fill, borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{Math.round(pct * 100)}% free</span>
        </div>
        {collapsed ? <ChevronDown size={15} color="#94a3b8" /> : <ChevronUp size={15} color="#94a3b8" />}
      </div>
      {!collapsed && (
        <div style={{ padding: '14px 16px' }}>
          {seats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13 }}>No seats configured</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {seats.map(seat => {
                if (seat.is_locked) return (
                  <div key={seat.id} title="Remote seat — cannot be booked" style={{ width: 64, height: 64, borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, opacity: 0.5 }}>
                    <Lock size={13} color="#94a3b8" />
                    <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#94a3b8' }}>{seat.seat_number}</span>
                  </div>
                )
                const st: SeatState = selectedIds.has(seat.id) ? 'selected' : myIds.has(seat.id) ? 'mine' : bookedIds.has(seat.id) ? 'booked' : 'available'
                return <SeatCard key={seat.id} seat={seat} state={st} onClick={() => onToggle(seat)} bookings={bookings} />
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Confirm Modal ─── */
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
              const sec = FLOOR_SECTIONS.find(s => s.id === seat.section)
              return (
                <div key={seat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: sec?.color ?? '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{sectionEmoji(seat.section ?? '')}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{seat.seat_number}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sec?.shortLabel}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{OS_META[seat.os_type].label}</span>
                </div>
              )
            })}
          </div>
          {error && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '9px 11px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c' }}><AlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />{error}</div>}
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: loading ? '#94a3b8' : '#059669', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={13} />{loading ? 'Booking…' : `Book ${sel.length} Seat${sel.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ─── */
function BookInner() {
  const { user } = useAuth()
  const router   = useRouter()
  const params   = useSearchParams()
  const today    = new Date().toISOString().split('T')[0]

  const [date,          setDate]          = useState<string>(today)
  const [startTime,     setStartTime]     = useState<string>('09:00')
  const [endTime,       setEndTime]       = useState<string>('18:00')
  const [isOvernight,   setIsOvernight]   = useState(false)
  const validStarts    = getValidStartSlots(date)
  const effectiveStart = validStarts.includes(startTime) ? startTime : (validStarts[0] ?? '09:00')
  const endDate        = isOvernight ? addDays(date, 1) : date

  const [seats,         setSeats]         = useState<Seat[]>([])
  const [bookings,      setBookings]       = useState<Booking[]>([])
  const [loadingSeats,  setLoadingSeats]  = useState(true)
  const [loadingBks,    setLoadingBks]    = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [success,       setSuccess]       = useState(false)
  const [error,         setError]         = useState('')
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [filterOs,      setFilterOs]      = useState('')
  const [filterSec,     setFilterSec]     = useState(params.get('section') ?? '')
  const [search,        setSearch]        = useState('')
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [collapsed,     setCollapsed]     = useState<Record<string, boolean>>({})

  useEffect(() => { if (!user) router.push('/auth') }, [user, router])
  useEffect(() => { fetchSeats() }, [])
  useEffect(() => { fetchBookings() }, [date, effectiveStart, endTime, isOvernight])

  async function fetchSeats() {
    const { data } = await supabase.from('seats').select('*').eq('is_active', true).order('seat_number')
    if (data) setSeats(data as Seat[])
    setLoadingSeats(false)
  }

  async function fetchBookings() {
    setLoadingBks(true)
    const q = supabase.from('bookings').select('*').eq('status', 'active')
    const r1 = await q.eq('booking_date', date)
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

  const bookedIds = new Set(bookings.map(b => b.seat_id))
  const myIds     = new Set(bookings.filter(b => b.user_id === user?.id).map(b => b.seat_id))

  const toggleSeat = useCallback((seat: Seat) => {
    if (seat.is_locked) return
    if (bookedIds.has(seat.id) && !myIds.has(seat.id)) return
    setSelectedIds(prev => { const n = new Set(prev); n.has(seat.id) ? n.delete(seat.id) : n.add(seat.id); return n })
  }, [bookedIds, myIds])

  async function handleBook() {
    if (!user || selectedIds.size === 0) return
    if (date === today) {
      const [sh, sm] = effectiveStart.split(':').map(Number)
      const nowM = new Date().getHours() * 60 + new Date().getMinutes()
      if ((sh * 60 + sm) - nowM < 30) { setError('Must book at least 30 min before start time.'); return }
    }
    setSubmitting(true); setError('')
    const sel = seats.filter(s => selectedIds.has(s.id))
    const inserts = sel.flatMap(seat => isOvernight ? [
      { user_id: user.id, seat_id: seat.id, booking_date: date, start_time: effectiveStart + ':00', end_time: '23:59:59', start_ts: `${date}T${effectiveStart}:00`, end_ts: `${date}T23:59:59` },
      { user_id: user.id, seat_id: seat.id, booking_date: endDate, start_time: '00:00:00', end_time: endTime + ':00', start_ts: `${endDate}T00:00:00`, end_ts: `${endDate}T${endTime}:00` },
    ] : [
      { user_id: user.id, seat_id: seat.id, booking_date: date, start_time: effectiveStart + ':00', end_time: endTime + ':00', start_ts: `${date}T${effectiveStart}:00`, end_ts: `${date}T${endTime}:00` },
    ])
    const { error: err } = await supabase.from('bookings').insert(inserts)
    if (err) setError(err.message.includes('overlap') ? 'One or more seats conflict with existing bookings.' : err.message)
    else { setSuccess(true); setConfirmOpen(false); setSelectedIds(new Set()); await fetchBookings() }
    setSubmitting(false)
  }

  const visSections = FLOOR_SECTIONS.filter(s => (!filterSec || s.id === filterSec) && (!search || s.label.toLowerCase().includes(search.toLowerCase())))
  const fSeats      = (id: string) => seats.filter(s => s.section === id && (!filterOs || s.os_type === filterOs))
  const totalAvail  = seats.filter(s => !bookedIds.has(s.id) && !s.is_locked).length
  const dur         = fmtDur(minutesBetween(effectiveStart, endTime, isOvernight))
  const noSlots     = date === today && validStarts.length === 0

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
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 24px 0' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 9 }}>
                <LayoutGrid size={21} color="#2563eb" /> Book a Seat
              </h1>
              <p style={{ color: '#64748b', fontSize: 13 }}>Multi-seat selection · Night shift · 30-min advance required</p>
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
              {noSlots ? 'No slots available today — all remaining slots are within the 30-min booking window. Select a future date.' : 'Seats must be booked at least 30 min before start time. Past slots are hidden.'}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px' }}>
              <Calendar size={12} color="#3b82f6" />
              <input type="date" value={date} min={today} onChange={e => { setDate(e.target.value); setSelectedIds(new Set()) }} style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px' }}>
              <Clock size={12} color="#94a3b8" />
              <select value={effectiveStart} onChange={e => { setStartTime(e.target.value); setSelectedIds(new Set()) }} disabled={noSlots} style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}>
                {validStarts.length === 0 ? <option>No slots</option> : validStarts.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{ color: '#cbd5e1', fontSize: 11 }}>→</span>
              <select value={endTime} onChange={e => { setEndTime(e.target.value); setSelectedIds(new Set()) }} disabled={noSlots} style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}>
                {isOvernight ? NIGHT_SLOTS.map(t => <option key={t} value={t}>{t} (+1)</option>) : ALL_TIME_SLOTS.filter(t => t > effectiveStart).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={() => { setIsOvernight(v => !v); setSelectedIds(new Set()) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${isOvernight ? '#7c3aed' : '#e2e8f0'}`, background: isOvernight ? '#ede9fe' : '#f8fafc', color: isOvernight ? '#7c3aed' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: isOvernight ? 700 : 500, fontFamily: 'inherit' }}>
              <Moon size={12} /> Night Shift {isOvernight && <span style={{ fontSize: 10, opacity: 0.8 }}>→ {endDate}</span>}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', fontSize: 12, fontWeight: 600 }}>
              <Timer size={12} /> {dur}
            </div>
            {/* OS filter */}
            <div style={{ display: 'flex', gap: 2, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 3 }}>
              {([['', 'All'], ['mac', 'Mac'], ['windows', 'Win'], ['other', 'Seat Only']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilterOs(val)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: filterOs === val ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', background: filterOs === val ? '#fff' : 'transparent', color: filterOs === val ? '#0f172a' : '#64748b', boxShadow: filterOs === val ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                  {val === 'mac' && <Apple size={10} />}{val === 'windows' && <Monitor size={10} />}{val === 'other' && <span style={{ fontSize: 10 }}>🪑</span>}{val === '' && <Filter size={10} />}{label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px' }}>
              <MapPin size={11} color="#94a3b8" />
              <select value={filterSec} onChange={e => setFilterSec(e.target.value)} style={{ fontSize: 11, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}>
                <option value="">All Sections</option>
                {FLOOR_SECTIONS.map(s => <option key={s.id} value={s.id}>{s.shortLabel}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 140 }}>
              <Search size={11} color="#94a3b8" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sections…" style={{ fontSize: 12, color: '#374151', background: 'transparent', border: 'none', outline: 'none', width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 288px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
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
            [1,2,3].map(i => <div key={i} style={{ height: 80, borderRadius: 14, background: '#f1f5f9' }} />)
          ) : visSections.map(section => {
            const ss = fSeats(section.id)
            if (ss.length === 0 && filterOs) return null
            return (
              <SectionPanel key={section.id} section={section} seats={ss} bookedIds={bookedIds} myIds={myIds} selectedIds={selectedIds} onToggle={toggleSeat} collapsed={collapsed[section.id] ?? false} onCollapse={() => setCollapsed(p => ({ ...p, [section.id]: !p[section.id] }))} bookings={bookings} />
            )
          })}
        </div>

        {/* Cart sidebar */}
        <div style={{ position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    const sec = FLOOR_SECTIONS.find(s => s.id === seat.section)
                    return (
                      <div key={seat.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: sec?.color ?? '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{sectionEmoji(seat.section ?? '')}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{seat.seat_number}</div>
                          <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec?.shortLabel}</div>
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
                <button onClick={() => { setError(''); setConfirmOpen(true) }} disabled={noSlots} style={{ width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: noSlots ? '#94a3b8' : 'linear-gradient(135deg,#059669,#047857)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: noSlots ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Zap size={14} /> Book {selectedIds.size} Seat{selectedIds.size !== 1 ? 's' : ''}
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
            {FLOOR_SECTIONS.slice(0, 10).map(sec => {
              const ss = seats.filter(s => s.section === sec.id)
              const avail = ss.filter(s => !bookedIds.has(s.id) && !s.is_locked).length
              const pct = ss.length > 0 ? avail / ss.length : 1
              return (
                <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                  <span style={{ fontSize: 10, flex: 1, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.shortLabel}</span>
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

      <ConfirmModal open={confirmOpen} onClose={() => setConfirmOpen(false)} seats={seats} selectedIds={selectedIds} date={date} startTime={effectiveStart} endTime={endTime} isOvernight={isOvernight} endDate={endDate} onConfirm={handleBook} loading={submitting} error={error} />
    </div>
  )
}

export default function BookPage() {
  return <Suspense><BookInner /></Suspense>
}
