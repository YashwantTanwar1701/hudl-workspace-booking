'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { OS_META, buildRoomMap, PERMISSIONS } from '../types'
import type { Seat, Booking, UserProfile, OsType, Room, RoomMap, Department, RolePermission } from '../types'

type Tab = 'overview' | 'seats' | 'bookings' | 'users' | 'departments' | 'zones' | 'permissions'
type BFull = Booking & { seat: Seat; user: UserProfile; department?: Department }

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'overview',    icon: '📊', label: 'Overview'    },
  { id: 'seats',       icon: '🪑', label: 'Seats'       },
  { id: 'bookings',    icon: '📅', label: 'Bookings'    },
  { id: 'users',       icon: '👥', label: 'Users'       },
  { id: 'departments', icon: '🏬', label: 'Departments' },
  { id: 'zones',       icon: '🗺️', label: 'Zones/Rooms' },
  { id: 'permissions', icon: '🔒', label: 'Permissions' },
]

/* ─── Seat Edit Modal ─── */
function SeatModal({ seat, rooms, onSave, onClose }: {
  seat: Partial<Seat> & { _isNew?: boolean }
  rooms: Room[]
  onSave: (d: Partial<Seat>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({ ...seat })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p: typeof form) => ({ ...p, [k]: v }))
  const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--card-border)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--muted-bg)', color: 'var(--ink-900)', boxSizing: 'border-box' as const }
  async function handleSave() {
    if (!form.seat_number?.trim()) { setErr('Seat number required'); return }
    setSaving(true); await onSave(form); setSaving(false)
  }
  const Field = ({ label, node }: { label: string; node: React.ReactNode }) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {node}
    </div>
  )
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>{seat._isNew ? 'Add Seat' : `Edit ${seat.seat_number}`}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-300)' }}>×</button>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Seat Number" node={<input style={inp} value={form.seat_number||''} onChange={e=>f('seat_number',e.target.value)} placeholder="SRL-001" />} />
          <Field label="Room" node={<select style={inp} value={form.room_id??''} onChange={e=>f('room_id',parseInt(e.target.value))}><option value="">Select…</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>} />
          <Field label="OS Type" node={<select style={inp} value={form.os_type||'other'} onChange={e=>f('os_type',e.target.value as OsType)}><option value="mac">macOS</option><option value="windows">Windows</option><option value="other">Seat Only</option></select>} />
          <Field label="Machine #" node={<input style={inp} type="number" value={form.machine_number??''} onChange={e=>f('machine_number',e.target.value?parseInt(e.target.value):null)} placeholder="Optional" />} />
          <Field label="Status" node={<select style={inp} value={form.is_active?'active':'inactive'} onChange={e=>f('is_active',e.target.value==='active')}><option value="active">Active</option><option value="inactive">Inactive</option></select>} />
          <Field label="Notes" node={<input style={inp} value={form.notes||''} onChange={e=>f('notes',e.target.value)} placeholder="Optional" />} />
        </div>
        {err && <div style={{ margin:'0 20px 12px', padding:'8px 12px', background:'var(--danger-bg)', border:'1px solid var(--danger-border)', borderRadius:7, fontSize:12, color:'var(--danger)' }}>{err}</div>}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--card-border)', display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--muted-bg)', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:'var(--ink-700)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#1e3a5f', color:'#fff', cursor:saving?'wait':'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>{saving?'Saving…':seat._isNew?'Add Seat':'Save'}</button>
        </div>
      </div>
    </div>
  )
}

/* ─── User Role Modal — reads roles from DB ─── */
function UserRoleModal({ u, allRoles, onSave, onClose }: {
  u: UserProfile; allRoles: string[]
  onSave: (id: string, role: string) => Promise<void>; onClose: () => void
}) {
  const [role, setRole] = useState(u.role)
  const [saving, setSaving] = useState(false)
  async function handleSave() { setSaving(true); await onSave(u.id, role); setSaving(false) }
  const inp = { width:'100%', padding:'9px 10px', border:'1px solid var(--card-border)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--muted-bg)', color:'var(--ink-900)' }
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card-bg)', borderRadius:16, width:'100%', maxWidth:380, boxShadow:'var(--shadow-xl)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--card-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--ink-900)' }}>Edit User Role</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--ink-300)' }}>×</button>
        </div>
        <div style={{ padding:'20px' }}>
          <div style={{ marginBottom:4, fontWeight:600, color:'var(--ink-900)' }}>{u.name||u.email}</div>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14 }}>{u.email}</div>
          <label style={{ fontSize:11, fontWeight:700, color:'var(--muted)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Role</label>
          <select value={role} onChange={e=>setRole(e.target.value)} style={inp}>
            {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ marginTop:8, fontSize:11, color:'var(--muted)' }}>Roles are fetched from the database user_role enum.</div>
        </div>
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--card-border)', display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--muted-bg)', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:'var(--ink-700)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#1e3a5f', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>{saving?'Saving…':'Save Role'}</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Zones / Rooms Tab ─── */
function ZonesTab({ rooms, onRename }: {
  rooms: Room[]
  onRename: (id: number, name: string) => Promise<string | null>
}) {
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState('')
  const [successId, setSuccessId] = useState<number | null>(null)

  function startEdit(r: Room) { setEditId(r.id); setEditName(r.name); setLocalErr(''); setSuccessId(null) }
  function cancelEdit() { setEditId(null); setLocalErr('') }

  async function handleSave(id: number) {
    const name = editName.trim()
    if (!name) { setLocalErr('Name cannot be empty'); return }
    if (name === rooms.find(r => r.id === id)?.name) { setEditId(null); return }
    setSaving(true)
    const err = await onRename(id, name)
    if (err) {
      setLocalErr(err.includes('unique') || err.includes('duplicate') ? 'A room with that name already exists.' : err)
    } else {
      setEditId(null)
      setSuccessId(id)
      setTimeout(() => setSuccessId(null), 2500)
    }
    setSaving(false)
  }

  const sorted = [...rooms].sort((a, b) => a.id - b.id)
  const inp = { padding: '8px 11px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--muted-bg)', color: 'var(--ink-900)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 3 }}>Zones & Rooms</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Rename any zone or room — names update everywhere on the site immediately after saving.
            Room IDs and seat assignments are not affected.
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                {['ID', 'Current Name', 'Capacity', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((room, i) => (
                <tr key={room.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--muted)', fontSize: 12 }}>#{room.id}</td>
                  <td style={{ padding: '10px 16px', minWidth: 220 }}>
                    {editId === room.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <input
                          value={editName}
                          onChange={e => { setEditName(e.target.value); setLocalErr('') }}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(room.id); if (e.key === 'Escape') cancelEdit() }}
                          autoFocus
                          style={inp}
                        />
                        {localErr && <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>{localErr}</div>}
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600, color: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 7 }}>
                        {room.name}
                        {successId === room.id && <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>✓ Saved</span>}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{room.capacity}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: room.status ? '#dcfce7' : '#f1f5f9', color: room.status ? '#15803d' : 'var(--muted)' }}>
                      {room.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {editId === room.id ? (
                        <>
                          <button
                            onClick={() => handleSave(room.id)}
                            disabled={saving}
                            style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700 }}
                          >
                            {saving ? 'Saving…' : '✓ Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink-700)' }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(room)}
                          style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink-700)', fontWeight: 600 }}
                        >
                          ✏️ Rename
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ padding: '11px 15px', borderRadius: 10, background: 'var(--brand-ultra-pale)', border: '1px solid var(--brand-pale)', fontSize: 12, color: 'var(--brand)' }}>
        💡 Tip: Press <strong>Enter</strong> to save or <strong>Escape</strong> to cancel while editing. Room IDs stay the same — only the display name changes.
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [allRoles, setAllRoles] = useState<string[]>(['user', 'team_lead', 'manager', 'admin'])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [seatModal, setSeatModal] = useState<(Partial<Seat> & { _isNew?: boolean }) | null>(null)
  const [seatSearch, setSeatSearch] = useState('')
  const [seatStatusFilter, setSeatStatusFilter] = useState<'all'|'active'|'inactive'>('all')
  const [sectionFilter, setSectionFilter] = useState('all')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'cancelled'>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])

  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [userModal, setUserModal] = useState<UserProfile | null>(null)

  const [deptInput, setDeptInput] = useState('')
  const [deptSaving, setDeptSaving] = useState(false)

  useEffect(() => { if (!authLoading && (!user || profile?.role !== 'admin')) router.push('/floor-map') }, [user, profile, authLoading])
  useEffect(() => { if (profile?.role === 'admin' && !initialized) { fetchAll(); setInitialized(true) } }, [profile, initialized])

  async function fetchAll() {
    setLoading(true)
    const [s, b, u, r, d, p, rolesRes] = await Promise.all([
      supabase.from('seats').select('*').order('seat_number'),
      supabase.from('bookings').select('*, seat:seats(*), user:users(*), department:department(*)').order('created_at', { ascending: false }).range(0, 2000),
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('room').select('*').order('name'),
      supabase.from('department').select('*').order('name'),
      supabase.from('role_permissions').select('*'),
      supabase.rpc('get_user_roles'),
    ])
    if (s.data) setSeats(s.data as Seat[])
    if (b.data) setBookings(b.data as BFull[])
    if (u.data) setUsers(u.data as UserProfile[])
    if (r.data) { setRooms(r.data as Room[]); setRoomMap(buildRoomMap(r.data as Room[])) }
    if (d.data) setDepartments(d.data as Department[])
    if (p.data) setPermissions(p.data as RolePermission[])
    // Populate roles from pg_enum (most authoritative source)
    if (rolesRes.data && Array.isArray(rolesRes.data) && rolesRes.data.length > 0) {
      setAllRoles(rolesRes.data as string[])
    } else if (u.data) {
      // Fallback: derive from users table
      const roles = Array.from(new Set((u.data as UserProfile[]).map(x => x.role).filter(Boolean))) as string[]
      if (roles.length > 0) setAllRoles([...new Set([...roles, 'user', 'admin'])])
    }
    setLoading(false)
  }

  async function saveSeat(data: Partial<Seat>) {
    setMsg('')
    const { error } = data.id
      ? await supabase.from('seats').update(data).eq('id', data.id)
      : await supabase.from('seats').insert(data)
    if (error) { setMsg(error.message); return }
    setMsg(data.id ? 'Seat updated ✓' : 'Seat added ✓')
    setSeatModal(null); await fetchAll()
  }

  async function toggleSeatActive(seat: Seat) {
    await supabase.from('seats').update({ is_active: !seat.is_active }).eq('id', seat.id)
    await fetchAll()
  }

  async function cancelBooking(id: string) {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    await fetchAll()
  }

  async function cancelMultiple() {
    if (!selectedBookings.length) return
    await supabase.from('bookings').update({ status: 'cancelled' }).in('id', selectedBookings)
    setSelectedBookings([]); await fetchAll()
  }

  async function updateUserRole(id: string, role: string) {
    const { error } = await supabase.from('users').update({ role }).eq('id', id)
    if (error) { setMsg('Role update failed: ' + error.message); return }
    const { data } = await supabase.from('users').select('*').eq('id', id).single()
    if (data) setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
    setUserModal(null); setMsg('Role updated ✓')
  }

  async function addDepartment() {
    if (!deptInput.trim()) return
    setDeptSaving(true)
    const { error } = await supabase.from('department').insert({ name: deptInput.trim() })
    if (error) { setMsg(error.message) } else { setDeptInput(''); setMsg('Department added ✓'); await fetchAll() }
    setDeptSaving(false)
  }

  async function deleteDepartment(id: number) {
    if (!confirm('Delete this department?')) return
    await supabase.from('department').delete().eq('id', id)
    await fetchAll()
  }

  const [permSaving, setPermSaving] = useState<string | null>(null) // "role|permission" key
  const [permError, setPermError] = useState('')

  async function togglePermission(role: string, permission: string, current: boolean) {
    const key = `${role}|${permission}`
    setPermSaving(key)
    setPermError('')
    const { error } = await supabase
      .from('role_permissions')
      .upsert({ role, permission, allowed: !current }, { onConflict: 'role,permission' })
    if (error) {
      setPermError(`Failed to save ${role} / ${permission}: ${error.message}`)
    } else {
      // Optimistic update — also re-fetch to confirm
      setPermissions(prev => {
        const exists = prev.find(p => p.role === role && p.permission === permission)
        if (exists) return prev.map(p => p.role === role && p.permission === permission ? { ...p, allowed: !current } : p)
        return [...prev, { role, permission, allowed: !current }]
      })
    }
    setPermSaving(null)
  }

  function getPermission(role: string, permission: string) {
    return permissions.find(p => p.role === role && p.permission === permission)?.allowed ?? false
  }

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
      const q = search.toLowerCase()
      return (b.user?.name?.toLowerCase().includes(q) || b.user?.email?.toLowerCase().includes(q) || b.seat?.seat_number?.toLowerCase().includes(q) || b.booked_for?.toLowerCase().includes(q))
    }
    return true
  })

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (userSearch) {
      const q = userSearch.toLowerCase()
      return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    }
    return true
  })

  const inp = (extra?: object) => ({ padding:'6px 10px', borderRadius:7, border:'1px solid var(--card-border)', fontSize:12, fontFamily:'inherit', background:'var(--muted-bg)', color:'var(--ink-900)', outline:'none', ...extra } as React.CSSProperties)

  if (!authLoading && profile?.role !== 'admin') return null

  const activeBookings = bookings.filter(b => b.status === 'active').length
  const activeSeats = seats.filter(s => s.is_active).length
  const today = new Date().toLocaleDateString('en-CA')
  const todayBookings = bookings.filter(b => b.booking_date === today && b.status === 'active').length
  const uniqueRoles = [...new Set(users.map(u => u.role))]

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh' }}>
      {seatModal && <SeatModal seat={seatModal} rooms={rooms} onSave={saveSeat} onClose={() => setSeatModal(null)} />}
      {userModal && <UserRoleModal u={userModal} allRoles={allRoles} onSave={updateUserRole} onClose={() => setUserModal(null)} />}

      {/* ── Sticky Header ── */}
      <div style={{ position: 'sticky', top: 60, zIndex: 50, background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)' }}>Admin Panel</h1>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{profile?.name || user?.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '6px 13px', borderRadius: 7, border: 'none', background: tab === t.id ? '#1e3a5f' : 'transparent', color: tab === t.id ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
        {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: msg.includes('✓') ? 'var(--success-bg)' : 'var(--danger-bg)', color: msg.includes('✓') ? 'var(--success)' : 'var(--danger)', fontSize: 13, border: `1px solid ${msg.includes('✓') ? 'var(--success-border)' : 'var(--danger-border)'}` }}>{msg}</div>}
        {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}

        {/* ── OVERVIEW ── */}
        {!loading && tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
              {[
                { label: 'Total Seats', value: seats.length, color: '#2563eb', bg: '#eff6ff' },
                { label: 'Active Seats', value: activeSeats, color: '#15803d', bg: '#f0fdf4' },
                { label: 'Total Users', value: users.length, color: '#7c3aed', bg: '#f5f3ff' },
                { label: "Today's Bookings", value: todayBookings, color: '#d97706', bg: '#fffbeb' },
                { label: 'Active Bookings', value: activeBookings, color: '#dc2626', bg: '#fef2f2' },
                { label: 'Departments', value: departments.length, color: '#0891b2', bg: '#ecfeff' },
              ].map(c => (
                <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.color}22`, borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: c.color, marginTop: 4, fontWeight: 600 }}>{c.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 14 }}>Room Availability</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
                {rooms.map(room => {
                  const ss = seats.filter(s => s.room_id === room.id)
                  const avail = ss.filter(s => s.is_active).length
                  const pct = ss.length > 0 ? avail / ss.length : 1
                  return (
                    <div key={room.id} style={{ padding: '10px 12px', background: 'var(--muted-bg)', borderRadius: 9, border: '1px solid var(--card-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</span>
                        <span style={{ color: avail === 0 ? '#dc2626' : 'var(--muted)', flexShrink: 0 }}>{avail}/{ss.length}</span>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Search seat…" value={seatSearch} onChange={e => setSeatSearch(e.target.value)} style={inp({ minWidth: 180 })} />
              <select value={seatStatusFilter} onChange={e => setSeatStatusFilter(e.target.value as any)} style={inp()}>
                <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} style={inp()}>
                <option value="all">All Rooms</option>
                {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <button onClick={() => setSeatModal({ _isNew: true, os_type: 'other', is_active: true, has_machine: false })} style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>+ Add Seat</button>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    {['Seat #','Room','OS','Machine','Status','Notes','Actions'].map(h => <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredSeats.map((seat, i) => (
                      <tr key={seat.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                        <td style={{ padding: '9px 13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--ink-900)' }}>{seat.seat_number}</td>
                        <td style={{ padding: '9px 13px', color: 'var(--ink-700)', fontSize: 12 }}>{roomMap[seat.room_id!]?.name || '—'}</td>
                        <td style={{ padding: '9px 13px' }}><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: OS_META[seat.os_type as OsType]?.bg||'#f1f5f9', color: OS_META[seat.os_type as OsType]?.color||'#64748b' }}>{OS_META[seat.os_type as OsType]?.label||seat.os_type}</span></td>
                        <td style={{ padding: '9px 13px', color: 'var(--muted)' }}>{seat.machine_number ?? '—'}</td>
                        <td style={{ padding: '9px 13px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: seat.is_active ? '#dcfce7' : '#f1f5f9', color: seat.is_active ? '#15803d' : 'var(--muted)', fontWeight: 600 }}>{seat.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td style={{ padding: '9px 13px', color: 'var(--muted)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seat.notes || '—'}</td>
                        <td style={{ padding: '9px 13px' }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => setSeatModal(seat)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-700)' }}>Edit</button>
                            <button onClick={() => toggleSeatActive(seat)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: seat.is_active ? '#dc2626' : '#15803d' }}>{seat.is_active ? 'Disable' : 'Enable'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredSeats.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No seats found</td></tr>}
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
              <input placeholder="Search user, seat, booked-for…" value={search} onChange={e => setSearch(e.target.value)} style={inp({ minWidth: 200 })} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={inp()}>
                <option value="all">All Status</option><option value="active">Active</option><option value="cancelled">Cancelled</option>
              </select>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={inp({ colorScheme: 'light dark' })} />
              {dateFilter && <button onClick={() => setDateFilter('')} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit' }}>Clear</button>}
              {selectedBookings.length > 0 && <button onClick={cancelMultiple} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Cancel {selectedBookings.length} selected</button>}
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '9px 13px', width: 36 }}><input type="checkbox" onChange={e => setSelectedBookings(e.target.checked ? filteredBookings.filter(b => b.status === 'active').map(b => b.id) : [])} /></th>
                    {['Seat','Room','User','Booked For','Dept','Date','Time','Status','Action'].map(h => <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredBookings.map((b, i) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                        <td style={{ padding: '9px 13px' }}>{b.status === 'active' && <input type="checkbox" checked={selectedBookings.includes(b.id)} onChange={e => setSelectedBookings(p => e.target.checked ? [...p, b.id] : p.filter(x => x !== b.id))} />}</td>
                        <td style={{ padding: '9px 13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--ink-900)' }}>{b.seat?.seat_number||'—'}</td>
                        <td style={{ padding: '9px 13px', fontSize: 12, color: 'var(--ink-700)' }}>{b.seat?.room_id ? roomMap[b.seat.room_id]?.name||'—' : '—'}</td>
                        <td style={{ padding: '9px 13px' }}><div style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 12 }}>{b.user?.name||b.user?.email?.split('@')[0]||'—'}</div></td>
                        <td style={{ padding: '9px 13px', fontSize: 12, color: 'var(--ink-700)' }}>{b.booked_for||'—'}</td>
                        <td style={{ padding: '9px 13px', fontSize: 12, color: 'var(--muted)' }}>{b.department?.name||'—'}</td>
                        <td style={{ padding: '9px 13px', color: 'var(--ink-700)', fontSize: 12 }}>{b.booking_date}</td>
                        <td style={{ padding: '9px 13px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{b.start_time?.slice(0,5)} – {b.end_time?.slice(0,5)}</td>
                        <td style={{ padding: '9px 13px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: b.status === 'active' ? '#dcfce7' : '#f1f5f9', color: b.status === 'active' ? '#15803d' : 'var(--muted)' }}>{b.status}</span></td>
                        <td style={{ padding: '9px 13px' }}>{b.status === 'active' && <button onClick={() => cancelBooking(b.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Cancel</button>}</td>
                      </tr>
                    ))}
                    {filteredBookings.length === 0 && <tr><td colSpan={10} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No bookings found</td></tr>}
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
              <input placeholder="Search name or email…" value={userSearch} onChange={e => setUserSearch(e.target.value)} style={inp({ minWidth: 220 })} />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={inp()}>
                <option value="all">All Roles</option>
                {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    {['Name','Email','Role','Joined','Action'].map(h => <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                        <td style={{ padding: '9px 13px', fontWeight: 600, color: 'var(--ink-900)' }}>{u.name||'—'}</td>
                        <td style={{ padding: '9px 13px', color: 'var(--ink-700)' }}>{u.email}</td>
                        <td style={{ padding: '9px 13px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: u.role === 'admin' ? '#fef3c7' : 'var(--muted-bg)', color: u.role === 'admin' ? '#92400e' : 'var(--muted)' }}>{u.role}</span></td>
                        <td style={{ padding: '9px 13px', color: 'var(--muted)' }}>{new Date(u.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</td>
                        <td style={{ padding: '9px 13px' }}><button onClick={() => setUserModal(u)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-700)' }}>Edit Role</button></td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No users found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── DEPARTMENTS ── */}
        {!loading && tab === 'departments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 14 }}>Add Department</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  placeholder="Department name…"
                  value={deptInput}
                  onChange={e => setDeptInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDepartment()}
                  style={{ ...inp({ flex: 1 }), padding: '8px 12px', fontSize: 13 }}
                />
                <button onClick={addDepartment} disabled={deptSaving || !deptInput.trim()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                  {deptSaving ? 'Adding…' : '+ Add'}
                </button>
              </div>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                  {['#','Department Name','Created','Delete'].map(h => <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {departments.map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                      <td style={{ padding: '9px 13px', color: 'var(--muted)', fontFamily: 'monospace' }}>{d.id}</td>
                      <td style={{ padding: '9px 13px', fontWeight: 600, color: 'var(--ink-900)' }}>{d.name}</td>
                      <td style={{ padding: '9px 13px', color: 'var(--muted)' }}>{new Date(d.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '9px 13px' }}>
                        <button onClick={() => deleteDepartment(d.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {departments.length === 0 && <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No departments yet. Add one above.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ZONES / ROOMS ── */}
        {!loading && tab === 'zones' && (
          <ZonesTab rooms={rooms} onRename={async (id, name) => {
            // Attempt the update
            const { error } = await supabase
              .from('room')
              .update({ name })
              .eq('id', id)

            if (error) return error.message

            // Verify it actually saved — RLS can silently block without an error
            const { data: verified, error: verifyErr } = await supabase
              .from('room')
              .select('name')
              .eq('id', id)
              .single()

            if (verifyErr) return verifyErr.message
            if (!verified || verified.name !== name) {
              return 'Update was blocked — the room table may have Row Level Security enabled. Run the SQL below in Supabase to fix this:\n\nALTER TABLE public.room ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY "admins can update rooms"\nON public.room FOR UPDATE\nUSING (EXISTS (\n  SELECT 1 FROM public.users\n  WHERE id = auth.uid() AND role = \'admin\'\n));\n\nCREATE POLICY "anyone can read rooms"\nON public.room FOR SELECT\nUSING (true);'
            }

            // Confirmed — update local state
            setRooms(prev => prev.map(r => r.id === id ? { ...r, name } : r))
            setRoomMap(prev => ({ ...prev, [id]: { ...prev[id], name } }))
            return null
          }} />
        )}

        {/* ── PERMISSIONS ── */}
        {!loading && tab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {permError && (
              <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 13 }}>
                ⚠️ {permError}
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>
                  This usually means the <code>role_permissions</code> table has RLS enabled without an update policy.
                  Run this in Supabase SQL Editor:
                  <pre style={{ margin: '6px 0 0', fontSize: 11, background: 'var(--muted-bg)', padding: '8px 10px', borderRadius: 6, overflowX: 'auto' }}>{`-- Allow admins to read and write role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can manage permissions"
ON public.role_permissions FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "authenticated can read permissions"
ON public.role_permissions FOR SELECT
USING (auth.role() = 'authenticated');`}</pre>
                </div>
              </div>
            )}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>Role Permission Matrix</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Changes save immediately to the <code>role_permissions</code> table.
                  {permissions.length === 0 && <span style={{ color: '#dc2626', marginLeft: 6 }}>⚠️ No permissions loaded — check RLS policies on role_permissions table.</span>}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 200 }}>Permission</th>
                      {allRoles.map(role => (
                        <th key={role} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 99, background: role === 'admin' ? '#fef3c7' : 'var(--surface-1)', color: role === 'admin' ? '#92400e' : 'var(--muted)' }}>{role}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map((perm, i) => (
                      <tr key={perm.key} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 13 }}>{perm.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontFamily: 'monospace' }}>{perm.key}</div>
                        </td>
                        {allRoles.map(role => {
                          const allowed = getPermission(role, perm.key)
                          const isAdminCore = role === 'admin' && perm.key === 'view_admin'
                          const isSaving = permSaving === `${role}|${perm.key}`
                          return (
                            <td key={role} style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={allowed}
                                disabled={isAdminCore || isSaving}
                                onChange={() => !isAdminCore && togglePermission(role, perm.key, allowed)}
                                style={{ width: 18, height: 18, cursor: isAdminCore ? 'not-allowed' : 'pointer', accentColor: '#1e3a5f', opacity: isSaving ? 0.5 : 1 }}
                                title={isAdminCore ? 'Admin must always have admin access' : undefined}
                              />
                              {isSaving && <span style={{ fontSize: 9, color: 'var(--muted)', display: 'block' }}>saving…</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
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
