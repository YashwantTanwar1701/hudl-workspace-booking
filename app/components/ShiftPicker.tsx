'use client'

import { useState, useEffect } from 'react'
import { Clock, Moon, Timer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ALL_TIME_SLOTS, NIGHT_SLOTS } from '../types'
import type { Shift } from '../types'

interface ShiftPickerProps {
  date: string                   // YYYY-MM-DD — needed to filter past shifts
  startTime: string
  endTime: string
  isOvernight: boolean
  onStartChange: (t: string) => void
  onEndChange: (t: string) => void
  onOvernightChange: (v: boolean) => void
  onShiftIdChange?: (id: number | null) => void
  validStartSlots?: string[]
  disabled?: boolean
}

function fmt(t: string) { return t.slice(0, 5) }

function minsBetween(a: string, b: string, overnight = false) {
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

/**
 * Sort order:
 * 1. Custom (handled separately)
 * 2. Morning Shift
 * 3. Afternoon Shift
 * 4. Night Shift
 * 5. General Shift
 * 6. Everything else sorted by start_time
 */
function sortShifts(shifts: Shift[]): Shift[] {
  const priority: Record<string, number> = {
    'morning shift': 1,
    'afternoon shift': 2,
    'night shift': 3,
    'general shift': 4,
  }
  return [...shifts].sort((a, b) => {
    const pa = priority[a.name.toLowerCase()] ?? 99
    const pb = priority[b.name.toLowerCase()] ?? 99
    if (pa !== pb) return pa - pb
    return a.start_time.localeCompare(b.start_time)
  })
}

/** Check if a shift's start time has already passed for today */
function isShiftAvailable(shift: Shift, date: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  if (date > today) return true   // future date — all shifts available
  if (date < today) return false  // past date — nothing available

  // Today: shift available only if start_time is at least 30 min from now
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = shift.start_time.split(':').map(Number)
  const shiftMins = sh * 60 + sm
  return shiftMins - nowMins >= 30
}

export default function ShiftPicker({
  date, startTime, endTime, isOvernight,
  onStartChange, onEndChange, onOvernightChange, onShiftIdChange,
  validStartSlots, disabled = false,
}: ShiftPickerProps) {
  const [shifts, setShifts]               = useState<Shift[]>([])
  const [mode, setMode]                   = useState<'custom' | number>('custom')
  const [loading, setLoading]             = useState(true)

  useEffect(() => { fetchShifts() }, [])

  // When date changes, check if current shift is still available
  useEffect(() => {
    if (typeof mode === 'number') {
      const shift = shifts.find(s => s.id === mode)
      if (shift && !isShiftAvailable(shift, date)) {
        setMode('custom')
        onShiftIdChange?.(null)
      }
    }
  }, [date])

  async function fetchShifts() {
    const { data } = await supabase.from('shift').select('*').order('start_time')
    if (data && data.length > 0) {
      setShifts(sortShifts(data as Shift[]))
      // Try to match current time to a predefined shift
      const match = (data as Shift[]).find(
        s => fmt(s.start_time) === startTime && fmt(s.end_time) === endTime
      )
      if (match) {
        setMode(match.id)
      }
    }
    setLoading(false)
  }

  function selectMode(val: string) {
    if (val === 'custom') {
      setMode('custom')
      onShiftIdChange?.(null)
      return
    }
    const shiftId = parseInt(val)
    const shift = shifts.find(s => s.id === shiftId)
    if (!shift) return
    setMode(shiftId)
    onOvernightChange(false)
    onStartChange(fmt(shift.start_time))
    onEndChange(fmt(shift.end_time))
    onShiftIdChange?.(shiftId)
  }

  const isCustom = mode === 'custom'
  const selectedShift = typeof mode === 'number' ? shifts.find(s => s.id === mode) : null
  const availableShifts = shifts.filter(s => isShiftAvailable(s, date))
  const dur = fmtDur(minsBetween(startTime, endTime, isOvernight))
  const effectiveStartSlots = validStartSlots ?? ALL_TIME_SLOTS
  const endSlots = isOvernight ? NIGHT_SLOTS : ALL_TIME_SLOTS.filter(t => t > startTime)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10 }}>
        <Clock size={12} color="#94a3b8" />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading shifts…</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>

      {/* ── Shift / Custom dropdown ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: '#f8fafc', border: '1.5px solid #e2e8f0',
        borderRadius: 10, padding: '7px 12px',
      }}>
        <Clock size={12} color="#3b82f6" />
        <select
          value={isCustom ? 'custom' : String(mode)}
          onChange={e => selectMode(e.target.value)}
          disabled={disabled}
          style={{
            fontSize: 12, fontWeight: 600, color: '#374151',
            background: 'transparent', border: 'none', outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            minWidth: 180,
          }}
        >
          <option value="custom">Custom Time</option>
          {availableShifts.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}  ({fmt(s.start_time)} – {fmt(s.end_time)})
            </option>
          ))}
        </select>
      </div>

      {/* ── Info badge when a predefined shift is selected ── */}
      {!isCustom && selectedShift && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 10,
          background: '#f0f9ff', border: '1px solid #bae6fd',
          color: '#0369a1', fontSize: 12, fontWeight: 600,
        }}>
          <Timer size={12} />
          {fmt(selectedShift.start_time)} → {fmt(selectedShift.end_time)}
          <span style={{ color: '#64748b', fontWeight: 400 }}>
            ({fmtDur(minsBetween(fmt(selectedShift.start_time), fmt(selectedShift.end_time)))})
          </span>
        </div>
      )}

      {/* ── Custom time controls — visible only when "Custom Time" is selected ── */}
      {isCustom && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: '#f8fafc', border: '1.5px solid #e2e8f0',
            borderRadius: 10, padding: '7px 12px',
          }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>From</span>
            <select
              value={startTime}
              onChange={e => onStartChange(e.target.value)}
              disabled={disabled || effectiveStartSlots.length === 0}
              style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}
            >
              {effectiveStartSlots.length === 0
                ? <option>No slots</option>
                : effectiveStartSlots.map(t => <option key={t} value={t}>{t}</option>)
              }
            </select>
            <span style={{ color: '#cbd5e1', fontSize: 11 }}>→</span>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>To</span>
            <select
              value={endTime}
              onChange={e => onEndChange(e.target.value)}
              disabled={disabled}
              style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}
            >
              {endSlots.map(t => (
                <option key={t} value={t}>{t}{isOvernight ? ' (+1 day)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Night shift toggle */}
          <button
            onClick={() => onOvernightChange(!isOvernight)}
            disabled={disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 10,
              border: `1.5px solid ${isOvernight ? '#7c3aed' : '#e2e8f0'}`,
              background: isOvernight ? '#ede9fe' : '#f8fafc',
              color: isOvernight ? '#7c3aed' : '#64748b',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: isOvernight ? 700 : 500,
              fontFamily: 'inherit',
            }}
          >
            <Moon size={12} /> Night Shift
          </button>

          {/* Duration badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '7px 12px', borderRadius: 10,
            background: '#f0f9ff', border: '1px solid #bae6fd',
            color: '#0369a1', fontSize: 12, fontWeight: 600,
          }}>
            <Timer size={12} /> {dur}
          </div>
        </>
      )}
    </div>
  )
}
