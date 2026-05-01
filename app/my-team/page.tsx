'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import type { TeamMember } from '../types'

export default function MyTeamPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [empId, setEmpId] = useState('')
  const [empName, setEmpName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editEmpId, setEditEmpId] = useState('')
  const [editEmpName, setEditEmpName] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { if (!authLoading && !user) router.replace('/') }, [user, authLoading])
  useEffect(() => { if (user) fetchMembers() }, [user])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase.from('team_members').select('*').eq('owner_id', user!.id).order('emp_name')
    if (data) setMembers(data as TeamMember[])
    setLoading(false)
  }

  function toProperCase(s: string) {
    return s.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  }

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleAdd() {
    const cleanId = empId.trim().toUpperCase()
    const cleanName = toProperCase(empName)
    if (!cleanId) { setErr('EMP ID is required'); return }
    if (!cleanName) { setErr('Employee name is required'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('team_members').insert({ owner_id: user!.id, emp_id: cleanId, emp_name: cleanName })
    if (error) {
      setErr(error.message.includes('unique') ? `${cleanName} [${cleanId}] is already in your list.` : error.message)
    } else {
      setEmpId(''); setEmpName('')
      flash(`${cleanName} added successfully`)
      await fetchMembers()
    }
    setSaving(false)
  }

  async function handleEditSave(id: string) {
    const cleanId = editEmpId.trim().toUpperCase()
    const cleanName = toProperCase(editEmpName)
    if (!cleanId || !cleanName) { setErr('Both fields are required'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('team_members').update({ emp_id: cleanId, emp_name: cleanName }).eq('id', id).eq('owner_id', user!.id)
    if (error) {
      setErr(error.message)
    } else {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, emp_id: cleanId, emp_name: cleanName } : m).sort((a, b) => a.emp_name.localeCompare(b.emp_name)))
      setEditId(null)
      flash('Changes saved')
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from your team list?`)) return
    await supabase.from('team_members').delete().eq('id', id).eq('owner_id', user!.id)
    setMembers(prev => prev.filter(m => m.id !== id))
    flash(`${name} removed`)
  }

  const filtered = members
    .filter(m => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return m.emp_name.toLowerCase().includes(q) || m.emp_id.toLowerCase().includes(q)
    })

  const inp = {
    padding: '9px 12px', borderRadius: 9, border: '1px solid var(--card-border)',
    fontSize: 13, fontFamily: 'inherit', background: 'var(--muted-bg)',
    color: 'var(--ink-900)', outline: 'none', width: '100%',
    boxSizing: 'border-box' as const,
  }

  if (authLoading) return null

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh' }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 60, zIndex: 50, background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)', marginBottom: 2 }}>
                👥 My Team Members
              </h1>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                {members.length} member{members.length !== 1 ? 's' : ''} · Private to your account · Used when booking seats for others
              </p>
            </div>
            <button
              onClick={() => router.push('/book')}
              style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
            >
              ← Back to Booking
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Flash messages */}
        {success && (
          <div style={{ padding: '10px 16px', borderRadius: 9, background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
            ✓ {success}
          </div>
        )}

        {/* Add new member card */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 1 }}>Add New Member</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Name will be Proper Cased, EMP ID will be UPPERCASED automatically</div>
          </div>
          <div style={{ padding: '16px 22px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>EMP ID <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  placeholder="E.g. E1234"
                  value={empId}
                  onChange={e => { setEmpId(e.target.value); setErr('') }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  style={inp}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  placeholder="E.g. John Smith"
                  value={empName}
                  onChange={e => { setEmpName(e.target.value); setErr('') }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  style={inp}
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={saving || !empId.trim() || !empName.trim()}
                style={{
                  padding: '9px 22px', borderRadius: 9, border: 'none',
                  background: (!empId.trim() || !empName.trim()) ? '#94a3b8' : '#1e3a5f',
                  color: '#fff', cursor: (!empId.trim() || !empName.trim()) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                }}
              >
                {saving ? 'Adding…' : '+ Add Member'}
              </button>
            </div>
            {err && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 12 }}>
                {err}
              </div>
            )}
          </div>
        </div>

        {/* Members list */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', flex: '0 0 auto' }}>
              All Members
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--muted-bg)', color: 'var(--muted)' }}>{members.length}</span>
            </div>
            {members.length > 4 && (
              <input
                placeholder="Search by name or EMP ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inp, flex: 1, minWidth: 200, padding: '7px 12px', fontSize: 12 }}
              />
            )}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>No team members yet</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Add your first member above to use them when booking seats</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No members match "{search}"</div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 140px 180px', padding: '8px 22px', background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                {['', 'Name', 'EMP ID', 'Actions'].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>

              {filtered.map((m, i) => (
                <div
                  key={m.id}
                  style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}
                >
                  {editId === m.id ? (
                    /* Edit row */
                    <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>EMP ID</label>
                          <input value={editEmpId} onChange={e => setEditEmpId(e.target.value)} style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
                          <input
                            value={editEmpName}
                            onChange={e => setEditEmpName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleEditSave(m.id)}
                            style={inp}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleEditSave(m.id)}
                          disabled={saving}
                          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
                        >
                          {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => { setEditId(null); setErr('') }}
                          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-700)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View row */
                    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 140px 180px', alignItems: 'center', padding: '12px 22px', gap: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>
                        {m.emp_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{m.emp_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                          Added {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--ink-700)', fontWeight: 600 }}>{m.emp_id}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => { setEditId(m.id); setEditEmpId(m.emp_id); setEditEmpName(m.emp_name); setErr('') }}
                          style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink-700)', fontWeight: 600 }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.emp_name)}
                          style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}
                        >
                          🗑 Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Tip */}
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--brand-ultra-pale)', border: '1px solid var(--brand-pale)', fontSize: 12, color: 'var(--brand)' }}>
          💡 These members appear in the seat assignment dropdown when you book seats on the Book Seat page. Only you can see your list — other users manage their own.
        </div>
      </div>
    </div>
  )
}
