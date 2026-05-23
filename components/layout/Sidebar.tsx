'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  IcHome, IcUsers, IcKanban, IcBrief, IcCalendar,
  IcChart, IcMail, IcCog, IcChevRight, IcLogout, IcMessage, IcTarget,
} from '@/components/ui/Icons'
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge'
import { logout } from '@/lib/actions'
import type { Profile } from '@/lib/supabase/database.types'

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
}

function NavItem({ href, icon, label, count, active }: NavItemProps) {
  return (
    <Link href={href} className={`nav-item ${active ? 'active' : ''}`}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      {count != null && (
        <span className="nav-count" style={{ marginLeft: 'auto' }}>
          {count}
        </span>
      )}
    </Link>
  )
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

  const initials = profile?.avatar_initials ?? 'IM'
  const fullName = profile?.full_name ?? 'Usuario'
  const role = profile?.role ?? 'Partner'

  const primary = [
    { href: '/',          icon: <IcHome size={16} />,     label: 'Dashboard' },
    { href: '/contacts',  icon: <IcUsers size={16} />,    label: 'Contactos' },
    { href: '/pipeline',  icon: <IcKanban size={16} />,   label: 'Pipeline' },
    { href: '/deals/new', icon: <IcBrief size={16} />,    label: 'Nuevo deal' },
    { href: '/activities',icon: <IcCalendar size={16} />, label: 'Actividades' },
  ]
  const secondary = [
    { href: '/reports',  icon: <IcChart size={16} />,   label: 'Reportes' },
    { href: '/inbox',    icon: <IcMail size={16} />,    label: 'Inbox' },
    { href: '/chat',     icon: <IcMessage size={16} />, label: 'Chat' },
    ...(profile?.is_admin ? [{ href: '/admin', icon: <IcTarget size={16} />, label: 'Backoffice' }] : []),
    { href: '/settings', icon: <IcCog size={16} />,    label: 'Ajustes' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '6px 8px 18px',
        borderBottom: '1px solid var(--border)',
      }}>
        <Image
          src="/assets/matraz-innova-logo.png"
          alt="Matraz Innova"
          width={148}
          height={42}
          style={{ width: 148, height: 'auto', display: 'block' }}
          priority
        />
        <div style={{ fontSize: '8.5px', letterSpacing: '0.18em', color: 'var(--muted-2)', fontWeight: 500, textAlign: 'center', lineHeight: 1.6 }}>
          Life Sciences · People · Reaction
          <span style={{ display: 'block', marginTop: 1, letterSpacing: '0.28em', color: 'var(--muted-2)', opacity: 0.6, fontSize: '7.5px' }}>v2.0</span>
        </div>
      </div>

      {/* Primary nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted-2)', textTransform: 'uppercase', fontWeight: 600, padding: '0 12px 8px' }}>
          Workspace
        </div>
        {primary.map((n) => (
          <NavItem key={n.href} {...n} active={isActive(n.href)} />
        ))}
      </nav>

      {/* Secondary nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted-2)', textTransform: 'uppercase', fontWeight: 600, padding: '0 12px 8px' }}>
          Operaciones
        </div>
        {secondary.map((n) =>
          n.href === '/chat' ? (
            <Link key={n.href} href={n.href} className={`nav-item ${isActive(n.href) ? 'active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              <ChatUnreadBadge />
            </Link>
          ) : (
            <NavItem key={n.href} {...n} active={isActive(n.href)} />
          )
        )}
      </nav>

      {/* Footer */}
      <div style={{ marginTop: 'auto' }}>
        <Link
          href="/settings"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 10,
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            marginBottom: 8,
            textDecoration: 'none',
            color: 'inherit',
            transition: 'background 120ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,212,170,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--gradient)',
            display: 'grid', placeItems: 'center',
            color: '#0a0a0b', fontWeight: 700, fontSize: 12,
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{role}</div>
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', flexShrink: 0 }}>
            <IcChevRight size={14} />
          </span>
        </Link>

        <button
          onClick={handleLogout}
          className="nav-item"
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <span className="nav-icon"><IcLogout size={16} /></span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
