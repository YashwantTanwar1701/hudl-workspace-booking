'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import type { Seat, Department, TeamMember } from '../types'

interface Shift { id: number; name: string; start_time: string; end_time: string }
interface Room  { id: number; name: string }

/* ─── Helpers ─── */
function pad2(n: number) { return String(n).padStart(2, '0') }

function addOneDay(date: string) {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function isOvernight(start: string, end: string) {
  // HH:MM:SS or HH:MM — overnight if end <= start
  return end !== '00:00:00' && end <= start
}

function toHHMMSS(t: string) {
  if (!t) return ''
  const parts = t.split(':')
  return `${pad2(+parts[0])}:${pad2(+(parts[1] || 0))}:${pad2(+(parts[2] || 0))}`
}

/** Parse a CSV line correctly, handling quoted fields with commas */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  const re = /(?:^|,)("(?:[^"]|"")*"|[^,]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    result.push(m[1].trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
  }
  return result
}

type RowStatus = 'ok' | 'ok_overnight' | 'invalid' | 'conflict' | 'skip'
interface ParsedBookingRow {
  line: number
  raw: string[]
  // resolved fields
  date: string
  seat_number: string
  seat_id: string | null
  booked_for: string
  department_id: number | null
  department_name: string
  shift_id: number | null
  shift_name: string
  start_time: string
  end_time: string
  overnight: boolean
  status: RowStatus
  errors: string[]
}

const ROW_STATUS_META: Record<RowStatus, { bg: string; color: string; label: string }> = {
  ok:           { bg: '#f0fdf4', color: '#15803d', label: '✓ Ready'          },
  ok_overnight: { bg: '#f0fdf4', color: '#15803d', label: '✓ Ready (overnight)' },
  invalid:      { bg: '#fef2f2', color: '#dc2626', label: '✕ Invalid'        },
  conflict:     { bg: '#fffbeb', color: '#92400e', label: '⚠ Conflict'       },
  skip:         { bg: '#f1f5f9', color: '#64748b', label: '— Skipped'        },
}

function parseBookingCSV(
  text: string,
  seatMap: Record<string, string>,   // seat_number → seat_id
  deptMap: Record<string, number>,   // dept name (lower) → id
  shiftMap: Record<string, Shift>,   // shift name (lower) → shift
): ParsedBookingRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  const hasHeader = /date|seat|member|dept|shift/i.test(lines[0])
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.filter(l => l.trim()).map((line, idx) => {
    const parts = parseCsvLine(line)
    const [rawDate, rawSeat, rawMember, rawDept, rawShift] = parts.map(p => p.trim())
    const errors: string[] = []
    let status: RowStatus = 'ok'

    // Date
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(rawDate ?? '')
    if (!rawDate) errors.push('Date missing')
    else if (!dateValid) errors.push(`Date "${rawDate}" must be YYYY-MM-DD`)

    // Seat
    const seat_id = rawSeat ? (seatMap[rawSeat.toUpperCase()] ?? null) : null
    if (!rawSeat) errors.push('Seat number missing')
    else if (!seat_id) errors.push(`Seat "${rawSeat}" not found`)

    // Member
    if (!rawMember) errors.push('Team member missing')

    // Department (optional — warn but don't block)
    const department_id = rawDept ? (deptMap[rawDept.toLowerCase()] ?? null) : null
    const department_name = rawDept ?? ''
    if (rawDept && !department_id) errors.push(`Department "${rawDept}" not found — will be left blank`)

    // Shift
    const shift = rawShift ? (shiftMap[rawShift.toLowerCase()] ?? null) : null
    if (!rawShift) errors.push('Shift name missing')
    else if (!shift) errors.push(`Shift "${rawShift}" not found`)

    const start_time = shift ? toHHMMSS(shift.start_time) : ''
    const end_time   = shift ? toHHMMSS(shift.end_time)   : ''
    const overnight  = shift ? isOvernight(start_time, end_time) : false

    if (errors.some(e => e.includes('missing') || e.includes('not found') && !e.includes('left blank'))) {
      status = 'invalid'
    } else if (overnight) {
      status = 'ok_overnight'
    }

    return {
      line: idx + (hasHeader ? 2 : 1),
      raw: parts,
      date: rawDate ?? '',
      seat_number: rawSeat?.toUpperCase() ?? '',
      seat_id,
      booked_for: rawMember ?? '',
      department_id,
      department_name,
      shift_id: shift?.id ?? null,
      shift_name: rawShift ?? '',
      start_time,
      end_time,
      overnight,
      status,
      errors,
    }
  })
}

export default function BulkBookingPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [seats, setSeats]       = useState<Seat[]>([])
  const [shifts, setShifts]     = useState<Shift[]>([])
  const [departments, setDepts] = useState<Department[]>([])
  const [rooms, setRooms]       = useState<Room[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const [csvRows, setCsvRows]         = useState<ParsedBookingRow[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])

  useEffect(() => { if (!authLoading && !user) router.replace('/') }, [user, authLoading])
  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setDataLoading(true)
    const [s, sh, d, r] = await Promise.all([
      supabase.from('seats').select('id, seat_number, room_id, is_active').eq('is_active', true).order('seat_number'),
      supabase.from('shift').select('*').order('name'),
      supabase.from('department').select('*').order('name'),
      supabase.from('room').select('id, name').order('name'),
    ])
    if (s.data)  setSeats(s.data as Seat[])
    if (sh.data) setShifts(sh.data as Shift[])
    if (d.data)  setDepts(d.data as Department[])
    if (r.data)  setRooms(r.data as Room[])
    setDataLoading(false)
  }

  // Lookup maps
  const seatMap  = Object.fromEntries(seats.map(s => [s.seat_number.toUpperCase(), s.id]))
  const deptMap  = Object.fromEntries(departments.map(d => [d.name.toLowerCase(), d.id]))
  const shiftMap = Object.fromEntries(shifts.map(s => [s.name.toLowerCase(), s]))
  const roomMap  = Object.fromEntries(rooms.map(r => [r.id, r.name]))

  function downloadTemplate() {
    // Sheet 1: template (what user fills)
    const templateRows = [
      ['Date (YYYY-MM-DD)', 'Seat Number', 'Team Member', 'Department', 'Shift Name'],
      ['2026-05-10', 'SRL-001', 'John Smith', 'Engineering', 'General Shift'],
      ['2026-05-10', 'SRL-002', 'Priya Sharma', 'Engineering', 'Billing Shift 1'],
    ]

    // Sheet 2: reference data (valid seats)
    const seatRefRows = [['Seat Number', 'Room'], ...seats.map(s => [s.seat_number, roomMap[s.room_id ?? 0] ?? ''])]

    // Sheet 3: reference data (valid shifts)
    const shiftRefRows = [
      ['Shift Name', 'Start Time', 'End Time', 'Overnight?'],
      ...shifts.map(s => [s.name, s.start_time.slice(0, 5), s.end_time.slice(0, 5), isOvernight(toHHMMSS(s.start_time), toHHMMSS(s.end_time)) ? 'YES' : 'no'])
    ]

    // Sheet 4: departments
    const deptRefRows = [['Department Name'], ...departments.map(d => [d.name])]

    // Combine into one CSV with section headers separated by blank lines
    const sections = [
      ['=== BOOKING TEMPLATE (fill this section) ===', ...templateRows.map(r => r.join(','))],
      ['', '=== VALID SEAT NUMBERS ===', ...seatRefRows.map(r => r.join(','))],
      ['', '=== VALID SHIFT NAMES ===', ...shiftRefRows.map(r => r.join(','))],
      ['', '=== VALID DEPARTMENT NAMES ===', ...deptRefRows.map(r => r.join(','))],
    ]

    const csv = sections.flat().join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'bulk_booking_template.csv'; a.click()
    URL.revokeObjectURL(url)
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
    setImportErrors([])
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      // Strip the reference sections — only parse lines before any "=== VALID" section
      const rawLines = text.split(/\r?\n/)
      const dataLines: string[] = []
      let inRef = false
      for (const line of rawLines) {
        if (/=== VALID|=== BOOKING TEMPLATE/.test(line)) {
          if (/=== VALID/.test(line)) inRef = true
          continue
        }
        if (!inRef && line.trim()) dataLines.push(line)
      }
      const cleanText = dataLines.join('\n')
      setCsvRows(parseBookingCSV(cleanText, seatMap, deptMap, shiftMap))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    const toInsert = csvRows.filter(r => r.status === 'ok' || r.status === 'ok_overnight')
    if (!toInsert.length) return
    setImporting(true)
    setImportErrors([])

    let added = 0
    const errs: string[] = []
    const today = new Date().toISOString().slice(0, 10)

    for (const row of toInsert) {
      if (!row.seat_id || !row.date || !row.start_time || !row.end_time) continue

      const base = {
        user_id: user!.id,
        seat_id: row.seat_id,
        booked_for: row.booked_for,
        department_id: row.department_id,
        shift_id: row.shift_id,
        status: 'active',
      }

      const endDate = row.overnight ? addOneDay(row.date) : row.date

      const inserts = row.overnight ? [
        { ...base, booking_date: row.date,    start_time: row.start_time, end_time: '23:59:00', start_ts: `${row.date}T${row.start_time}`,    end_ts: `${row.date}T23:59:00` },
        { ...base, booking_date: endDate,     start_time: '00:00:00',     end_time: row.end_time, start_ts: `${endDate}T00:00:00`,              end_ts: `${endDate}T${row.end_time}` },
      ] : [
        { ...base, booking_date: row.date, start_time: row.start_time, end_time: row.end_time, start_ts: `${row.date}T${row.start_time}`, end_ts: `${row.date}T${row.end_time}` },
      ]

      const { error } = await supabase.from('bookings').insert(inserts)
      if (error) {
        const msg = error.message.includes('overlap') ? `Row ${row.line} (${row.seat_number} on ${row.date}): seat already booked for this time` : `Row ${row.line}: ${error.message}`
        errs.push(msg)
      } else {
        added++
      }
    }

    setImportResult({ added, skipped: csvRows.length - toInsert.length })
    if (errs.length) setImportErrors(errs)
    setCsvRows([])
    setCsvFileName('')
    setImporting(false)
  }

  const readyCount   = csvRows.filter(r => r.status === 'ok' || r.status === 'ok_overnight').length
  const invalidCount = csvRows.filter(r => r.status === 'invalid').length

  const s: Record<string, React.CSSProperties> = {
    card: { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' },
    cardHead: { padding: '14px 22px', borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)' },
    th: { padding: '9px 14px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', whiteSpace: 'nowrap' as const },
    td: { padding: '9px 14px', fontSize: 12, color: 'var(--ink-700)', verticalAlign: 'top' as const },
  }

  if (authLoading || dataLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--muted)' }}>Loading…</div>
  )

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh' }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 60, zIndex: 50, background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)', marginBottom: 2 }}>📋 Bulk Booking Import</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Upload a CSV to book multiple seats at once · Overnight shifts split automatically</p>
          </div>
          <button onClick={() => router.push('/book')} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            ← Back to Booking
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Import result */}
        {importResult && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
              ✓ Import complete — {importResult.added} booking{importResult.added !== 1 ? 's' : ''} created
              {importResult.skipped > 0 && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 8 }}>({importResult.skipped} rows skipped)</span>}
            </span>
            <button onClick={() => { setImportResult(null); setImportErrors([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#86efac' }}>×</button>
          </div>
        )}

        {/* Per-row errors from DB */}
        {importErrors.length > 0 && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Some rows failed during import:</div>
            {importErrors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 2 }}>• {e}</div>)}
          </div>
        )}

        {/* Template + upload card */}
        <div style={s.card}>
          <div style={{ ...s.cardHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>📥 Import Bookings via CSV</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Required columns: <strong>Date</strong>, <strong>Seat Number</strong>, <strong>Team Member</strong>, <strong>Department</strong>, <strong>Shift Name</strong>
              </div>
            </div>
            <button onClick={downloadTemplate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--ink-700)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              ⬇ Download Template
            </button>
          </div>

          <div style={{ padding: '16px 22px' }}>
            {/* Column reference */}
            <div style={{ marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 8 }}>
              {[
                { col: 'Date',        fmt: 'YYYY-MM-DD',          eg: '2026-05-10' },
                { col: 'Seat Number', fmt: 'Exact seat number',   eg: 'SRL-001' },
                { col: 'Team Member', fmt: 'Name or Name [ID]',   eg: 'John Smith' },
                { col: 'Department',  fmt: 'Department name',     eg: 'Engineering' },
                { col: 'Shift Name',  fmt: 'Exact shift name',    eg: 'General Shift' },
              ].map(({ col, fmt, eg }) => (
                <div key={col} style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 2 }}>{col}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 1 }}>{fmt}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--brand)' }}>{eg}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12, color: '#15803d' }}>
              🌙 <strong>Overnight shifts</strong> (e.g. Billing Shift 1: 18:30–03:30) are automatically split into two booking rows. No extra column needed — the system detects it from the shift times.
            </div>

            {/* Drop zone or preview */}
            {csvRows.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.csv')) loadFile(f) }}
                style={{ border: '2px dashed var(--card-border)', borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--muted-bg)' }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 4 }}>Click to choose CSV or drag & drop</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Accepts .csv files · Reference data in the template is automatically ignored</div>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>
            ) : (
              <div>
                {/* Preview header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-900)' }}>
                    <span style={{ fontWeight: 700 }}>Preview</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>{csvFileName}</span>
                    <span style={{ marginLeft: 12, fontWeight: 700, color: '#15803d' }}>{readyCount} ready</span>
                    {invalidCount > 0 && <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 600 }}>{invalidCount} invalid</span>}
                  </div>
                  <button onClick={() => { setCsvRows([]); setCsvFileName('') }}
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}>
                    ✕ Clear
                  </button>
                </div>

                {/* Preview table */}
                <div style={{ border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                        {['#', 'Date', 'Seat', 'Team Member', 'Department', 'Shift', 'Status'].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => {
                        const sm = ROW_STATUS_META[row.status]
                        const isOk = row.status === 'ok' || row.status === 'ok_overnight'
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)', opacity: isOk ? 1 : 0.65 }}>
                            <td style={{ ...s.td, color: 'var(--ink-300)', fontSize: 11 }}>{row.line}</td>
                            <td style={{ ...s.td, fontFamily: 'monospace' }}>{row.date || <span style={{ color: '#dc2626' }}>—</span>}</td>
                            <td style={{ ...s.td, fontWeight: 700, fontFamily: 'monospace' }}>
                              {row.seat_number || <span style={{ color: '#dc2626' }}>—</span>}
                              {!row.seat_id && row.seat_number && <div style={{ fontSize: 10, color: '#dc2626' }}>not found</div>}
                            </td>
                            <td style={{ ...s.td, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.booked_for || <span style={{ color: '#dc2626' }}>—</span>}</td>
                            <td style={{ ...s.td, color: row.department_id ? 'var(--ink-700)' : 'var(--muted)' }}>
                              {row.department_name || '—'}
                              {row.department_name && !row.department_id && <div style={{ fontSize: 10, color: '#f59e0b' }}>will be blank</div>}
                            </td>
                            <td style={s.td}>
                              {row.shift_name || <span style={{ color: '#dc2626' }}>—</span>}
                              {row.overnight && <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>🌙 overnight</div>}
                            </td>
                            <td style={s.td}>
                              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 99, fontWeight: 600, background: sm.bg, color: sm.color, whiteSpace: 'nowrap' }}>
                                {sm.label}
                              </span>
                              {row.errors.filter(e => !e.includes('left blank')).map((e, j) => (
                                <div key={j} style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>{e}</div>
                              ))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button onClick={handleImport} disabled={importing || readyCount === 0}
                    style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: readyCount === 0 ? '#94a3b8' : '#15803d', color: '#fff', cursor: readyCount === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                    {importing ? 'Importing…' : `⬆ Import ${readyCount} Booking${readyCount !== 1 ? 's' : ''}`}
                  </button>
                  {invalidCount > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{invalidCount} invalid row{invalidCount !== 1 ? 's' : ''} will be skipped</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Valid values reference (collapsible summary) */}
        {!dataLoading && (
          <details style={{ ...s.card }}>
            <summary style={{ ...s.cardHead, cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>📖 Valid Values Reference</div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Click to expand</span>
            </summary>
            <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {/* Shifts */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shifts ({shifts.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                  {shifts.map(sh => {
                    const on = isOvernight(toHHMMSS(sh.start_time), toHHMMSS(sh.end_time))
                    return (
                      <div key={sh.id} style={{ padding: '5px 9px', borderRadius: 7, background: 'var(--muted-bg)', border: '1px solid var(--card-border)', fontSize: 11 }}>
                        <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{sh.name}</div>
                        <div style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 10 }}>{sh.start_time.slice(0,5)} → {sh.end_time.slice(0,5)}{on ? ' 🌙' : ''}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Departments */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Departments ({departments.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                  {departments.map(d => (
                    <div key={d.id} style={{ padding: '5px 9px', borderRadius: 7, background: 'var(--muted-bg)', border: '1px solid var(--card-border)', fontSize: 11, color: 'var(--ink-900)' }}>{d.name}</div>
                  ))}
                </div>
              </div>
              {/* Seat count by room */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seats by Room</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                  {rooms.map(r => {
                    const cnt = seats.filter(s => s.room_id === r.id).length
                    return cnt > 0 ? (
                      <div key={r.id} style={{ padding: '5px 9px', borderRadius: 7, background: 'var(--muted-bg)', border: '1px solid var(--card-border)', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--ink-900)' }}>{r.name}</span>
                        <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>{cnt}</span>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
