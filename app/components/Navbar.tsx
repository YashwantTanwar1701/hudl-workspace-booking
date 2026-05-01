'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { LayoutGrid, Map, PlusSquare, ClipboardList, BarChart2, Settings, LogOut, User, Users, UploadCloud, Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function Navbar() {
  const { user, profile, signOut, loading } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  const links = [
    { href: '/floor-map',   label: 'Floor Map',   icon: Map          },
    { href: '/book',        label: 'Book Seat',   icon: PlusSquare   },
    { href: '/my-bookings', label: 'My Bookings', icon: ClipboardList },
  { href: '/my-team', label: 'My Team', icon: Users },
    { href: '/dashboard',   label: 'Analytics',   icon: BarChart2    },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Settings }] : []),
  ]

  return (
    <header style={{ position:'sticky', top:0, zIndex:200, background:'var(--white)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--border)', height:60 }}>
      <div style={{ maxWidth:1500, margin:'0 auto', height:'100%', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <Link href="/floor-map" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#1e3a5f,#2d5282)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <LayoutGrid size={16} color="white" />
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--ink-900)', lineHeight:1.1, letterSpacing:'-0.03em' }}>WorkSpace</div>
            <div style={{ fontSize:9, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', lineHeight:1 }}>Seat Booking</div>
          </div>
        </Link>
        <nav style={{ display:'flex', alignItems:'center', gap:2 }}>
          {links.map(link => {
            const Icon = link.icon
            const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
            return (
              <Link key={link.href} href={link.href} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:13, fontWeight:active?700:400, textDecoration:'none', color:active?'#fff':'var(--muted)', background:active?'#1e3a5f':'transparent', transition:'all 0.15s' }}>
                <Icon size={14} />{link.label}
              </Link>
            )
          })}
        </nav>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {loading ? (
            <div style={{ width:80, height:28, borderRadius:8, background:'#f1f5f9' }} />
          ) : user ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:8, background:'var(--surface-1)', border:'1px solid var(--card-border)' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <User size={12} color="#64748b" />
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-900)', lineHeight:1.2 }}>{profile?.name || user.email?.split('@')[0]}</div>
                  {isAdmin && <div style={{ fontSize:9, color:'#d97706', fontWeight:700, lineHeight:1 }}>Admin</div>}
                </div>
              </div>
              <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'} style={{ width:32, height:32, borderRadius:8, border:'1px solid var(--card-border)', background:'var(--white)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--ink-300)' }}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button onClick={() => signOut()} title="Sign out" style={{ width:32, height:32, borderRadius:8, border:'1px solid var(--card-border)', background:'var(--white)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--ink-300)' }}>
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <>
              <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'} style={{ width:32, height:32, borderRadius:8, border:'1px solid var(--border)', background:'var(--white)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--ink-300)', marginRight:6 }}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <Link href="/auth" style={{ padding:'7px 16px', borderRadius:8, background:'var(--brand)', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none' }}>Sign in</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
