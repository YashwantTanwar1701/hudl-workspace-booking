'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { FLOOR_SECTIONS, OS_META, getSectionMeta, buildRoomMap } from '../types'
import type { Seat, Booking, UserProfile, OsType, Room, RoomMap } from '../types'

function sectionEmoji(id: string): string {
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

type Tab = 'overview' | 'seats' | 'bookings' | 'users' | 'invite'
type BFull = Booking & { seat: Seat; user: UserProfile }

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'overview',  icon: '📊', label: 'Overview'  },
  { id: 'seats',     icon: '🪑', label: 'Seats'     },
  { id: 'bookings',  icon: '📅', label: 'Bookings'  },
  { id: 'users',     icon: '👥', label: 'Users'     },
  { id: 'invite',    icon: '✉️', label: 'Invite'    },
]

export default function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [initialized, setInitialized] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [seats, setSeats] = useState<Seat[]>([])
  const [roomMap, setRoomMap] = useState<RoomMap>({})
  const [bookings, setBookings] = useState<BFull[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [editSeat, setEditSeat] = useState<Seat | null>(null)
  const [newSeat, setNewSeat] = useState({ seat_number:'', section:'server-room-lane', os_type:'windows' as OsType, has_machine:true, machine_number:'', is_active:true, notes:'', room_id:1 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [seatSearch, setSeatSearch] = useState('')
  const [seatStatusFilter, setSeatStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sectionFilter, setSectionFilter] = useState('all')

  useEffect(() => { if (!authLoading && (!user || profile?.role !== 'admin')) router.push('/floor-map') }, [user, profile, authLoading])
  useEffect(() => {
    if (profile?.role === 'admin' && !initialized) {
      fetchAll()
      setInitialized(true)
    }
  }, [profile, initialized])

  async function fetchAll() {
    setLoading(true)
    const [s, b, u, r] = await Promise.all([
      supabase.from('seats').select('*').order('seat_number'),
      supabase.from('bookings').select('*, seat:seats(*), user:users(*)').order('created_at', { ascending: false }).range(0, 2000),
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('room').select('*'),
    ])
    if (s.data) setSeats(s.data as Seat[])
    if (b.data) setBookings(b.data as BFull[])
    if (u.data) setUsers(u.data as UserProfile[])
    if (r.data) setRoomMap(buildRoomMap(r.data as Room[]))
    setLoading(false)
  }

  async function saveSeat() {
    setSaving(true); setMsg('')
    if (editSeat) {
      const { error } = await supabase.from('seats').update({ ...editSeat }).eq('id', editSeat.id)
      setMsg(error ? error.message : 'Seat updated ✓'); if (!error) setEditSeat(null)
    } else {
      const { error } = await supabase.from('seats').insert({ ...newSeat, machine_number: newSeat.machine_number ? parseInt(newSeat.machine_number) : null })
      if (error) setMsg(error.message)
      else { setMsg('Seat added ✓'); setNewSeat({ seat_number:'', section:'server-room-lane', os_type:'windows', has_machine:true, machine_number:'', is_active:true, notes:'', room_id:1 }) }
    }
    setSaving(false); await fetchAll()
  }

  async function toggleSeatActive(seat: Seat) {
    await supabase.from('seats').update({ is_active: !seat.is_active }).eq('id', seat.id)
    await fetchAll()
  }


  async function cancelBooking(id: string) {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    await fetchAll()
  }

  async function cancelMultipleBookings() {
    if (selectedBookings.length === 0) return

    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('id', selectedBookings)

    setSelectedBookings([])
    await fetchAll()
  }

  async function sendInvite() {
    setInviteSending(true); setInviteMsg('')
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail)
    setInviteMsg(error ? error.message : `Invite sent to ${inviteEmail} ✓`)
    setInviteSending(false); if (!error) setInviteEmail('')
  }

  const activeSections = FLOOR_SECTIONS.map(sec => {
    const ss = seats.filter(s => s.section === sec.id)
    const active = bookings.filter(b => b.status === 'active' && ss.some(s => s.id === b.seat_id))
    return { sec, seats: ss, active: active.length, avail: ss.filter(s => s.is_active).length }
  })

  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (dateFilter && b.booking_date !== dateFilter) return false

    if (search) {
      const s = search.toLowerCase()
      return (
        b.user?.name?.toLowerCase().includes(s) ||
        b.user?.email?.toLowerCase().includes(s) ||
        b.seat?.seat_number?.toLowerCase().includes(s)
      )
    }

    return true
  })

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false

    if (userSearch) {
      const s = userSearch.toLowerCase()
      return (
        u.name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s)
      )
    }

    return true
  })

  const filteredSeats = seats.filter(seat => {
    if (seatStatusFilter !== 'all') {
      if (seatStatusFilter === 'active' && !seat.is_active) return false
      if (seatStatusFilter === 'inactive' && seat.is_active) return false
    }

    if (sectionFilter !== 'all' && seat.section !== sectionFilter) return false

    if (seatSearch) {
      const s = seatSearch.toLowerCase()
      return (
        seat.seat_number?.toLowerCase().includes(s)
      )
    }

    return true
  })

  if (authLoading || loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>Loading…</div>
  )

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 2, borderBottom: 'none' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab===t.id?700:400, fontFamily: 'inherit', color: tab===t.id?'#2563eb':'#64748b', borderBottom: `2.5px solid ${tab===t.id?'#2563eb':'transparent'}`, marginBottom: -1, transition: 'all 0.15s' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 24px' }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
              {[
                { label: 'Total Seats', value: seats.length, color: '#2563eb', bg: '#eff6ff' },
                { label: 'Active Seats', value: seats.filter(s=>s.is_active).length, color: '#15803d', bg: '#f0fdf4' },
                { label: 'Inactive', value: seats.filter(s=>!s.is_active).length, color: '#64748b', bg: '#f8fafc' },
                { label: 'Total Bookings', value: bookings.length, color: '#7c3aed', bg: '#faf5ff' },
                { label: 'Active Bookings', value: bookings.filter(b=>b.status==='active').length, color: '#15803d', bg: '#f0fdf4' },
                { label: 'Users', value: users.length, color: '#0369a1', bg: '#f0f9ff' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 11, padding: '14px 16px', border: `1px solid ${s.color}22` }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
              {activeSections.map(({ sec, seats: ss, active, avail }) => (
                <div key={sec.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 11, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                    <div style={{ width: 26, height: 26, background: sec.color, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{sectionEmoji(sec.id)}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>{sec.shortLabel}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    <span>{avail} available</span><span>{ss.length} total</span>
                  </div>
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: ss.length>0?`${(avail/ss.length)*100}%`:'0%', background: avail===0?'#ef4444':avail/ss.length<0.35?'#f59e0b':'#22c55e', borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEATS */}
        {tab === 'seats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: msg.includes('✓')?'#f0fdf4':'#fef2f2', color: msg.includes('✓')?'#15803d':'#b91c1c', fontSize: 13, border: `1px solid ${msg.includes('✓')?'#bbf7d0':'#fecaca'}` }}>{msg}</div>}

            {/* Add / Edit seat form */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>{editSeat ? 'Edit Seat' : 'Add New Seat'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Seat Number', field: 'seat_number', type: 'text', placeholder: 'SRL-001' },
                ].map(f => (
                  <div key={f.field}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={editSeat ? (editSeat as any)[f.field] ?? '' : (newSeat as any)[f.field]}
                      onChange={e => editSeat ? setEditSeat({...editSeat,[f.field]:e.target.value}) : setNewSeat({...newSeat,[f.field]:e.target.value})}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>Section</label>
                  <select
                    value={editSeat ? editSeat.section ?? '' : newSeat.section}
                    onChange={e => {
                      const sec = FLOOR_SECTIONS.find(s => s.id === e.target.value)
                      if (editSeat) setEditSeat({...editSeat, section:e.target.value, room_id: sec?.roomId ?? editSeat.room_id})
                      else setNewSeat({...newSeat, section:e.target.value, room_id: sec?.roomId ?? newSeat.room_id})
                    }}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                    {FLOOR_SECTIONS.map(s => <option key={s.id} value={s.id}>{sectionEmoji(s.id)} {s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>OS Type</label>
                  <select
                    value={editSeat ? editSeat.os_type : newSeat.os_type}
                    onChange={e => editSeat ? setEditSeat({...editSeat,os_type:e.target.value as OsType}) : setNewSeat({...newSeat,os_type:e.target.value as OsType})}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="mac">macOS</option>
                    <option value="windows">Windows</option>
                    <option value="other">Seat Only (No System)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>Machine #</label>
                  <input
                    type="number" placeholder="Optional"
                    value={editSeat ? editSeat.machine_number ?? '' : newSeat.machine_number}
                    onChange={e => editSeat ? setEditSeat({...editSeat,machine_number:e.target.value?parseInt(e.target.value):null}) : setNewSeat({...newSeat,machine_number:e.target.value})}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editSeat ? editSeat.is_active : newSeat.is_active} onChange={e => editSeat ? setEditSeat({...editSeat,is_active:e.target.checked}) : setNewSeat({...newSeat,is_active:e.target.checked})} />
                  Active (uncheck to disable booking)
                </label>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <input type="text" placeholder="Notes (e.g. Remote seat, Under maintenance shown as tooltip)"
                    value={editSeat ? editSeat.notes ?? '' : newSeat.notes}
                    onChange={e => editSeat ? setEditSeat({...editSeat, notes: e.target.value || null}) : setNewSeat({...newSeat, notes: e.target.value})}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {editSeat && <button onClick={() => { setEditSeat(null); setMsg('') }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>}
                  <button onClick={saveSeat} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: saving?'#94a3b8':'#1e3a5f', color: '#fff', cursor: saving?'not-allowed':'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                    {saving ? 'Saving…' : editSeat ? 'Update Seat' : 'Add Seat'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>

              <input
                placeholder="Search seat number..."
                value={seatSearch}
                onChange={e => setSeatSearch(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}
              />

              <select
                value={seatStatusFilter}
                onChange={e => setSeatStatusFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={sectionFilter}
                onChange={e => setSectionFilter(e.target.value)}
              >
                <option value="all">All Sections</option>
                {FLOOR_SECTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

            </div>

            {/* Seats table */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Seat #','Section','OS','Machine','Status','Notes','Actions'].map(h => (
                        <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSeats.map((seat, i) => {
                      const sec = FLOOR_SECTIONS.find(s => s.id === seat.section)
                      return (
                        <tr key={seat.id} style={{ borderBottom: '1px solid #f1f5f9', background: i%2===0?'#fff':'#fafafa' }}>
                          <td style={{ padding: '9px 13px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{seat.seat_number}</td>
                          <td style={{ padding: '9px 13px', color: '#475569' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{sectionEmoji(seat.section||'')} {(seat.room_id ? roomMap[seat.room_id]?.name : null) || sec?.shortLabel || seat.section}</span>
                          </td>
                          <td style={{ padding: '9px 13px' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: OS_META[seat.os_type as OsType].bg, color: OS_META[seat.os_type as OsType].color }}>{OS_META[seat.os_type as OsType].label}</span>
                          </td>
                          <td style={{ padding: '9px 13px', color: '#64748b' }}>{seat.machine_number ?? '—'}</td>
                          <td style={{ padding: '9px 13px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: seat.is_active?'#dcfce7':'#f1f5f9', color: seat.is_active?'#15803d':'#64748b', fontWeight: 600 }}>{seat.is_active?'Active':'Inactive'}</span>
                          </td>
                          <td style={{ padding: '9px 13px', color: '#64748b', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {seat.notes || '—'}
                          </td>
                          <td style={{ padding: '9px 13px' }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button onClick={() => setEditSeat(seat)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Edit</button>
                              <button onClick={() => toggleSeatActive(seat)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: seat.is_active?'#dc2626':'#15803d' }}>{seat.is_active?'Disable':'Enable'}</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {/* SEARCH */}
              <input
                placeholder="Search user, email, seat..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
              />

              {/* STATUS */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                style={{ padding: '6px 10px', borderRadius: 6 }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* DATE */}
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6 }}
              />

              {/* BULK CANCEL */}
              {selectedBookings.length > 0 && (
                <button
                  onClick={cancelMultipleBookings}
                  style={{
                    padding: '6px 12px',
                    background: '#dc2626',
                    color: '#fff',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Cancel Selected ({selectedBookings.length})
                </button>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['','User','Seat','Section','Date','Time','Status','Actions'].map(h => (
                      <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.slice(0, 200).map((b, i) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9', background: i%2===0?'#fff':'#fafafa', opacity: b.status==='cancelled'?0.6:1 }}>
                      <td style={{ padding: '9px 13px' }}>
                        <input
                          type="checkbox"
                          checked={selectedBookings.includes(b.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBookings([...selectedBookings, b.id])
                            } else {
                              setSelectedBookings(selectedBookings.filter(id => id !== b.id))
                            }
                          }}
                        />
                      </td>
                      <td style={{ padding: '9px 13px', color: '#475569' }}>{b.user?.name || b.user?.email || '—'}</td>
                      <td style={{ padding: '9px 13px', fontWeight: 700, fontFamily: 'monospace' }}>{b.seat?.seat_number}</td>
                      <td style={{ padding: '9px 13px', color: '#475569' }}>{(b.seat?.room_id ? roomMap[b.seat.room_id]?.name : null)||FLOOR_SECTIONS.find(s=>s.id===b.seat?.section)?.shortLabel||'—'}</td>
                      <td style={{ padding: '9px 13px', color: '#475569', whiteSpace: 'nowrap' }}>{b.booking_date}</td>
                      <td style={{ padding: '9px 13px', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}</td>
                      <td style={{ padding: '9px 13px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: b.status==='active'?'#dcfce7':'#f1f5f9', color: b.status==='active'?'#15803d':'#64748b' }}>{b.status}</span>
                      </td>
                      <td style={{ padding: '9px 13px' }}>
                        {b.status === 'active' && <button onClick={() => cancelBooking(b.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: 11, color: '#dc2626', fontFamily: 'inherit' }}>Cancel</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>

              <input
                placeholder="Search name or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
              />

              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value as any)}
                style={{ padding: '6px 10px', borderRadius: 6 }}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>

            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Name','Email','Role','Joined'].map(h => (
                      <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: i%2===0?'#fff':'#fafafa' }}>
                      <td style={{ padding: '9px 13px', fontWeight: 600, color: '#0f172a' }}>{u.name || '—'}</td>
                      <td style={{ padding: '9px 13px', color: '#475569' }}>{u.email}</td>
                      <td style={{ padding: '9px 13px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: u.role==='admin'?'#fef3c7':'#f1f5f9', color: u.role==='admin'?'#92400e':'#64748b' }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '9px 13px', color: '#64748b' }}>{new Date(u.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INVITE */}
        {tab === 'invite' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: '22px 24px', maxWidth: 480 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Invite User</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>Send a magic link invitation to a new team member.</p>
            {inviteMsg && <div style={{ padding: '10px 14px', borderRadius: 8, background: inviteMsg.includes('✓')?'#f0fdf4':'#fef2f2', color: inviteMsg.includes('✓')?'#15803d':'#b91c1c', fontSize: 13, marginBottom: 14, border: `1px solid ${inviteMsg.includes('✓')?'#bbf7d0':'#fecaca'}` }}>{inviteMsg}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <input
                type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              />
              <button onClick={sendInvite} disabled={inviteSending || !inviteEmail} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: inviteSending||!inviteEmail?'#94a3b8':'#1e3a5f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: inviteSending||!inviteEmail?'not-allowed':'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {inviteSending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
