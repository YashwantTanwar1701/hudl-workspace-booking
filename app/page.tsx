'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from './components/AuthProvider'
import { MapPin, Calendar, Users, Zap, Monitor, Apple, LayoutGrid, Moon, ArrowRight, CheckCircle2, Clock, Building2 } from 'lucide-react'

export default function RootPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/floor-map')
  }, [user, loading, router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--off-white)' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (user) return null

  return (
    <div style={{ background: 'var(--off-white)', color: 'var(--ink-900)', minHeight: '100vh' }}>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', padding: 'clamp(48px,8vw,96px) clamp(20px,5vw,80px)', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(135deg, var(--brand-ultra-pale) 0%, var(--off-white) 50%, var(--brand-pale) 100%)' }} />
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,58,95,0.07) 0%, transparent 70%)', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: -100, left: -80, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,127,181,0.06) 0%, transparent 70%)', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 99, background: 'var(--brand-pale)', border: '1px solid var(--brand-light)', marginBottom: 24, fontSize: 12, fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.03em' }}>
            <Building2 size={13} /> OFFICE SEAT BOOKING
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,6vw,72px)', fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.03em' }}>
            Your Workspace,<br />
            <span style={{ color: 'var(--brand)' }}>Perfectly Planned</span>
          </h1>

          <p style={{ fontSize: 'clamp(15px,2.5vw,18px)', color: 'var(--ink-500)', lineHeight: 1.65, margin: '0 auto 36px', maxWidth: 520 }}>
            Book any desk, meeting room, or phone booth in seconds. See live availability across every section of your office — and get your spot in 3 clicks.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <Link href="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(30,58,95,0.3)' }}>
              Get Started <ArrowRight size={16} />
            </Link>
            <Link href="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 12, background: 'var(--white)', color: 'var(--ink-700)', fontSize: 15, fontWeight: 600, textDecoration: 'none', border: '1.5px solid var(--border)' }}>
              Sign In
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[{ icon: <Zap size={13} />, label: 'Instant booking' }, { icon: <MapPin size={13} />, label: 'Live seat map' }, { icon: <Clock size={13} />, label: 'Shift-based slots' }, { icon: <Moon size={13} />, label: 'Dark mode' }, { icon: <CheckCircle2 size={13} />, label: 'Wellness room' }].map(f => (
              <span key={f.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'var(--white)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--ink-500)' }}>
                {f.icon} {f.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── App preview card ── */}
      <section style={{ padding: '0 clamp(20px,5vw,80px) clamp(48px,6vw,80px)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', background: 'var(--white)', borderRadius: 20, border: '1.5px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
          {/* Browser chrome */}
          <div style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 6, height: 28, display: 'flex', alignItems: 'center', paddingLeft: 10, fontSize: 12, color: 'var(--ink-300)', border: '1px solid var(--border)', maxWidth: 280, margin: '0 auto' }}>
              workspace.app/floor-map
            </div>
          </div>

          <div style={{ padding: 'clamp(16px, 3vw, 28px)' }}>
            {/* Fake toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                <LayoutGrid size={13} /> Floor Map
              </div>
              <div style={{ display: 'flex', gap: 5, marginLeft: 'auto', flexWrap: 'wrap' }}>
                {['Morning','Afternoon','Night'].map(s => (
                  <div key={s} style={{ padding: '5px 11px', borderRadius: 7, background: s === 'Morning' ? 'var(--brand-pale)' : 'var(--surface-1)', border: `1px solid ${s === 'Morning' ? 'var(--brand-light)' : 'var(--border)'}`, fontSize: 11, fontWeight: s === 'Morning' ? 700 : 500, color: s === 'Morning' ? 'var(--brand)' : 'var(--ink-500)' }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Mini seat grid preview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 10 }}>
              {[
                { name: 'Server Room', seats: 18, avail: 11, color: '#7B1FA2', bg: '#EDE7F6' },
                { name: 'HR / OPS Lane', seats: 20, avail: 7, color: '#2E7D32', bg: '#E8F5E9' },
                { name: 'Cafeteria', seats: 12, avail: 12, color: '#795548', bg: '#FBE9E7' },
                { name: 'Training Rooms', seats: 8, avail: 3, color: '#FF9800', bg: '#FFF8E1' },
                { name: '12 PAX Conf.', seats: 12, avail: 12, color: '#3F51B5', bg: '#E8EAF6' },
                { name: 'Wellness Room', seats: 1, avail: 1, color: '#E91E63', bg: '#FCE4EC' },
              ].map(z => (
                <div key={z.name} style={{ padding: '10px 12px', borderRadius: 10, background: z.bg, border: `1.5px solid ${z.color}33` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: z.color, marginBottom: 5 }}>{z.name}</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 5 }}>
                    {Array.from({ length: Math.min(z.seats, 8) }).map((_, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: i < z.avail ? '#22c55e' : '#ef4444', opacity: 0.9 }} />
                    ))}
                    {z.seats > 8 && <span style={{ fontSize: 9, color: z.color, fontWeight: 700, alignSelf: 'center' }}>+{z.seats-8}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: z.avail === 0 ? '#dc2626' : '#15803d', fontWeight: 700 }}>{z.avail}/{z.seats} avail</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: 'clamp(32px,5vw,64px) clamp(20px,5vw,80px)', background: 'var(--surface-1)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px,4vw,38px)', fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8, fontFamily: 'var(--font-display)' }}>Everything you need</h2>
          <p style={{ textAlign: 'center', color: 'var(--ink-500)', marginBottom: 36, fontSize: 15 }}>Built for hybrid teams that need flexibility</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px,100%), 1fr))', gap: 16 }}>
            {[
              { icon: <LayoutGrid size={22} color="#2563eb" />, bg: '#eff6ff', title: 'Visual seat map', desc: 'See the full office layout — every lane, room, and booth with live availability color-coded in real time.' },
              { icon: <Calendar size={22} color="#7c3aed" />, bg: '#f5f3ff', title: 'Shift-based booking', desc: 'Morning, Afternoon, or Night shift — the system auto-selects your current shift and enforces a 30-min advance window.' },
              { icon: <Users size={22} color="#059669" />, bg: '#ecfdf5', title: 'Multi-seat selection', desc: 'Select multiple seats at once for your team, review them in the cart, and confirm everything in one go.' },
              { icon: <Apple size={22} color="#374151" />, bg: '#f9fafb', title: 'OS-aware seats', desc: 'Filter seats by OS type — Mac, Windows, or seat-only — so everyone lands at the right workstation.' },
              { icon: <Monitor size={22} color="#dc2626" />, bg: '#fef2f2', title: 'Wellness room', desc: 'Emergency rest space available 24/7 regardless of shift windows, with a dedicated confirmation flow.' },
              { icon: <Moon size={22} color="#6366f1" />, bg: '#eef2ff', title: 'Dark mode', desc: 'Toggle between light and dark themes from the navbar. Preference is saved in your browser for next time.' },
            ].map(f => (
              <div key={f.title} style={{ background: 'var(--white)', borderRadius: 14, padding: '20px 22px', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section style={{ padding: 'clamp(40px,6vw,72px) clamp(20px,5vw,80px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 700, color: 'var(--ink-900)', marginBottom: 12, fontFamily: 'var(--font-display)' }}>Ready to book your desk?</h2>
          <p style={{ color: 'var(--ink-500)', marginBottom: 28, fontSize: 15 }}>Sign in with your office account and reserve your spot in seconds.</p>
          <Link href="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(30,58,95,0.25)' }}>
            Sign in to get started <ArrowRight size={16} />
          </Link>
        </div>
      </section>

    </div>
  )
}
