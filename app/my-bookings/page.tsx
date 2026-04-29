'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, Clock, Apple, Monitor, CheckCircle2,
  XCircle, AlertTriangle, Trash2, X, ChevronRight,
  ClipboardList, Moon, Lock
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { FLOOR_SECTIONS, OS_META, getSectionMeta, buildRoomMap } from '../types'
import type { Booking, Seat, OsType, Room, RoomMap } from '../types'

type BFull = Booking & { seat: Seat }

function sectionEmoji(id: string) {
  if (id.includes('server'))       return '🖥️'
  if (id.includes('town-hall-l'))  return '🏢'
  if (id.includes('hr-it'))        return '💼'
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

function CancelDialog({ booking, onConfirm, onClose, loading }: {
  booking: BFull | null; onConfirm: () => void; onClose: () => void; loading: boolean
}) {
  if (!booking) return null
  const sec = FLOOR_SECTIONS.find(s => s.id === booking.seat?.section)
  const [sh, sm] = booking.start_time.split(':').map(Number)
  const [eh, em] = booking.end_time.split(':').map(Number)
  let mins = (eh*60+em)-(sh*60+sm); if(mins<0) mins+=1440
  const dur = mins>=60 ? `${Math.floor(mins/60)}h${mins%60>0?` ${mins%60}m`:''}` : `${mins}m`

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} color="#dc2626" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>Cancel Booking?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>This action cannot be undone</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-300)', padding: 3 }}><X size={16} /></button>
        </div>
        <div style={{ padding: '16px 22px' }}>
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 11, padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: sec?.color||'#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{sectionEmoji(booking.seat?.section||'')}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink-900)', fontFamily: 'monospace', marginBottom: 1 }}>{booking.seat?.seat_number}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sec?.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', background: 'var(--muted-bg)', borderRadius: 9, border: '1px solid var(--card-border)', fontSize: 13, color: 'var(--ink-700)' }}>
              <Calendar size={13} color="#3b82f6" />
              {new Date(booking.booking_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', background: 'var(--muted-bg)', borderRadius: 9, border: '1px solid var(--card-border)', fontSize: 13, color: 'var(--ink-700)' }}>
              <Clock size={13} color="#3b82f6" />{booking.start_time.slice(0,5)} → {booking.end_time.slice(0,5)} <span style={{ color: 'var(--ink-300)' }}>({dur})</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-300)', marginTop: 12, lineHeight: 1.5 }}>Cancelling will release this seat for others to book.</p>
        </div>
        <div style={{ padding: '0 22px 18px', display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--ink-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Keep Booking</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: loading?'#94a3b8':'#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading?'not-allowed':'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={13} />{loading?'Cancelling…':'Yes, Cancel It'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [bookings,     setBookings]     = useState<BFull[]>([])
  const [roomMap,      setRoomMap]      = useState<RoomMap>({})
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<'upcoming'|'past'|'all'>('upcoming')
  const [cancelTarget, setCancelTarget] = useState<BFull | null>(null)
  const [cancelling,   setCancelling]   = useState(false)

  useEffect(() => { if (!authLoading && !user) router.replace('/') }, [user, authLoading])
  useEffect(() => { if (user) { fetchBookings(); fetchRooms() } }, [user])

  async function fetchRooms() {
    const { data } = await supabase.from('room').select('*')
    if (data) setRoomMap(buildRoomMap(data as Room[]))
  }

  async function fetchBookings() {
    setLoading(true)
    const { data } = await supabase.from('bookings').select('*, seat:seats(*)').eq('user_id', user!.id).order('booking_date', { ascending: false }).order('start_time', { ascending: false })
    if (data) setBookings(data as BFull[])
    setLoading(false)
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', cancelTarget.id)
    await fetchBookings()
    setCancelling(false); setCancelTarget(null)
  }

  const today = new Date().toISOString().split('T')[0]
  const now   = new Date()

  const upcoming = bookings.filter(b => b.booking_date >= today && b.status === 'active')
  const past     = bookings.filter(b => b.booking_date < today || b.status === 'cancelled')
  const shown    = filter === 'upcoming' ? upcoming : filter === 'past' ? past : bookings

  const isUpcoming = (b: Booking) => new Date(`${b.booking_date}T${b.end_time}`) > now && b.status === 'active'

  function getDur(b: Booking) {
    const [sh,sm] = b.start_time.split(':').map(Number)
    const [eh,em] = b.end_time.split(':').map(Number)
    let m = (eh*60+em)-(sh*60+sm); if(m<0) m+=1440
    return m>=60 ? `${Math.floor(m/60)}h${m%60>0?` ${m%60}m`:''}` : `${m}m`
  }

  return (
    <div style={{ background: 'var(--muted-bg)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)', padding: '22px 24px 0' }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-900)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 9 }}><ClipboardList size={21} color="#2563eb" /> My Bookings</h1>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Manage your workspace reservations</p>
            </div>
            <Link href="/book" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 9, background: '#1e3a5f', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <ChevronRight size={14} /> New Booking
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11, marginBottom: 16 }}>
            {[
              { label: 'Upcoming',       value: loading?'—':upcoming.length, color:'#15803d', bg:'#f0fdf4', border:'#bbf7d0' },
              { label: 'Active Total',   value: loading?'—':bookings.filter(b=>b.status==='active').length, color:'#1e3a5f', bg:'#eff6ff', border:'#bfdbfe' },
              { label: 'Past/Cancelled', value: loading?'—':past.length, color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' },
            ].map(s => (
              <div key={s.label} style={{ padding: '13px 16px', background: s.bg, borderRadius: 11, border: `1px solid ${s.border}` }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex' }}>
            {([
              { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
              { id: 'past',     label: `Past & Cancelled (${past.length})` },
              { id: 'all',      label: `All (${bookings.length})` },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setFilter(tab.id)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: filter===tab.id?700:400, fontFamily: 'inherit', color: filter===tab.id?'#2563eb':'#64748b', borderBottom: `2.5px solid ${filter===tab.id?'#2563eb':'transparent'}`, marginBottom: -1, transition: 'all 0.15s' }}>{tab.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', padding: '18px 24px' }}>
        {loading ? (
          [1,2,3].map(i => <div key={i} style={{ height: 88, borderRadius: 13, background: 'var(--page-bg)', marginBottom: 9 }} />)
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 24px', background: 'var(--card-bg)', borderRadius: 15, border: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>{filter==='upcoming'?'📅':'📋'}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 7, color: 'var(--ink-900)' }}>{filter==='upcoming'?'No upcoming bookings':'No bookings found'}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-300)', marginBottom: 20 }}>Book a seat to get started.</div>
            <Link href="/book" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 20px', borderRadius: 9, background: '#1e3a5f', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Book a seat →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {shown.map(b => {
              const sec = FLOOR_SECTIONS.find(s => s.id === b.seat?.section)
              const dur = getDur(b)
              const upcoming = isUpcoming(b)
              const os = b.seat?.os_type as OsType | undefined

              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--card-bg)', border: `1.5px solid ${b.status==='cancelled'?'#f1f5f9':'#e2e8f0'}`, borderRadius: 13, padding: '14px 18px', opacity: b.status==='cancelled'?0.65:1, boxShadow: b.status==='active'?'0 1px 4px rgba(0,0,0,0.04)':'none' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 11, background: sec?.color||'#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0, border: `1px solid ${sec?.accent||'#e2e8f0'}22` }}>
                    {sectionEmoji(b.seat?.section||'')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-900)', fontFamily: 'monospace' }}>{b.seat?.seat_number}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: b.status==='active'?'#dcfce7':'#f1f5f9', color: b.status==='active'?'#15803d':'#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {b.status==='active'?<CheckCircle2 size={9}/>:<XCircle size={9}/>}
                        {b.status==='active'?'Active':'Cancelled'}
                      </span>
                      {os && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: OS_META[os].bg, color: OS_META[os].color }}>{OS_META[os].label}</span>}
                      {b.seat?.machine_number != null && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>Machine #{b.seat.machine_number}</span>}
                      {parseInt(dur)>6||dur.includes('h')&&parseInt(dur.split('h')[0])>=6 ? <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', gap: 3 }}><Moon size={9}/>Extended</span> : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10}/>{new Date(b.booking_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</span>
                      <span style={{ color: '#e2e8f0' }}>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10}/>{b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}</span>
                      <span style={{ color: '#e2e8f0' }}>·</span>
                      <span style={{ color: 'var(--ink-300)' }}>{dur}</span>
                      <span style={{ color: '#e2e8f0' }}>·</span>
                      <span style={{ color: 'var(--ink-300)' }}>{(b.seat?.room_id ? roomMap[b.seat.room_id]?.name : null) || sec?.label || b.seat?.section}</span>
                    </div>
                  </div>
                  {upcoming && (
                    <button onClick={() => setCancelTarget(b)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      <Trash2 size={12} /> Cancel
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CancelDialog booking={cancelTarget} onConfirm={handleCancel} onClose={() => setCancelTarget(null)} loading={cancelling} />
    </div>
  )
}
