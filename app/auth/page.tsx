'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { LayoutGrid, Mail, Lock, User, ArrowLeft, Send, Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) router.push('/floor-map')
  }, [user, router])

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (err) setError(err.message)
    else setDone(true)
    setLoading(false)
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) setError(err.message)
      else setDone(true)
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
      else router.push('/floor-map')
    }
    setLoading(false)
  }

  /* ── Sent screen ── */
  if (done) {
    return (
      <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Mail size={32} color="#2563eb" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
            Check your inbox
          </h1>
          <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: 24, fontSize: 15 }}>
            We sent a sign-in link to{' '}
            <strong style={{ color: '#0f172a' }}>{email}</strong>.
            <br />
            Click it to access your workspace.
          </p>
          <button
            onClick={() => setDone(false)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600 }}
          >
            <ArrowLeft size={14} /> Use a different email
          </button>
        </div>
      </div>
    )
  }

  /* ── Main form ── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #e2e8f0', borderRadius: 9,
    fontSize: 14, fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: '#475569', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  return (
    <div style={{ minHeight: '90vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

      {/* ── Left: Brand panel ── */}
      <div style={{
        background: 'linear-gradient(155deg, #1e3a5f 0%, #0f2441 100%)',
        padding: 64,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: '#fff',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>WorkSpace</div>
            <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Seat Booking</div>
          </div>
        </div>

        {/* Hero text */}
        <div>
          <h2 style={{ fontSize: 38, fontWeight: 300, lineHeight: 1.2, marginBottom: 20, color: '#fff' }}>
            Reserve your desk,<br />
            <em style={{ fontStyle: 'italic', opacity: 0.75 }}>start your day right.</em>
          </h2>
          <p style={{ opacity: 0.6, fontSize: 14.5, lineHeight: 1.75, marginBottom: 36 }}>
            Smart seat booking across every corner of your office —
            meeting rooms, open desks, phone booths and more.
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

        <div style={{ opacity: 0.35, fontSize: 12 }}>
          &copy; WorkSpace Booking System
        </div>
      </div>

      {/* ── Right: Form panel ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 64px', background: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 6, letterSpacing: '-0.03em' }}>
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
            {isSignUp
              ? 'Join your team workspace.'
              : 'Sign in to your workspace account.'}
          </p>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 }}>
            {([
              { id: 'magic',    icon: <Mail size={13} />,  label: 'Magic Link' },
              { id: 'password', icon: <Lock size={13} />,  label: 'Password' },
            ] as const).map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '8px 12px', borderRadius: 7, border: 'none',
                  fontSize: 13, fontWeight: mode === m.id ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  background: mode === m.id ? '#fff' : 'transparent',
                  color: mode === m.id ? '#0f172a' : '#94a3b8',
                  boxShadow: mode === m.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={mode === 'magic' ? handleMagic : handlePassword}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Name — only on sign up + password mode */}
              {mode === 'password' && isSignUp && (
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your full name"
                      style={{ ...inputStyle, paddingLeft: 36 }}
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label style={labelStyle}>Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                  />
                </div>
              </div>

              {/* Password */}
              {mode === 'password' && (
                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingLeft: 36, paddingRight: 42 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2 }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ padding: '10px 13px', borderRadius: 9, background: '#fef2f2', color: '#b91c1c', fontSize: 13, border: '1px solid #fecaca' }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '11px', width: '100%', borderRadius: 9, border: 'none',
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg,#1e3a5f,#2d5282)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'opacity 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? (
                  'Please wait\u2026'
                ) : mode === 'magic' ? (
                  <><Send size={14} /> Send magic link</>
                ) : isSignUp ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          {/* Toggle sign up / sign in */}
          {mode === 'password' && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: '#64748b' }}>
              {isSignUp ? 'Already have an account? ' : 'No account yet? '}
              <button
                onClick={() => setIsSignUp(v => !v)}
                style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', fontWeight: 700 }}
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          )}

          {/* Info box */}
          <div style={{
            marginTop: 28, padding: '13px 16px',
            background: '#f0f9ff', borderRadius: 10,
            border: '1px solid #bae6fd', fontSize: 12.5,
            color: '#0369a1', lineHeight: 1.55,
          }}>
            <strong>🔒 Invite-only access.</strong> Contact your administrator
            if you have not received an invitation yet.
          </div>

        </div>
      </div>
    </div>
  )
}
