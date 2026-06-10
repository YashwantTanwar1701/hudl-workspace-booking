'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { LayoutGrid, Mail, Lock, User, Eye, EyeOff, ArrowLeft, CheckCircle2, Building2 } from 'lucide-react'
import type { Department } from '../types'

type AuthScreen = 'login' | 'signup' | 'reset-request' | 'reset-sent' | 'signup-done'

export default function AuthPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [screen, setScreen]           = useState<AuthScreen>('login')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [name, setName]               = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  // Signup: department selection
  const [departments, setDepartments] = useState<Department[]>([])
  const [defaultDeptId, setDefaultDeptId] = useState<number | null>(null)

  useEffect(() => { if (user) router.push('/floor-map') }, [user, router])

  const [deptLoadErr, setDeptLoadErr] = useState(false)

  // Fetch departments on mount — note: department table needs RLS SELECT policy
  // for anon/authenticated users or this will return empty. See migration SQL.
  useEffect(() => {
    supabase.from('department').select('id, name').order('name').then(({ data, error }) => {
      if (data && data.length > 0) {
        setDepartments(data as Department[])
      } else if (error || !data || data.length === 0) {
        setDeptLoadErr(true)
      }
    })
  }, [])

  function resetForm() {
    setEmail(''); setPassword(''); setConfirmPw(''); setName('')
    setError(''); setShowPw(false); setShowConfirm(false); setDefaultDeptId(null)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    else router.push('/floor-map')
    setLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Full name is required'); return }
    if (!defaultDeptId) { setError('Please select your department'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPw) { setError('Passwords do not match'); return }
    setLoading(true); setError('')

    // 1. Create auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    // 2. Upsert user profile row with name and default department
    if (authData.user) {
      await supabase.from('users').upsert({
        id: authData.user.id,
        email,
        name: name.trim(),
        role: 'user',
        default_department_id: defaultDeptId ?? null,
      }, { onConflict: 'id' })
    }

    setLoading(false)
    setScreen('signup-done')
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth` : ''
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (err) setError(err.message)
    else setScreen('reset-sent')
    setLoading(false)
  }

  /* ── Shared styles ── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #e2e8f0', borderRadius: 9,
    fontSize: 14, fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', outline: 'none',
    transition: 'border-color 0.15s', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: '#475569', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '11px', width: '100%', borderRadius: 9, border: 'none',
    background: disabled ? '#94a3b8' : 'linear-gradient(135deg,#1e3a5f,#2d5282)',
    color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  })

  /* ── Confirmation / sent screens ── */
  if (screen === 'signup-done') return (
    <FullPage>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle2 size={34} color="#16a34a" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Account created!</h1>
        <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: 8, fontSize: 15 }}>
          Check your inbox at <strong style={{ color: '#0f172a' }}>{email}</strong> to confirm your email address.
        </p>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
          Once confirmed you can sign in with your password.
        </p>
        <button onClick={() => { resetForm(); setScreen('login') }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to sign in
        </button>
      </div>
    </FullPage>
  )

  if (screen === 'reset-sent') return (
    <FullPage>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Mail size={32} color="#2563eb" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Reset link sent</h1>
        <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: 24, fontSize: 15 }}>
          We sent a password reset link to <strong style={{ color: '#0f172a' }}>{email}</strong>. Check your inbox.
        </p>
        <button onClick={() => { resetForm(); setScreen('login') }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to sign in
        </button>
      </div>
    </FullPage>
  )

  /* ── Main two-column layout ── */
  return (
    <div style={{ minHeight: '90vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

      {/* ── Left: Brand panel ── */}
      <div style={{ background: 'linear-gradient(155deg, #1e3a5f 0%, #0f2441 100%)', padding: 64, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>WorkSpace</div>
            <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Seat Booking</div>
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 38, fontWeight: 300, lineHeight: 1.2, marginBottom: 20, color: '#fff' }}>
            Reserve your desk,<br />
            <em style={{ fontStyle: 'italic', opacity: 0.75 }}>start your day right.</em>
          </h2>
          <p style={{ opacity: 0.6, fontSize: 14.5, lineHeight: 1.75, marginBottom: 36 }}>
            Smart seat booking across every corner of your office — meeting rooms, open desks, phone booths and more.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { icon: '🗺️', text: 'Interactive floor map' },
              { icon: '💻', text: 'Mac & Windows seats' },
              { icon: '📅', text: 'Conflict-free booking' },
              { icon: '🌙', text: 'Night shift support' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.8 }}>
                <span style={{ fontSize: 17 }}>{f.icon}</span>
                <span style={{ fontSize: 13 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ opacity: 0.35, fontSize: 12 }}>&copy; WorkSpace Booking System</div>
      </div>

      {/* ── Right: Form panel ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 64px', background: '#fff', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* ═══ LOGIN ═══ */}
          {screen === 'login' && (
            <>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 6, letterSpacing: '-0.03em' }}>Welcome back</h1>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Sign in to your workspace account.</p>

              <form onSubmit={handleLogin}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <FieldWrap label="Email address">
                    <IconInput icon={<Mail size={15} color="#94a3b8" />}>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        required placeholder="you@company.com" style={{ ...inputStyle, paddingLeft: 36 }} />
                    </IconInput>
                  </FieldWrap>

                  <FieldWrap label="Password">
                    <PasswordInput value={password} onChange={setPassword} show={showPw} toggle={() => setShowPw(v => !v)} style={inputStyle} />
                  </FieldWrap>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  <button type="submit" disabled={loading} style={btnStyle(loading)}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                <button onClick={() => { resetForm(); setScreen('reset-request') }}
                  style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
                  Forgot password?
                </button>
                <p style={{ fontSize: 13.5, color: '#64748b', margin: 0 }}>
                  No account?{' '}
                  <button onClick={() => { resetForm(); setScreen('signup') }}
                    style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', fontWeight: 700 }}>
                    Create one
                  </button>
                </p>
              </div>

              <div style={{ marginTop: 28, padding: '13px 16px', background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd', fontSize: 12.5, color: '#0369a1', lineHeight: 1.55 }}>
                <strong>🔒 Invite-only access.</strong> Contact your administrator if you have not received an invitation yet.
              </div>
            </>
          )}

          {/* ═══ SIGNUP ═══ */}
          {screen === 'signup' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <button onClick={() => { resetForm(); setScreen('login') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2 }}>
                  <ArrowLeft size={18} />
                </button>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>Create account</h1>
              </div>

              <form onSubmit={handleSignup}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>

                  <FieldWrap label="Full Name">
                    <IconInput icon={<User size={15} color="#94a3b8" />}>
                      <input type="text" value={name} onChange={e => setName(e.target.value)}
                        required placeholder="Your full name" style={{ ...inputStyle, paddingLeft: 36 }} />
                    </IconInput>
                  </FieldWrap>

                  <FieldWrap label="Email address">
                    <IconInput icon={<Mail size={15} color="#94a3b8" />}>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        required placeholder="you@company.com" style={{ ...inputStyle, paddingLeft: 36 }} />
                    </IconInput>
                  </FieldWrap>

                  <FieldWrap label="Password">
                    <PasswordInput value={password} onChange={setPassword} show={showPw} toggle={() => setShowPw(v => !v)} style={inputStyle} />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Minimum 8 characters</div>
                  </FieldWrap>

                  <FieldWrap label="Confirm Password">
                    <PasswordInput value={confirmPw} onChange={setConfirmPw} show={showConfirm} toggle={() => setShowConfirm(v => !v)} style={{
                      ...inputStyle,
                      borderColor: confirmPw && confirmPw !== password ? '#fca5a5' : inputStyle.borderColor,
                    }} />
                    {confirmPw && confirmPw !== password && (
                      <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Passwords do not match</div>
                    )}
                  </FieldWrap>

                  <FieldWrap label="Department">
                    <IconInput icon={<Building2 size={15} color="#94a3b8" />}>
                      <select value={defaultDeptId ?? ''} onChange={e => setDefaultDeptId(e.target.value ? Number(e.target.value) : null)}
                        style={{ ...inputStyle, paddingLeft: 36, colorScheme: 'light', appearance: 'auto' }}>
                        <option value="">Select department…</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </IconInput>
                    {deptLoadErr && (
                      <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠ Could not load departments. Ask your admin to enable SELECT access on the department table.</div>
                    )}
                  </FieldWrap>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  <button type="submit" disabled={loading || (!!confirmPw && confirmPw !== password) || !defaultDeptId} style={btnStyle(loading || (!!confirmPw && confirmPw !== password) || !defaultDeptId)}>
                    {loading ? 'Creating account…' : 'Create account'}
                  </button>
                </div>
              </form>

              <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, color: '#64748b' }}>
                Already have an account?{' '}
                <button onClick={() => { resetForm(); setScreen('login') }}
                  style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', fontWeight: 700 }}>
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* ═══ RESET PASSWORD REQUEST ═══ */}
          {screen === 'reset-request' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <button onClick={() => { resetForm(); setScreen('login') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2 }}>
                  <ArrowLeft size={18} />
                </button>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>Reset password</h1>
              </div>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Enter the email address linked to your account and we'll send you a reset link.
              </p>

              <form onSubmit={handleResetRequest}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <FieldWrap label="Email address">
                    <IconInput icon={<Mail size={15} color="#94a3b8" />}>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        required placeholder="you@company.com" style={{ ...inputStyle, paddingLeft: 36 }} />
                    </IconInput>
                  </FieldWrap>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  <button type="submit" disabled={loading} style={btnStyle(loading)}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

/* ── Small shared sub-components ── */
function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc' }}>
      {children}
    </div>
  )
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function IconInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
        {icon}
      </span>
      {children}
    </div>
  )
}

function PasswordInput({ value, onChange, show, toggle, style }: {
  value: string; onChange: (v: string) => void
  show: boolean; toggle: () => void
  style: React.CSSProperties
}) {
  return (
    <div style={{ position: 'relative' }}>
      <Lock size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        required placeholder="••••••••" style={{ ...style, paddingLeft: 36, paddingRight: 42 }} />
      <button type="button" onClick={toggle}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2 }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 13px', borderRadius: 9, background: '#fef2f2', color: '#b91c1c', fontSize: 13, border: '1px solid #fecaca' }}>
      {children}
    </div>
  )
}
