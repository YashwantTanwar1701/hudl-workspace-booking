'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { LayoutGrid, Map, PlusSquare, ClipboardList, BarChart2, Settings, LogOut, User } from 'lucide-react'

export default function Navbar() {
  const { user, profile, signOut, loading } = useAuth()
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  const links = [
    { href: '/floor-map',   label: 'Floor Map',   icon: Map          },
    { href: '/book',        label: 'Book Seat',   icon: PlusSquare   },
    { href: '/my-bookings', label: 'My Bookings', icon: ClipboardList },
    { href: '/dashboard',   label: 'Analytics',   icon: BarChart2    },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Settings }] : []),
  ]

  return (
    <header style={{ position:'sticky', top:0, zIndex:200, background:'rgba(255,255,255,0.98)', backdropFilter:'blur(12px)', borderBottom:'1px solid #e2e8f0', height:60 }}>
      <div style={{ maxWidth:1500, margin:'0 auto', height:'100%', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <Link href="/floor-map" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#1e3a5f,#2d5282)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <LayoutGrid size={16} color="white" />
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', lineHeight:1.1, letterSpacing:'-0.03em' }}>WorkSpace</div>
            <div style={{ fontSize:9, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', lineHeight:1 }}>Seat Booking</div>
          </div>
        </Link>
        <nav style={{ display:'flex', alignItems:'center', gap:2 }}>
          {links.map(link => {
            const Icon = link.icon
            const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
            return (
              <Link key={link.href} href={link.href} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:13, fontWeight:active?700:400, textDecoration:'none', color:active?'#fff':'#64748b', background:active?'#1e3a5f':'transparent', transition:'all 0.15s' }}>
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
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:8, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <User size={12} color="#64748b" />
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#0f172a', lineHeight:1.2 }}>{profile?.name || user.email?.split('@')[0]}</div>
                  {isAdmin && <div style={{ fontSize:9, color:'#d97706', fontWeight:700, lineHeight:1 }}>Admin</div>}
                </div>
              </div>
              <button onClick={() => signOut()} title="Sign out" style={{ width:32, height:32, borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#94a3b8' }}>
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link href="/auth" style={{ padding:'7px 16px', borderRadius:8, background:'#1e3a5f', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none' }}>Sign in</Link>
          )}
        </div>
      </div>
    </header>
  )
}
