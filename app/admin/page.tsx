'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { OS_META, buildRoomMap } from '../types'
import type { Seat, Booking, UserProfile, OsType, Room, RoomMap } from '../types'

type Tab = 'overview' | 'seats' | 'bookings' | 'users'
type BFull = Booking & { seat: Seat; user: UserProfile }

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'overview', icon: '📊', label: 'Overview'  },
  { id: 'seats',    icon: '🪑', label: 'Seats'     },
  { id: 'bookings', icon: '📅', label: 'Bookings'  },
  { id: 'users',    icon: '👥', label: 'Users'     },
]

/* ─── Seat Edit Modal ─── */
function SeatModal({
  seat, rooms, onSave, onClose,
}: {
  seat: Partial<Seat> & { _isNew?: boolean }
  rooms: Room[]
  onSave: (data: Partial<Seat>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({ ...seat })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p: typeof form) => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.seat_number?.trim()) { setErr('Seat number required'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const inp = (label: string, node: React.ReactNode) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {node}
    </div>
  )
  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--card-border)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--muted-bg)', color: 'var(--ink-900)', boxSizing: 'border-box' as const }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
            {seat._isNew ? 'Add New Seat' : `Edit ${seat.seat_number}`}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink-300)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {inp('Seat Number', <input style={inputStyle} value={form.seat_number || ''} onChange={e => f('seat_number', e.target.value)} placeholder="SRL-001" />)}
          {inp('Room', (
            <select style={inputStyle} value={form.room_id ?? ''} onChange={e => f('room_id', parseInt(e.target.value))}>
              <option value="">Select room…</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          ))}
          {inp('OS Type', (
            <select style={inputStyle} value={form.os_type || 'other'} onChange={e => f('os_type', e.target.value as OsType)}>
              <option value="mac">macOS</option>
              <option value="windows">Windows</option>
              <option value="other">Seat Only</option>
            </select>
          ))}
          {inp('Machine #', <input style={inputStyle} type="number" value={form.machine_number ?? ''} onChange={e => f('machine_number', e.target.value ? parseInt(e.target.value) : null)} placeholder="Optional" />)}
          {inp('Status', (
            <select style={inputStyle} value={form.is_active ? 'active' : 'inactive'} onChange={e => f('is_active', e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          ))}
          {inp('Notes', <input style={inputStyle} value={form.notes || ''} onChange={e => f('notes', e.target.value)} placeholder="Optional" />)}
        </div>
        {err && <div style={{ margin: '0 20px', padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 7, fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-700)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Saving…' : seat._isNew ? 'Add Seat' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── User Role Modal ─── */
function UserRoleModal({
  u, onSave, onClose,
}: {
  u: UserProfile
  onSave: (id: string, role: string) => Promise<void>
  onClose: () => void
}) {
  const [role, setRole] = useState(u.role)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(u.id, role)
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>Edit User Role</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink-300)' }}>×</button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--ink-900)' }}>{u.name || u.email}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{u.email}</div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as 'admin' | 'user')}
            style={{ width: '100%', padding: '9px 10px', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--muted-bg)', color: 'var(--ink-900)' }}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-700)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [initialized, setInitialized] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [seats, setSeats] = useState<Seat[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomMap, setRoomMap] = useState<RoomMap>({})
  const [bookings, setBookings] = useState<BFull[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // Seat state
  const [seatModal, setSeatModal] = useState<(Partial<Seat> & { _isNew?: boolean }) | null>(null)
  const [seatSearch, setSeatSearch] = useState('')
  const [seatStatusFilter, setSeatStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sectionFilter, setSectionFilter] = useState('all')

  // Booking state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])

  // User state
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [userModal, setUserModal] = useState<UserProfile | null>(null)

  useEffect(() => { if (!authLoading && (!user || profile?.role !== 'admin')) router.push('/floor-map') }, [user, profile, authLoading])
  useEffect(() => {
    if (profile?.role === 'admin' && !initialized) { fetchAll(); setInitialized(true) }
  }, [profile, initialized])

  async function fetchAll() {
    setLoading(true)
    const [s, b, u, r] = await Promise.all([
      supabase.from('seats').select('*').order('seat_number'),
      supabase.from('bookings').select('*, seat:seats(*), user:users(*)').order('created_at', { ascending: false }).range(0, 2000),
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('room').select('*').order('name'),
    ])
    if (s.data) setSeats(s.data as Seat[])
    if (b.data) setBookings(b.data as BFull[])
    if (u.data) setUsers(u.data as UserProfile[])
    if (r.data) {
      setRooms(r.data as Room[])
      setRoomMap(buildRoomMap(r.data as Room[]))
    }
    setLoading(false)
  }

  async function saveSeat(data: Partial<Seat>) {
    setMsg('')
    if (data.id) {
      const { error } = await supabase.from('seats').update(data).eq('id', data.id)
      if (error) { setMsg(error.message); return }
      setMsg('Seat updated ✓')
    } else {
      const { error } = await supabase.from('seats').insert(data)
      if (error) { setMsg(error.message); return }
      setMsg('Seat added ✓')
    }
    setSeatModal(null)
    await fetchAll()
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
    if (!selectedBookings.length) return
    await supabase.from('bookings').update({ status: 'cancelled' }).in('id', selectedBookings)
    setSelectedBookings([])
    await fetchAll()
  }

  async function updateUserRole(id: string, role: string) {
    const { error } = await supabase.from('users').update({ role }).eq('id', id)
    if (error) { console.error('Role update failed:', error.message); return }
    // Re-fetch from DB to confirm the update
    const { data } = await supabase.from('users').select('*').eq('id', id).single()
    if (data) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
    }
    setUserModal(null)
  }

  // Filtered lists
  const filteredSeats = seats.filter(s => {
    if (seatStatusFilter === 'active' && !s.is_active) return false
    if (seatStatusFilter === 'inactive' && s.is_active) return false
    if (sectionFilter !== 'all' && roomMap[s.room_id!]?.name !== sectionFilter) return false
    if (seatSearch && !s.seat_number.toLowerCase().includes(seatSearch.toLowerCase())) return false
    return true
  })

  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (dateFilter && b.booking_date !== dateFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return (b.user?.name?.toLowerCase().includes(s) || b.user?.email?.toLowerCase().includes(s) || b.seat?.seat_number?.toLowerCase().includes(s))
    }
    return true
  })

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (userSearch) {
      const s = userSearch.toLowerCase()
      return (u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s))
    }
    return true
  })

  // Overview stats
  const activeBookings = bookings.filter(b => b.status === 'active').length
  const activeSeats = seats.filter(s => s.is_active).length
  const todayStr = new Date().toLocaleDateString('en-CA')
  const todayBookings = bookings.filter(b => b.booking_date === todayStr && b.status === 'active').length

  const inputStyle = (extra?: object) => ({
    padding: '6px 10px', borderRadius: 7, border: '1px solid var(--card-border)',
    fontSize: 12, fontFamily: 'inherit', background: 'var(--muted-bg)',
    color: 'var(--ink-900)', outline: 'none', ...extra,
  })

  if (!authLoading && profile?.role !== 'admin') return null

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh', padding: '24px clamp(14px,3vw,32px)' }}>
      {seatModal && (
        <SeatModal
          seat={seatModal}
          rooms={rooms}
          onSave={saveSeat}
          onClose={() => setSeatModal(null)}
        />
      )}
      {userModal && (
        <UserRoleModal
          u={userModal}
          onSave={updateUserRole}
          onClose={() => setUserModal(null)}
        />
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-900)' }}>Admin Panel</h1>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Signed in as {profile?.name || user?.email}</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: tab === t.id ? '#1e3a5f' : 'transparent', color: tab === t.id ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: msg.includes('✓') ? 'var(--success-bg)' : 'var(--danger-bg)', color: msg.includes('✓') ? 'var(--success)' : 'var(--danger)', fontSize: 13, border: `1px solid ${msg.includes('✓') ? 'var(--success-border)' : 'var(--danger-border)'}` }}>{msg}</div>}

        {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}

        {/* ── OVERVIEW ── */}
        {!loading && tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Total Seats', value: seats.length, color: '#2563eb', bg: '#eff6ff' },
                { label: 'Active Seats', value: activeSeats, color: '#15803d', bg: '#f0fdf4' },
                { label: 'Total Users', value: users.length, color: '#7c3aed', bg: '#f5f3ff' },
                { label: "Today's Bookings", value: todayBookings, color: '#d97706', bg: '#fffbeb' },
                { label: 'Active Bookings', value: activeBookings, color: '#dc2626', bg: '#fef2f2' },
              ].map(c => (
                <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.color}22`, borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: c.color, marginTop: 4, fontWeight: 600 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Per-room availability */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 14 }}>Room Availability</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                {rooms.map(room => {
                  const ss = seats.filter(s => s.room_id === room.id)
                  const avail = ss.filter(s => s.is_active).length
                  const pct = ss.length > 0 ? avail / ss.length : 1
                  return (
                    <div key={room.id} style={{ padding: '10px 12px', background: 'var(--muted-bg)', borderRadius: 9, border: '1px solid var(--card-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>
                        <span>{room.name}</span>
                        <span style={{ color: avail === 0 ? '#dc2626' : 'var(--muted)' }}>{avail}/{ss.length}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--card-border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: pct === 0 ? '#ef4444' : pct < 0.35 ? '#f59e0b' : '#22c55e', borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SEATS ── */}
        {!loading && tab === 'seats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Search seat…" value={seatSearch} onChange={e => setSeatSearch(e.target.value)} style={inputStyle({ minWidth: 180 })} />
              <select value={seatStatusFilter} onChange={e => setSeatStatusFilter(e.target.value as any)} style={inputStyle()}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} style={inputStyle()}>
                <option value="all">All Rooms</option>
                {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <button
                onClick={() => setSeatModal({ _isNew: true, os_type: 'other', is_active: true, has_machine: false })}
                style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
              >
                + Add Seat
              </button>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                      {['Seat #', 'Room', 'OS', 'Machine', 'Status', 'Notes', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSeats.map((seat, i) => {
                      const roomName = roomMap[seat.room_id!]?.name || '—'
                      return (
                        <tr key={seat.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                          <td style={{ padding: '9px 13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--ink-900)' }}>{seat.seat_number}</td>
                          <td style={{ padding: '9px 13px', color: 'var(--ink-700)', fontSize: 12 }}>{roomName}</td>
                          <td style={{ padding: '9px 13px' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: OS_META[seat.os_type as OsType].bg, color: OS_META[seat.os_type as OsType].color }}>{OS_META[seat.os_type as OsType].label}</span>
                          </td>
                          <td style={{ padding: '9px 13px', color: 'var(--muted)' }}>{seat.machine_number ?? '—'}</td>
                          <td style={{ padding: '9px 13px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: seat.is_active ? '#dcfce7' : '#f1f5f9', color: seat.is_active ? '#15803d' : 'var(--muted)', fontWeight: 600 }}>
                              {seat.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 13px', color: 'var(--muted)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seat.notes || '—'}</td>
                          <td style={{ padding: '9px 13px' }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button onClick={() => setSeatModal(seat)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-700)' }}>Edit</button>
                              <button onClick={() => toggleSeatActive(seat)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: seat.is_active ? '#dc2626' : '#15803d' }}>
                                {seat.is_active ? 'Disable' : 'Enable'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredSeats.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No seats found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── BOOKINGS ── */}
        {!loading && tab === 'bookings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Search user, seat…" value={search} onChange={e => setSearch(e.target.value)} style={inputStyle({ minWidth: 200 })} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={inputStyle()}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={inputStyle({ colorScheme: 'light dark' })} />
              {dateFilter && <button onClick={() => setDateFilter('')} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit' }}>Clear</button>}
              {selectedBookings.length > 0 && (
                <button onClick={cancelMultipleBookings} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                  Cancel {selectedBookings.length} selected
                </button>
              )}
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                      <th style={{ padding: '9px 13px', width: 36 }}>
                        <input type="checkbox" onChange={e => setSelectedBookings(e.target.checked ? filteredBookings.filter(b => b.status === 'active').map(b => b.id) : [])} />
                      </th>
                      {['Seat', 'Room', 'User', 'Date', 'Time', 'Status', 'Action'].map(h => (
                        <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((b, i) => {
                      const roomName = b.seat?.room_id ? roomMap[b.seat.room_id]?.name : '—'
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                          <td style={{ padding: '9px 13px' }}>
                            {b.status === 'active' && <input type="checkbox" checked={selectedBookings.includes(b.id)} onChange={e => setSelectedBookings(p => e.target.checked ? [...p, b.id] : p.filter(x => x !== b.id))} />}
                          </td>
                          <td style={{ padding: '9px 13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--ink-900)' }}>{b.seat?.seat_number || '—'}</td>
                          <td style={{ padding: '9px 13px', fontSize: 12, color: 'var(--ink-700)' }}>{roomName}</td>
                          <td style={{ padding: '9px 13px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 12 }}>{b.user?.name || b.user?.email?.split('@')[0] || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.user?.email}</div>
                          </td>
                          <td style={{ padding: '9px 13px', color: 'var(--ink-700)', fontSize: 12 }}>{b.booking_date}</td>
                          <td style={{ padding: '9px 13px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                          </td>
                          <td style={{ padding: '9px 13px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: b.status === 'active' ? '#dcfce7' : '#f1f5f9', color: b.status === 'active' ? '#15803d' : 'var(--muted)' }}>{b.status}</span>
                          </td>
                          <td style={{ padding: '9px 13px' }}>
                            {b.status === 'active' && (
                              <button onClick={() => cancelBooking(b.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Cancel</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredBookings.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No bookings found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {!loading && tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input placeholder="Search name or email…" value={userSearch} onChange={e => setUserSearch(e.target.value)} style={inputStyle({ minWidth: 220 })} />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} style={inputStyle()}>
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                      {['Name', 'Email', 'Role', 'Joined', 'Action'].map(h => (
                        <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                        <td style={{ padding: '9px 13px', fontWeight: 600, color: 'var(--ink-900)' }}>{u.name || '—'}</td>
                        <td style={{ padding: '9px 13px', color: 'var(--ink-700)' }}>{u.email}</td>
                        <td style={{ padding: '9px 13px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: u.role === 'admin' ? '#fef3c7' : 'var(--muted-bg)', color: u.role === 'admin' ? '#92400e' : 'var(--muted)' }}>{u.role}</span>
                        </td>
                        <td style={{ padding: '9px 13px', color: 'var(--muted)' }}>{new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ padding: '9px 13px' }}>
                          <button
                            onClick={() => setUserModal(u)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-700)' }}
                          >
                            Edit Role
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
