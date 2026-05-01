'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import type { TeamMember } from '../types'

/* ─── Helpers ─── */
function toProperCase(s: string) {
  return s.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function downloadTemplate() {
  const rows = [
    ['EMP ID', 'Full Name'],
    ['E1001', 'John Smith'],
    ['E1002', 'Priya Sharma'],
    ['E1003', 'Rahul Verma'],
  ]
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'team_members_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

type RowStatus = 'ok' | 'duplicate' | 'invalid' | 'exists'
type ParsedRow = { emp_id: string; emp_name: string; status: RowStatus; note: string }

const STATUS_META: Record<RowStatus, { bg: string; color: string; label: string }> = {
  ok:        { bg: '#f0fdf4', color: '#15803d', label: '✓ Ready'          },
  duplicate: { bg: '#fffbeb', color: '#92400e', label: '⚠ Duplicate in file' },
  invalid:   { bg: '#fef2f2', color: '#dc2626', label: '✕ Missing data'   },
  exists:    { bg: '#f0f9ff', color: '#0369a1', label: '↩ Already saved'  },
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  const re = /(?:^|,)("(?:[^"]|"")*"|[^,]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    result.push(m[1].trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
  }
  return result
}

function parseCSV(text: string, existing: TeamMember[]): ParsedRow[] {
  const existingKeys = new Set(existing.map(m => `${m.emp_id}||${m.emp_name.toLowerCase()}`))
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  const hasHeader = /emp|name|id/i.test(lines[0])
  const dataLines = hasHeader ? lines.slice(1) : lines
  const seenInFile = new Set<string>()

  return dataLines.filter(l => l.trim()).map(line => {
    const parts = parseCsvLine(line)
    const rawId   = (parts[0] ?? '').trim()
    const rawName = (parts[1] ?? '').trim()

    if (!rawId || !rawName) return { emp_id: rawId, emp_name: rawName, status: 'invalid' as const, note: 'EMP ID or Name is empty' }

    const emp_id   = rawId.toUpperCase()
    const emp_name = toProperCase(rawName)
    const fileKey  = `${emp_id}||${emp_name.toLowerCase()}`

    if (existingKeys.has(fileKey)) return { emp_id, emp_name, status: 'exists'    as const, note: 'Already in your list' }
    if (seenInFile.has(fileKey))   return { emp_id, emp_name, status: 'duplicate' as const, note: 'Appears earlier in this file' }

    seenInFile.add(fileKey)
    return { emp_id, emp_name, status: 'ok' as const, note: 'Will be imported' }
  })
}

export default function MyTeamPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [members, setMembers]       = useState<TeamMember[]>([])
  const [loading, setLoading]       = useState(true)
  const [empId, setEmpId]           = useState('')
  const [empName, setEmpName]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  const [success, setSuccess]       = useState('')
  const [editId, setEditId]         = useState<string | null>(null)
  const [editEmpId, setEditEmpId]   = useState('')
  const [editEmpName, setEditEmpName] = useState('')
  const [search, setSearch]         = useState('')

  // CSV import
  const [csvRows, setCsvRows]         = useState<ParsedRow[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null)

  useEffect(() => { if (!authLoading && !user) router.replace('/') }, [user, authLoading])
  useEffect(() => { if (user) fetchMembers() }, [user])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase.from('team_members').select('*').eq('owner_id', user!.id).order('emp_name')
    if (data) setMembers(data as TeamMember[])
    setLoading(false)
  }

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }

  async function handleAdd() {
    const cleanId   = empId.trim().toUpperCase()
    const cleanName = toProperCase(empName)
    if (!cleanId)   { setErr('EMP ID is required'); return }
    if (!cleanName) { setErr('Employee name is required'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('team_members').insert({ owner_id: user!.id, emp_id: cleanId, emp_name: cleanName })
    if (error) setErr(error.message.includes('unique') ? `${cleanName} [${cleanId}] is already in your list.` : error.message)
    else { setEmpId(''); setEmpName(''); flash(`${cleanName} added`); await fetchMembers() }
    setSaving(false)
  }

  async function handleEditSave(id: string) {
    const cleanId   = editEmpId.trim().toUpperCase()
    const cleanName = toProperCase(editEmpName)
    if (!cleanId || !cleanName) { setErr('Both fields are required'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('team_members').update({ emp_id: cleanId, emp_name: cleanName }).eq('id', id).eq('owner_id', user!.id)
    if (error) setErr(error.message)
    else { setMembers(prev => prev.map(m => m.id === id ? { ...m, emp_id: cleanId, emp_name: cleanName } : m).sort((a, b) => a.emp_name.localeCompare(b.emp_name))); setEditId(null); flash('Changes saved') }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from your team list?`)) return
    await supabase.from('team_members').delete().eq('id', id).eq('owner_id', user!.id)
    setMembers(prev => prev.filter(m => m.id !== id))
    flash(`${name} removed`)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    loadFile(file)
    e.target.value = ''
  }

  function loadFile(file: File) {
    setCsvFileName(file.name)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = ev => setCsvRows(parseCSV(ev.target?.result as string, members))
    reader.readAsText(file)
  }

  async function handleImport() {
    const toInsert = csvRows.filter(r => r.status === 'ok')
    if (!toInsert.length) return
    setImporting(true)

    const rows = toInsert.map(r => ({ owner_id: user!.id, emp_id: r.emp_id, emp_name: r.emp_name }))
    const { error } = await supabase.from('team_members').insert(rows)

    if (!error) {
      setImportResult({ added: toInsert.length, skipped: csvRows.length - toInsert.length })
    } else {
      // Batch failed — try one by one
      let added = 0; let skipped = 0
      for (const row of rows) {
        const { error: e } = await supabase.from('team_members').insert(row)
        if (e) skipped++; else added++
      }
      setImportResult({ added, skipped: skipped + (csvRows.length - toInsert.length) })
    }

    await fetchMembers()
    setCsvRows([])
    setCsvFileName('')
    setImporting(false)
  }

  const readyCount  = csvRows.filter(r => r.status === 'ok').length
  const skipCount   = csvRows.filter(r => r.status !== 'ok').length

  const filtered = members.filter(m => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return m.emp_name.toLowerCase().includes(q) || m.emp_id.toLowerCase().includes(q)
  })

  const inp: React.CSSProperties = {
    padding: '9px 12px', borderRadius: 9, border: '1px solid var(--card-border)',
    fontSize: 13, fontFamily: 'inherit', background: 'var(--muted-bg)',
    color: 'var(--ink-900)', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  if (authLoading) return null

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh' }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 60, zIndex: 50, background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)', marginBottom: 2 }}>👥 My Team Members</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              {members.length} member{members.length !== 1 ? 's' : ''} · Private to your account · Used when booking seats for others
            </p>
          </div>
          <button onClick={() => router.push('/book')} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            ← Back to Booking
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Flash */}
        {success && (
          <div style={{ padding: '10px 16px', borderRadius: 9, background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>✓ {success}</div>
        )}

        {/* Import done banner */}
        {importResult && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
              ✓ Import complete — {importResult.added} member{importResult.added !== 1 ? 's' : ''} added
              {importResult.skipped > 0 && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 8 }}>({importResult.skipped} skipped)</span>}
            </span>
            <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#86efac' }}>×</button>
          </div>
        )}

        {/* ── Add single member ── */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>Add Member</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Name → Proper Case · EMP ID → UPPERCASE automatically</div>
          </div>
          <div style={{ padding: '16px 22px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>EMP ID <span style={{ color: '#dc2626' }}>*</span></label>
                <input placeholder="E.g. E1234" value={empId} onChange={e => { setEmpId(e.target.value); setErr('') }} onKeyDown={e => e.key === 'Enter' && handleAdd()} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input placeholder="E.g. John Smith" value={empName} onChange={e => { setEmpName(e.target.value); setErr('') }} onKeyDown={e => e.key === 'Enter' && handleAdd()} style={inp} />
              </div>
              <button onClick={handleAdd} disabled={saving || !empId.trim() || !empName.trim()}
                style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: (!empId.trim() || !empName.trim()) ? '#94a3b8' : '#1e3a5f', color: '#fff', cursor: (!empId.trim() || !empName.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {saving ? 'Adding…' : '+ Add'}
              </button>
            </div>
            {err && <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 12 }}>{err}</div>}
          </div>
        </div>

        {/* ── CSV Bulk Import ── */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>📥 Bulk Import via CSV</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Upload a CSV file. Duplicates and invalid rows are automatically skipped.</div>
            </div>
            <button onClick={downloadTemplate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--ink-700)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              ⬇ Download Template
            </button>
          </div>

          <div style={{ padding: '16px 22px' }}>



            {/* Drop zone or preview */}
            {csvRows.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.csv')) loadFile(f) }}
                style={{ border: '2px dashed var(--card-border)', borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--muted-bg)' }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 4 }}>Click to choose file or drag & drop</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Accepts .csv files only</div>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>
            ) : (
              <div>
                {/* Preview header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-900)' }}>
                    <span style={{ fontWeight: 700 }}>Preview</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>{csvFileName}</span>
                    <span style={{ marginLeft: 12, fontWeight: 700, color: '#15803d' }}>{readyCount} to import</span>
                    {skipCount > 0 && <span style={{ marginLeft: 8, color: '#92400e', fontWeight: 600 }}>{skipCount} to skip</span>}
                  </div>
                  <button onClick={() => { setCsvRows([]); setCsvFileName('') }}
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}>
                    ✕ Clear
                  </button>
                </div>

                {/* Preview table */}
                <div style={{ border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                        {['#', 'EMP ID', 'Full Name', 'Status'].map(h => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => {
                        const s = STATUS_META[row.status]
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)', opacity: row.status !== 'ok' ? 0.6 : 1 }}>
                            <td style={{ padding: '8px 14px', color: 'var(--ink-300)', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: 'var(--ink-700)' }}>{row.emp_id || <span style={{ color: '#dc2626' }}>—</span>}</td>
                            <td style={{ padding: '8px 14px', fontWeight: row.status === 'ok' ? 600 : 400, color: 'var(--ink-900)' }}>{row.emp_name || <span style={{ color: '#dc2626' }}>—</span>}</td>
                            <td style={{ padding: '8px 14px' }}>
                              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 99, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Import button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={handleImport} disabled={importing || readyCount === 0}
                    style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: readyCount === 0 ? '#94a3b8' : '#15803d', color: '#fff', cursor: readyCount === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                    {importing ? 'Importing…' : `⬆ Import ${readyCount} Member${readyCount !== 1 ? 's' : ''}`}
                  </button>
                  {skipCount > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {skipCount} row{skipCount !== 1 ? 's' : ''} will be skipped
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Members list ── */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', flex: '0 0 auto' }}>
              All Members
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--muted-bg)', color: 'var(--muted)' }}>{members.length}</span>
            </div>
            {members.length > 4 && (
              <input placeholder="Search by name or EMP ID…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inp, flex: 1, minWidth: 200, padding: '7px 12px', fontSize: 12 }} />
            )}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>No team members yet</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Add individually above or import a CSV</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No members match "{search}"</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 140px 180px', padding: '8px 22px', background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                {['', 'Name', 'EMP ID', 'Actions'].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {filtered.map((m, i) => (
                <div key={m.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                  {editId === m.id ? (
                    <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>EMP ID</label>
                          <input value={editEmpId} onChange={e => setEditEmpId(e.target.value)} style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
                          <input value={editEmpName} onChange={e => setEditEmpName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave(m.id)} style={inp} autoFocus />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleEditSave(m.id)} disabled={saving}
                          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                          {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button onClick={() => { setEditId(null); setErr('') }}
                          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--muted-bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-700)' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 140px 180px', alignItems: 'center', padding: '12px 22px' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>
                        {m.emp_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{m.emp_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Added {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--ink-700)', fontWeight: 600 }}>{m.emp_id}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setEditId(m.id); setEditEmpId(m.emp_id); setEditEmpName(m.emp_name); setErr('') }}
                          style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink-700)', fontWeight: 600 }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDelete(m.id, m.emp_name)}
                          style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
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

        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--brand-ultra-pale)', border: '1px solid var(--brand-pale)', fontSize: 12, color: 'var(--brand)' }}>
          💡 These members appear in the seat assignment dropdown on the Book Seat page. Only you can see your list.
        </div>
      </div>
    </div>
  )
}
