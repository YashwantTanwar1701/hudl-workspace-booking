'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { useTheme } from '../components/ThemeProvider'
import {
  Settings, Building2, User, Lock, Eye, EyeOff,
  CheckCircle2, AlertTriangle, ChevronRight,
  Sun, Moon, Bell, Shield,
} from 'lucide-react'
import type { Department } from '../types'

/* ─── Section wrapper ─── */
function Section({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--muted-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1e3a5f' }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  )
}

/* ─── Inline feedback ─── */
function Feedback({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '9px 13px', borderRadius: 8, fontSize: 13,
      background: type === 'success' ? '#f0fdf4' : '#fef2f2',
      color: type === 'success' ? '#15803d' : '#b91c1c',
      border: `1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'}`,
    }}>
      {type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {msg}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid var(--card-border)', fontSize: 13,
  fontFamily: 'inherit', background: 'var(--muted-bg)',
  color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
}
const saveBtn = (saving: boolean): React.CSSProperties => ({
  padding: '9px 22px', borderRadius: 8, border: 'none',
  background: saving ? '#94a3b8' : '#1e3a5f', color: '#fff',
  fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
  fontFamily: 'inherit',
})

export default function SettingsPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [user, authLoading, router])

  /* ── Department ── */
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptId, setDeptId] = useState<number | string>('')
  const [deptSaving, setDeptSaving] = useState(false)
  const [deptMsg, setDeptMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    supabase.from('department').select('id, name').order('name').then(({ data }) => {
      if (data) setDepartments(data as Department[])
    })
  }, [])

  // Pre-fill from profile once loaded
  useEffect(() => {
    if (profile?.default_department_id) setDeptId(profile.default_department_id)
  }, [profile])

  async function saveDept() {
    if (!deptId) { setDeptMsg({ type: 'error', msg: 'Please select a department' }); return }
    setDeptSaving(true); setDeptMsg(null)
    const { error } = await supabase
      .from('users')
      .update({ default_department_id: Number(deptId) })
      .eq('id', user!.id)
    if (error) {
      setDeptMsg({ type: 'error', msg: error.message })
    } else {
      await refreshProfile()
      setDeptMsg({ type: 'success', msg: 'Department updated successfully' })
      setTimeout(() => setDeptMsg(null), 3000)
    }
    setDeptSaving(false)
  }

  /* ── Display name ── */
  const [name, setName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (profile?.name) setName(profile.name)
  }, [profile])

  async function saveName() {
    if (!name.trim()) { setNameMsg({ type: 'error', msg: 'Name cannot be empty' }); return }
    setNameSaving(true); setNameMsg(null)
    const { error } = await supabase
      .from('users')
      .update({ name: name.trim() })
      .eq('id', user!.id)
    if (error) {
      setNameMsg({ type: 'error', msg: error.message })
    } else {
      await refreshProfile()
      setNameMsg({ type: 'success', msg: 'Name updated successfully' })
      setTimeout(() => setNameMsg(null), 3000)
    }
    setNameSaving(false)
  }

  /* ── Password ── */
  const [curPw, setCurPw]       = useState('')
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCur, setShowCur]   = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function changePassword() {
    if (newPw.length < 8) { setPwMsg({ type: 'error', msg: 'New password must be at least 8 characters' }); return }
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', msg: 'Passwords do not match' }); return }
    setPwSaving(true); setPwMsg(null)

    // Re-authenticate with current password first
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: curPw,
    })
    if (authErr) {
      setPwMsg({ type: 'error', msg: 'Current password is incorrect' })
      setPwSaving(false); return
    }

    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwMsg({ type: 'error', msg: error.message })
    } else {
      setPwMsg({ type: 'success', msg: 'Password changed successfully' })
      setCurPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwMsg(null), 4000)
    }
    setPwSaving(false)
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--muted)' }}>
      Loading…
    </div>
  )

  const currentDeptName = departments.find(d => d.id === Number(deptId))?.name

  return (
    <div style={{ background: 'var(--muted-bg)', minHeight: '100vh', paddingBottom: 48 }}>

      {/* Page header */}
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#1e3a5f,#2d5282)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)', margin: 0 }}>Settings</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              {profile?.name || user?.email} · {profile?.role}
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── 1. Department ── */}
        <Section
          title="Default Department"
          subtitle="Applied automatically to every booking you create"
          icon={<Building2 size={18} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Current value chip */}
            {currentDeptName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--muted-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>{currentDeptName}</span>
              </div>
            )}
            <div>
              <label style={label}>Select Department</label>
              <select
                value={deptId}
                onChange={e => setDeptId(e.target.value)}
                style={{ ...inp, colorScheme: 'light dark' as any }}
              >
                <option value="">Choose department…</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {departments.length === 0 && (
                <div style={{ fontSize: 11, color: '#d97706', marginTop: 5 }}>
                  ⚠ No departments loaded. Your admin may need to enable SELECT access on the department table.
                </div>
              )}
            </div>
            {deptMsg && <Feedback type={deptMsg.type} msg={deptMsg.msg} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveDept} disabled={deptSaving || !deptId} style={saveBtn(deptSaving || !deptId)}>
                {deptSaving ? 'Saving…' : 'Save Department'}
              </button>
            </div>
          </div>
        </Section>

        {/* ── 2. Display Name ── */}
        <Section
          title="Display Name"
          subtitle="Your name shown across the app and on bookings"
          icon={<User size={18} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>Full Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                style={inp}
              />
            </div>
            <div>
              <label style={label}>Email</label>
              <input
                value={user?.email || ''}
                disabled
                style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Email cannot be changed. Contact your admin if needed.
              </div>
            </div>
            {nameMsg && <Feedback type={nameMsg.type} msg={nameMsg.msg} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveName} disabled={nameSaving || !name.trim()} style={saveBtn(nameSaving || !name.trim())}>
                {nameSaving ? 'Saving…' : 'Save Name'}
              </button>
            </div>
          </div>
        </Section>

        {/* ── 3. Change Password ── */}
        <Section
          title="Change Password"
          subtitle="Must be at least 8 characters"
          icon={<Lock size={18} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>Current Password</label>
              <PwField value={curPw} onChange={setCurPw} show={showCur} toggle={() => setShowCur(v => !v)} placeholder="Enter current password" />
            </div>
            <div>
              <label style={label}>New Password</label>
              <PwField value={newPw} onChange={setNewPw} show={showNew} toggle={() => setShowNew(v => !v)} placeholder="At least 8 characters" />
            </div>
            <div>
              <label style={label}>Confirm New Password</label>
              <PwField
                value={confirmPw} onChange={setConfirmPw} show={showConfirm} toggle={() => setShowConfirm(v => !v)}
                placeholder="Repeat new password"
                invalid={!!(confirmPw && confirmPw !== newPw)}
              />
              {confirmPw && confirmPw !== newPw && (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>
            {pwMsg && <Feedback type={pwMsg.type} msg={pwMsg.msg} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={changePassword}
                disabled={pwSaving || !curPw || !newPw || !confirmPw || newPw !== confirmPw}
                style={saveBtn(pwSaving || !curPw || !newPw || !confirmPw || newPw !== confirmPw)}
              >
                {pwSaving ? 'Updating…' : 'Change Password'}
              </button>
            </div>
          </div>
        </Section>

        {/* ── 4. Appearance ── */}
        <Section
          title="Appearance"
          subtitle="Choose your preferred colour theme"
          icon={theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            {(['light', 'dark'] as const).map(t => (
              <button
                key={t}
                onClick={() => { if (theme !== t) toggleTheme() }}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${theme === t ? '#1e3a5f' : 'var(--card-border)'}`,
                  background: theme === t ? '#eff6ff' : 'var(--muted-bg)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                <div style={{
                  width: 48, height: 32, borderRadius: 7,
                  background: t === 'light' ? '#f8fafc' : '#0f172a',
                  border: `1px solid ${t === 'light' ? '#e2e8f0' : '#334155'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {t === 'light' ? <Sun size={14} color="#64748b" /> : <Moon size={14} color="#94a3b8" />}
                </div>
                <div style={{ fontSize: 12, fontWeight: theme === t ? 700 : 500, color: theme === t ? '#1e3a5f' : 'var(--muted)', textTransform: 'capitalize' }}>
                  {t} {theme === t && '✓'}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* ── 5. Account info ── */}
        <Section
          title="Account"
          subtitle="Your role and account details"
          icon={<Shield size={18} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Email', value: user?.email || '—' },
              { label: 'Role', value: profile?.role || '—' },
              { label: 'Account created', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--card-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{row.label}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-900)', fontWeight: 600, fontFamily: row.label === 'Email' ? 'monospace' : 'inherit' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  )
}

/* ── Password field ── */
function PwField({ value, onChange, show, toggle, placeholder, invalid = false }: {
  value: string; onChange: (v: string) => void
  show: boolean; toggle: () => void
  placeholder: string; invalid?: boolean
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inp,
          paddingRight: 40,
          borderColor: invalid ? '#fca5a5' : undefined,
        }}
      />
      <button
        type="button"
        onClick={toggle}
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 2 }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}
