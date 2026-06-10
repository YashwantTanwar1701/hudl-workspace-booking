'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { OS_META, buildRoomMap, PERMISSIONS } from '../types'
import type { Seat, Booking, UserProfile, OsType, Room, RoomMap, Department, RolePermission } from '../types'

type Tab = 'overview' | 'seats' | 'bookings' | 'users' | 'departments' | 'zones' | 'permissions' | 'approvals'
type BFull = Booking & { seat: Seat; user: UserProfile; department?: Department }

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'overview',    icon: '📊', label: 'Overview'    },
  { id: 'seats',       icon: '🪑', label: 'Seats'       },
  { id: 'bookings',    icon: '📅', label: 'Bookings'    },
  { id: 'users',       icon: '👥', label: 'Users'       },
  { id: 'departments', icon: '🏬', label: 'Departments' },
  { id: 'zones',       icon: '🗺️', label: 'Zones/Rooms' },
  { id: 'permissions', icon: '🔒', label: 'Permissions' },
  { id: 'approvals',   icon: '✅', label: 'Approvals'   },
]

/* ─── Seat Edit Modal ─── */
function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  )
}

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
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>{seat._isNew ? 'Add Seat' : `Edit ${seat.seat_number}`}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-300)' }}>×</button>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FieldWrap label="Seat Number">
            <input style={inp} value={form.seat_number || ''} onChange={e => f('seat_number', e.target.value)} placeholder="SRL-001" autoFocus />
          </FieldWrap>
          <FieldWrap label="Room">
            <select style={inp} value={form.room_id ?? ''} onChange={e => f('room_id', parseInt(e.target.value))}>
              <option value="">Select…</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </FieldWrap>
          <FieldWrap label="OS Type">
            <select style={inp} value={form.os_type || 'other'} onChange={e => f('os_type', e.target.value as OsType)}>
              <option value="mac">macOS</option>
              <option value="windows">Windows</option>
              <option value="other">Seat Only</option>
            </select>
          </FieldWrap>
          <FieldWrap label="Machine #">
            <input style={inp} type="number" value={form.machine_number ?? ''} onChange={e => f('machine_number', e.target.value ? parseInt(e.target.value) : null)} placeholder="Optional" />
          </FieldWrap>
          <FieldWrap label="Status">
            <select style={inp} value={form.is_active ? 'active' : 'inactive'} onChange={e => f('is_active', e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FieldWrap>
          <FieldWrap label="Notes">
            <input style={inp} value={form.notes || ''} onChange={e => f('notes', e.target.value)} placeholder="Optional" />
          </FieldWrap>
        </div>
        {err && <div style={{ margin: '0 20px 12px', padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 7, fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-700)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>{saving ? 'Saving…' : seat._isNew ? 'Add Seat' : 'Save'}</button>
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
            {allRoles.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
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
/* ─── Approvals Tab ─── */
type PendingBooking = {
  id: string
  booking_date: string
  start_time: string
  end_time: string
  booked_for: string | null
  created_at: string
  approval_status: string | null
  review_note: string | null
  reviewed_at: string | null
  seat: { seat_number: string; room_id: number | null } | null
  user: { name: string | null; email: string | null } | null
  room_name?: string
}

function ApprovalsTab({ canApprove, onApprove }: {
  canApprove: boolean
  onApprove: (bookingId: string, decision: 'approved' | 'rejected', note: string) => Promise<string | null>
}) {
  const [bookings, setBookings] = useState<PendingBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [reviewModal, setReviewModal] = useState<PendingBooking | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const { sorted, handleSort, SortIcon, thStyle } = useSortableTable<PendingBooking>(
    bookings.filter(b => filter === 'all' || b.approval_status === filter)
  )

  async function fetchPending() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, end_time, booked_for, created_at, approval_status, review_note, reviewed_at, seat:seats(seat_number, room_id), user:users(name, email)')
      .not('approval_status', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, 500)
    if (data) {
      // Enrich with room names
      const { data: rooms } = await supabase.from('room').select('id, name')
      const roomMap: Record<number, string> = {}
      rooms?.forEach((r: { id: number; name: string }) => { roomMap[r.id] = r.name })
      setBookings((data as PendingBooking[]).map(b => ({
        ...b,
        room_name: b.seat?.room_id ? roomMap[b.seat.room_id] : 'Unknown',
      })))
    }
    setLoading(false)
  }

  useEffect(() => { fetchPending() }, [])

  async function handleDecision(decision: 'approved' | 'rejected') {
    if (!reviewModal) return
    setSubmitting(true)
    const err = await onApprove(reviewModal.id, decision, note)
    if (err) setMsg(err)
    else { setMsg(''); setReviewModal(null); setNote('') }
    setSubmitting(false)
  }

  const pendingCount = bookings.filter(b => b.approval_status === 'pending').length

  const statusStyle = (s: string | null) => {
    if (s === 'pending') return { bg: '#fffbeb', color: '#92400e', border: '#fde68a', label: '⏳ Pending' }
    if (s === 'approved') return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: '✅ Approved' }
    if (s === 'rejected') return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: '❌ Rejected' }
    return { bg: 'var(--muted-bg)', color: 'var(--muted)', border: 'var(--card-border)', label: s ?? '—' }
  }

  const inp = { padding: '8px 11px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--muted-bg)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {([['pending','⏳','#fffbeb','#92400e','#fde68a'],['approved','✅','#f0fdf4','#15803d','#bbf7d0'],['rejected','❌','#fef2f2','#dc2626','#fecaca'],['all','📋','var(--muted-bg)','var(--ink-700)','var(--card-border)']] as const).map(([f, icon, bg, color, border]) => {
          const cnt = f === 'all' ? bookings.length : bookings.filter(b => b.approval_status === f).length
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '8px 16px', borderRadius: 9, border: `1.5px solid ${filter === f ? color : border}`, background: filter === f ? bg : 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: filter === f ? 700 : 500, color, display: 'flex', alignItems: 'center', gap: 5 }}>
              {icon} {f.charAt(0).toUpperCase() + f.slice(1)} <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{cnt}</span>
            </button>
          )
        })}
        <button onClick={fetchPending} style={{ marginLeft: 'auto', padding: '8px 13px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--ink-700)' }}>🔄 Refresh</button>
      </div>

      {!canApprove && (
        <div style={{ padding: '10px 14px', borderRadius: 9, background: '#fef3c7', border: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
          ⚠️ You don't have the <strong>approve_bookings</strong> permission. Go to <strong>Permissions</strong> tab to grant it to your role.
        </div>
      )}

      {msg && <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 13 }}>⚠️ {msg}</div>}

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
            Room Booking Requests
            {pendingCount > 0 && <span style={{ marginLeft: 8, padding: '2px 9px', borderRadius: 99, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', fontSize: 12, fontWeight: 700 }}>{pendingCount} pending</span>}
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No {filter === 'all' ? '' : filter} requests</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                  <th onClick={() => handleSort('room_name' as keyof PendingBooking)} style={thStyle('room_name' as keyof PendingBooking)}>Room <SortIcon col={'room_name' as keyof PendingBooking} /></th>
                  <th onClick={() => handleSort('user' as keyof PendingBooking)} style={thStyle('user' as keyof PendingBooking)}>Requested By <SortIcon col={'user' as keyof PendingBooking} /></th>
                  <th onClick={() => handleSort('booking_date' as keyof PendingBooking)} style={thStyle('booking_date' as keyof PendingBooking)}>Date <SortIcon col={'booking_date' as keyof PendingBooking} /></th>
                  <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Time</th>
                  <th onClick={() => handleSort('created_at' as keyof PendingBooking)} style={thStyle('created_at' as keyof PendingBooking)}>Requested On <SortIcon col={'created_at' as keyof PendingBooking} /></th>
                  <th onClick={() => handleSort('approval_status' as keyof PendingBooking)} style={thStyle('approval_status' as keyof PendingBooking)}>Status <SortIcon col={'approval_status' as keyof PendingBooking} /></th>
                  <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b, i) => {
                  const st = statusStyle(b.approval_status)
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                      <td style={{ padding: '10px 13px', fontWeight: 600, color: 'var(--ink-900)' }}>{b.room_name}</td>
                      <td style={{ padding: '10px 13px' }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-900)' }}>{b.user?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.user?.email || ''}</div>
                      </td>
                      <td style={{ padding: '10px 13px', color: 'var(--ink-700)', fontFamily: 'monospace', fontSize: 12 }}>{b.booking_date}</td>
                      <td style={{ padding: '10px 13px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{b.start_time?.slice(0,5)} – {b.end_time?.slice(0,5)}</td>
                      <td style={{ padding: '10px 13px', color: 'var(--muted)', fontSize: 12 }}>{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '10px 13px' }}>
                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 99, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                        {b.review_note && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>💬 {b.review_note}</div>}
                      </td>
                      <td style={{ padding: '10px 13px' }}>
                        {b.approval_status === 'pending' && canApprove ? (
                          <button
                            onClick={() => { setReviewModal(b); setNote('') }}
                            style={{ padding: '5px 13px', borderRadius: 7, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700 }}
                          >
                            Review
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ink-300)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewModal && (
        <div onClick={() => !submitting && setReviewModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 18, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>Review Room Booking</div>
              <button onClick={() => setReviewModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-300)' }}>×</button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '12px 14px', background: 'var(--muted-bg)', borderRadius: 10, border: '1px solid var(--card-border)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div><strong>Room:</strong> {reviewModal.room_name}</div>
                <div><strong>Requested by:</strong> {reviewModal.user?.name || reviewModal.user?.email || '—'}</div>
                <div><strong>Date:</strong> {reviewModal.booking_date}</div>
                <div><strong>Time:</strong> {reviewModal.start_time?.slice(0,5)} – {reviewModal.end_time?.slice(0,5)}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note (optional)</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a reason or message for the user…"
                  rows={3}
                  style={{ ...inp, width: '100%', resize: 'vertical' }}
                />
              </div>
              {msg && <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, fontSize: 12, color: 'var(--danger)' }}>⚠️ {msg}</div>}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setReviewModal(null)} disabled={submitting} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
              <button onClick={() => handleDecision('rejected')} disabled={submitting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                {submitting ? '…' : '❌ Reject'}
              </button>
              <button onClick={() => handleDecision('approved')} disabled={submitting} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                {submitting ? '…' : '✅ Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Sortable table hook ─── */
function useSortableTable<T>(data: T[]) {
  const [sortKey, setSortKey] = React.useState<keyof T | null>(null)
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')

  function handleSort(key: keyof T) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = React.useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      const str = (v: unknown) => String(v ?? '').toLowerCase()
      const cmp = str(av) < str(bv) ? -1 : str(av) > str(bv) ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  function SortIcon({ col }: { col: keyof T }) {
    if (sortKey !== col) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 3 }}>↕</span>
    return <span style={{ fontSize: 10, marginLeft: 3, color: '#2563eb' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function thStyle(col: keyof T): React.CSSProperties {
    return {
      padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700,
      color: sortKey === col ? '#2563eb' : 'var(--muted)',
      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
      cursor: 'pointer', userSelect: 'none',
    }
  }

  return { sorted, sortKey, sortDir, handleSort, SortIcon, thStyle }
}

function ZonesTab({ rooms, onRename, onToggleApproval, onToggleRoomBooking }: {
  rooms: Room[]
  onRename: (id: number, name: string) => Promise<string | null>
  onToggleApproval: (id: number, val: boolean) => Promise<void>
  onToggleRoomBooking: (id: number, val: boolean) => Promise<void>
}) {
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState('')
  const [successId, setSuccessId] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  function startEdit(r: Room) { setEditId(r.id); setEditName(r.name); setLocalErr(''); setSuccessId(null) }
  function cancelEdit() { setEditId(null); setLocalErr('') }

  async function handleToggleApproval(room: Room) {
    setToggling(room.id)
    await onToggleApproval(room.id, !room.requires_approval)
    setToggling(null)
  }

  async function handleToggleRoomBooking(room: Room) {
    setToggling(room.id)
    await onToggleRoomBooking(room.id, !room.is_room_booking)
    setToggling(null)
  }

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

  const { sorted, handleSort, SortIcon, thStyle } = useSortableTable<Room>([...rooms].sort((a, b) => a.id - b.id))
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
                <th onClick={() => handleSort('id')} style={thStyle('id')}>ID <SortIcon col="id" /></th>
                <th onClick={() => handleSort('name')} style={thStyle('name')}>Current Name <SortIcon col="name" /></th>
                <th onClick={() => handleSort('capacity')} style={thStyle('capacity')}>Capacity <SortIcon col="capacity" /></th>
                <th onClick={() => handleSort('status')} style={thStyle('status')}>Status <SortIcon col="status" /></th>
                <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Requires Approval</th>
                <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Room Booking</th>
                <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Action</th>
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
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!room.requires_approval}
                      disabled={toggling === room.id}
                      onChange={() => handleToggleApproval(room)}
                      title="Bookings for this room require admin approval"
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#d97706' }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!room.is_room_booking}
                      disabled={toggling === room.id}
                      onChange={() => handleToggleRoomBooking(room)}
                      title="Book entire room as a single unit (no individual seats)"
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563eb' }}
                    />
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
      supabase.from('seats').select('*').order('sort_order'),
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
    // Populate roles from pg_enum (most authoritative — canonical underscore values)
    if (rolesRes.data && Array.isArray(rolesRes.data) && rolesRes.data.length > 0) {
      // pg_enum is the source of truth — deduplicate and sort
      const enumRoles = [...new Set(rolesRes.data as string[])].sort()
      setAllRoles(enumRoles)
    } else if (u.data) {
      // Fallback: derive from users table, normalise spaces→underscores, deduplicate
      const roles = Array.from(new Set(
        (u.data as UserProfile[])
          .map(x => x.role?.trim().replace(/\s+/g, '_').toLowerCase())
          .filter(Boolean)
      )) as string[]
      setAllRoles([...new Set([...roles, 'user', 'admin'])].sort())
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

  const [cancelConfirm, setCancelConfirm] = useState<{ ids: string[]; label: string } | null>(null)
  const [cancelling, setCancelling] = useState(false)

  async function cancelBooking(id: string) {
    await supabase.rpc('admin_cancel_bookings', { booking_ids: [id] })
    await fetchAll()
  }

  async function cancelMultiple() {
    if (!selectedBookings.length) return
    await supabase.rpc('admin_cancel_bookings', { booking_ids: selectedBookings })
    setSelectedBookings([]); await fetchAll()
  }

  async function confirmCancel() {
    if (!cancelConfirm) return
    setCancelling(true)
    // Use SECURITY DEFINER RPC — bypasses RLS, checks admin role server-side
    const { error } = await supabase.rpc('admin_cancel_bookings', {
      booking_ids: cancelConfirm.ids
    })
    if (error) {
      setMsg('Cancel failed: ' + error.message)
      setCancelling(false); setCancelConfirm(null); return
    }
    setSelectedBookings([]); await fetchAll()
    setCancelling(false); setCancelConfirm(null)
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

  // ── Sortable state for admin tables ──
  const [bkSort, setBkSort] = useState<{ key: string; dir: 'asc'|'desc' }>({ key: '', dir: 'asc' })
  const [usrSort, setUsrSort] = useState<{ key: string; dir: 'asc'|'desc' }>({ key: '', dir: 'asc' })
  const [deptSort, setDeptSort] = useState<{ key: string; dir: 'asc'|'desc' }>({ key: '', dir: 'asc' })
  const [seatSort, setSeatSort] = useState<{ key: string; dir: 'asc'|'desc' }>({ key: '', dir: 'asc' })

  function makeSort<T>(
    state: { key: string; dir: 'asc'|'desc' },
    setState: React.Dispatch<React.SetStateAction<{ key: string; dir: 'asc'|'desc' }>>,
    data: T[]
  ) {
    function onSort(k: string) { setState(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }) }
    const sorted = state.key ? [...data].sort((a: any, b: any) => {
      const av = String(a[state.key] ?? '').toLowerCase()
      const bv = String(b[state.key] ?? '').toLowerCase()
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return state.dir === 'asc' ? cmp : -cmp
    }) : data
    const thS = (k: string): React.CSSProperties => ({
      padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700,
      color: state.key === k ? '#2563eb' : 'var(--muted)',
      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
      cursor: 'pointer', userSelect: 'none',
    })
    const sortArrow = (k: string) => state.key === k ? (state.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'
    return { sorted, onSort, thS, sortArrow }
  }

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

  // Sortable versions
  const { sorted: sortedBookings, onSort: onBkSort, thS: thBk, sortArrow: bkArrow } = makeSort(bkSort, setBkSort, filteredBookings)
  const { sorted: sortedUsers, onSort: onUsrSort, thS: thUsr, sortArrow: usrArrow } = makeSort(usrSort, setUsrSort, filteredUsers)
  const { sorted: sortedDepts, onSort: onDeptSort, thS: thDept, sortArrow: deptArrow } = makeSort(deptSort, setDeptSort, departments)
  const { sorted: sortedSeats, onSort: onSeatSort, thS: thSeat, sortArrow: seatArrow } = makeSort(seatSort, setSeatSort, filteredSeats)


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
                    <th onClick={() => onSeatSort('seat_number')} style={thSeat('seat_number')}>Seat #{seatArrow('seat_number')}</th>
                    <th onClick={() => onSeatSort('room_id')} style={thSeat('room_id')}>Room{seatArrow('room_id')}</th>
                    <th onClick={() => onSeatSort('os_type')} style={thSeat('os_type')}>OS{seatArrow('os_type')}</th>
                    <th onClick={() => onSeatSort('machine_number')} style={thSeat('machine_number')}>Machine{seatArrow('machine_number')}</th>
                    <th onClick={() => onSeatSort('is_active')} style={thSeat('is_active')}>Status{seatArrow('is_active')}</th>
                    <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Notes</th>
                    <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {sortedSeats.map((seat, i) => (
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
                    {sortedSeats.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No seats found</td></tr>}
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
              {selectedBookings.length > 0 && <button onClick={() => setCancelConfirm({ ids: selectedBookings, label: `${selectedBookings.length} booking${selectedBookings.length !== 1 ? 's' : ''}` })} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Cancel {selectedBookings.length} selected</button>}
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '9px 13px', width: 36 }}><input type="checkbox" onChange={e => setSelectedBookings(e.target.checked ? sortedBookings.filter(b => b.status === 'active').map(b => b.id) : [])} /></th>
                    <th onClick={() => onBkSort('seat')} style={thBk('seat')}>Seat{bkArrow('seat')}</th>
                    <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Room</th>
                    <th onClick={() => onBkSort('user')} style={thBk('user')}>User{bkArrow('user')}</th>
                    <th onClick={() => onBkSort('booked_for')} style={thBk('booked_for')}>Booked For{bkArrow('booked_for')}</th>
                    <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Dept</th>
                    <th onClick={() => onBkSort('booking_date')} style={thBk('booking_date')}>Date{bkArrow('booking_date')}</th>
                    <th onClick={() => onBkSort('start_time')} style={thBk('start_time')}>Time{bkArrow('start_time')}</th>
                    <th onClick={() => onBkSort('status')} style={thBk('status')}>Status{bkArrow('status')}</th>
                    <th onClick={() => onBkSort('approval_status')} style={thBk('approval_status')}>Approval{bkArrow('approval_status')}</th>
                    <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Action</th>
                  </tr></thead>
                  <tbody>
                    {sortedBookings.map((b, i) => (
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
                        <td style={{ padding: '9px 13px' }}>
                          {b.approval_status && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: b.approval_status === 'pending' ? '#fffbeb' : b.approval_status === 'approved' ? '#f0fdf4' : '#fef2f2', color: b.approval_status === 'pending' ? '#92400e' : b.approval_status === 'approved' ? '#15803d' : '#dc2626' }}>{b.approval_status}</span>}
                          {!b.approval_status && <span style={{ color: 'var(--ink-300)', fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 13px' }}>{b.status === 'active' && <button onClick={() => setCancelConfirm({ ids: [b.id], label: `${b.seat?.seat_number || 'seat'} on ${b.booking_date} for ${b.booked_for || b.user?.name || 'user'}` })} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Cancel</button>}</td>
                      </tr>
                    ))}
                    {sortedBookings.length === 0 && <tr><td colSpan={11} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No bookings found</td></tr>}
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
                {allRoles.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <th onClick={() => onUsrSort('name')} style={thUsr('name')}>Name{usrArrow('name')}</th>
                    <th onClick={() => onUsrSort('email')} style={thUsr('email')}>Email{usrArrow('email')}</th>
                    <th onClick={() => onUsrSort('role')} style={thUsr('role')}>Role{usrArrow('role')}</th>
                    <th onClick={() => onUsrSort('created_at')} style={thUsr('created_at')}>Joined{usrArrow('created_at')}</th>
                    <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</th>
                  </tr></thead>
                  <tbody>
                    {sortedUsers.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                        <td style={{ padding: '9px 13px', fontWeight: 600, color: 'var(--ink-900)' }}>{u.name||'—'}</td>
                        <td style={{ padding: '9px 13px', color: 'var(--ink-700)' }}>{u.email}</td>
                        <td style={{ padding: '9px 13px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: u.role === 'admin' ? '#fef3c7' : 'var(--muted-bg)', color: u.role === 'admin' ? '#92400e' : 'var(--muted)' }}>{u.role?.replace(/_/g, ' ')}</span></td>
                        <td style={{ padding: '9px 13px', color: 'var(--muted)' }}>{new Date(u.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</td>
                        <td style={{ padding: '9px 13px' }}><button onClick={() => setUserModal(u)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-700)' }}>Edit Role</button></td>
                      </tr>
                    ))}
                    {sortedUsers.length === 0 && <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No users found</td></tr>}
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
                  <th onClick={() => onDeptSort('id')} style={thDept('id')}>#<span style={{ marginLeft: 3, fontSize: 10 }}>{deptArrow('id')}</span></th>
                  <th onClick={() => onDeptSort('name')} style={thDept('name')}>Department Name{deptArrow('name')}</th>
                  <th onClick={() => onDeptSort('created_at')} style={thDept('created_at')}>Created{deptArrow('created_at')}</th>
                  <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Delete</th>
                </tr></thead>
                <tbody>
                  {sortedDepts.map((d, i) => (
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
          <ZonesTab rooms={rooms}
            onToggleApproval={async (id, val) => {
              await supabase.from('room').update({ requires_approval: val }).eq('id', id)
              setRooms(prev => prev.map(r => r.id === id ? { ...r, requires_approval: val } : r))
            }}
            onToggleRoomBooking={async (id, val) => {
              await supabase.from('room').update({ is_room_booking: val }).eq('id', id)
              setRooms(prev => prev.map(r => r.id === id ? { ...r, is_room_booking: val } : r))
            }}
            onRename={async (id, name) => {
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

        {/* ── APPROVALS ── */}
        {!loading && tab === 'approvals' && (
          <ApprovalsTab
            canApprove={getPermission(profile?.role || '', 'approve_bookings')}
            onApprove={async (bookingId, decision, note) => {
              const { error } = await supabase.rpc('admin_review_booking', {
                p_booking_id: bookingId,
                p_decision: decision,
                p_note: note || null,
              })
              if (error) return error.message
              await fetchAll()
              return null
            }}
          />
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
                          <span style={{ padding: '3px 10px', borderRadius: 99, background: role === 'admin' ? '#fef3c7' : 'var(--surface-1)', color: role === 'admin' ? '#92400e' : 'var(--muted)' }}>
                            {role.replace(/_/g, ' ')}
                          </span>
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

      {/* ── Cancel Confirmation Dialog ── */}
      {cancelConfirm && (
        <div onClick={() => !cancelling && setCancelConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 18, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>⚠️</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink-900)' }}>Cancel Booking?</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>This action cannot be undone</div>
              </div>
            </div>
            <div style={{ padding: '16px 22px' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-700)', background: 'var(--muted-bg)', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--card-border)' }}>
                {cancelConfirm.ids.length === 1
                  ? <>Cancelling booking for <strong>{cancelConfirm.label}</strong></>
                  : <>Cancelling <strong>{cancelConfirm.label}</strong></>
                }
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setCancelConfirm(null)} disabled={cancelling} style={{ padding: '8px 18px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-700)' }}>
                Keep Booking
              </button>
              <button onClick={confirmCancel} disabled={cancelling} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#dc2626', color: '#fff', cursor: cancelling ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                {cancelling ? 'Cancelling…' : `Yes, Cancel${cancelConfirm.ids.length > 1 ? ` ${cancelConfirm.ids.length}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
