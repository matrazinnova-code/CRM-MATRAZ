'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { IcSearch, IcPlus, IcBell, IcCalendar, IcChevRight, IcUsers, IcBrief, IcBuilding, IcPhone, IcMail, IcVideo, IcMessage, IcCheck, IcDoc } from '@/components/ui/Icons'
import { getRecentActivities } from '@/lib/actions'
import { createClient } from '@/lib/supabase/client'

const BREADCRUMBS: Record<string, [string, string]> = {
  '/':           ['Workspace', 'Dashboard'],
  '/contacts':   ['Workspace', 'Contactos'],
  '/pipeline':   ['Workspace', 'Pipeline'],
  '/deals/new':  ['Pipeline', 'Nuevo deal'],
  '/activities': ['Workspace', 'Actividades'],
  '/reports':    ['Operaciones', 'Reportes'],
  '/inbox':      ['Operaciones', 'Inbox'],
  '/settings':   ['Operaciones', 'Ajustes'],
}

type Results = { contacts: { id: string; name: string; role: string | null; vertical: string }[]; deals: { id: string; title: string; value: number; stage: string }[]; companies: { id: string; name: string; industry: string | null }[] }

export default function Topbar() {
  const pathname = usePathname()
  const router   = useRouter()

  const isContactDetail = pathname.startsWith('/contacts/') && pathname !== '/contacts'
  const [parent, current] = isContactDetail
    ? ['Contactos', 'Detalle']
    : (BREADCRUMBS[pathname] ?? ['Workspace', 'Dashboard'])

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Notifications
  type Activity = Awaited<ReturnType<typeof getRecentActivities>>[number]
  const [bellOpen,    setBellOpen]    = useState(false)
  const [notifs,      setNotifs]      = useState<Activity[]>([])
  const [notifsLoaded,setNotifsLoaded]= useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openBell = async () => {
    setBellOpen((o) => !o)
    if (!notifsLoaded) {
      const data = await getRecentActivities(8)
      setNotifs(data)
      setNotifsLoaded(true)
    }
  }

  const KIND_ICON: Record<string, React.ReactNode> = {
    call: <IcPhone size={13} />, email: <IcMail size={13} />,
    meeting: <IcVideo size={13} />, note: <IcMessage size={13} />,
    task: <IcCheck size={13} />, doc: <IcDoc size={13} />,
  }
  const KIND_COLOR: Record<string, string> = {
    call: '#00D4AA', email: '#7B5FFF', meeting: '#00B4D8',
    note: '#C0C0C8', task: '#E040A0', doc: '#F59E0B',
  }

  // Outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = useCallback((val: string) => {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!val.trim()) { setResults(null); setOpen(false); return }
    setLoading(true)
    setOpen(true)
    timerRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) { setLoading(false); return }
      const q = val.trim()
      const [{ data: contacts }, { data: deals }, { data: companies }] = await Promise.all([
        supabase.from('contacts').select('id, name, role, vertical').eq('user_id', uid).ilike('name', `%${q}%`).limit(5),
        supabase.from('deals').select('id, title, value, stage').eq('user_id', uid).ilike('title', `%${q}%`).limit(5),
        supabase.from('companies').select('id, name, industry').eq('user_id', uid).ilike('name', `%${q}%`).limit(5),
      ])
      setResults({ contacts: contacts ?? [], deals: deals ?? [], companies: companies ?? [] })
      setLoading(false)
    }, 260)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  const navigate = (href: string) => {
    setOpen(false)
    setQuery('')
    setResults(null)
    router.push(href)
  }

  const total = results
    ? results.contacts.length + results.deals.length + results.companies.length
    : 0

  const fmtVal = (v: number) =>
    v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : `€${(v / 1000).toFixed(0)}K`

  return (
    <header className="topbar">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
        <span>{parent}</span>
        <IcChevRight size={12} />
        <span style={{ color: '#fff', fontWeight: 600 }}>{current}</span>
      </div>

      {/* Search */}
      <div ref={wrapRef} style={{ position: 'relative', marginLeft: 'auto', width: 340 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
          <IcSearch size={16} />
        </span>
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar contactos, deals, empresas…"
          style={{
            width: '100%', height: 38,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 9, color: '#fff',
            padding: '0 12px 0 38px',
            fontFamily: 'inherit', fontSize: 13, outline: 'none',
            transition: 'border-color 120ms, background 120ms',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--teal)'
            e.currentTarget.style.background = 'rgba(0,212,170,0.04)'
            if (query.trim()) setOpen(true)
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
          }}
        />
        {!query && (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            font: '500 10.5px var(--font-jetbrains, monospace)',
            color: 'var(--muted-2)', border: '1px solid var(--border)',
            padding: '2px 6px', borderRadius: 4, pointerEvents: 'none',
          }}>⌘K</span>
        )}

        {/* Dropdown */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 300,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            {loading && (
              <div style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: 13 }}>Buscando…</div>
            )}
            {!loading && results && total === 0 && (
              <div style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: 13 }}>Sin resultados para "{query}"</div>
            )}
            {!loading && results && total > 0 && (
              <>
                {results.contacts.length > 0 && (
                  <Section label="Contactos" icon={<IcUsers size={12} />}>
                    {results.contacts.map((c) => (
                      <Row key={c.id} onClick={() => navigate(`/contacts/${c.id}`)}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--gradient)', display: 'grid', placeItems: 'center',
                          color: '#0a0a0b', fontWeight: 700, fontSize: 10,
                        }}>
                          {c.name.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('')}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.role ?? c.vertical}</div>
                        </div>
                      </Row>
                    ))}
                  </Section>
                )}
                {results.deals.length > 0 && (
                  <Section label="Deals" icon={<IcBrief size={12} />}>
                    {results.deals.map((d) => (
                      <Row key={d.id} onClick={() => navigate('/pipeline')}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: 'rgba(123,95,255,0.15)', display: 'grid', placeItems: 'center',
                          color: '#7B5FFF',
                        }}>
                          <IcBrief size={13} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.stage} · {fmtVal(d.value)}</div>
                        </div>
                      </Row>
                    ))}
                  </Section>
                )}
                {results.companies.length > 0 && (
                  <Section label="Empresas" icon={<IcBuilding size={12} />}>
                    {results.companies.map((co) => (
                      <Row key={co.id} onClick={() => navigate('/contacts')}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: 'rgba(0,180,216,0.12)', display: 'grid', placeItems: 'center',
                          color: '#00B4D8',
                        }}>
                          <IcBuilding size={13} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{co.industry ?? 'Empresa'}</div>
                        </div>
                      </Row>
                    ))}
                  </Section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <button className="icon-btn" title="Nuevo deal" onClick={() => router.push('/deals/new')} style={{ width: 38, height: 38 }}>
        <IcPlus size={16} />
      </button>

      {/* Bell */}
      <div ref={bellRef} style={{ position: 'relative' }}>
        <button className="icon-btn" title="Actividad reciente" onClick={openBell} style={{ width: 38, height: 38 }}>
          <IcBell size={16} />
          {notifs.length > 0 || !notifsLoaded ? (
            <span style={{
              position: 'absolute', top: 9, right: 10,
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--teal)', boxShadow: '0 0 0 2px var(--bg)',
            }} />
          ) : null}
        </button>

        {bellOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
            width: 320, background: 'var(--surface-2)',
            border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px 8px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
              Actividad reciente
            </div>
            {notifs.length === 0 ? (
              <div style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
                No hay actividades registradas
              </div>
            ) : (
              <div>
                {notifs.map((n) => {
                  const contact = n.contact as { id: string; name: string } | null
                  const color = KIND_COLOR[n.kind] ?? '#8A8A8F'
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(n.created_at).getTime()
                    const mins = Math.floor(diff / 60000)
                    if (mins < 60) return `${mins}m`
                    const hrs = Math.floor(mins / 60)
                    if (hrs < 24) return `${hrs}h`
                    return `${Math.floor(hrs / 24)}d`
                  })()
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        setBellOpen(false)
                        if (contact) router.push(`/contacts/${contact.id}`)
                        else router.push('/activities')
                      }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        width: '100%', padding: '10px 16px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', color: '#fff', borderTop: '1px solid var(--border-soft)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: `${color}18`, display: 'grid', placeItems: 'center', color,
                      }}>
                        {KIND_ICON[n.kind] ?? <IcMessage size={13} />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {contact?.name ?? 'Sin contacto'} · {timeAgo}
                        </div>
                      </div>
                    </button>
                  )
                })}
                <button
                  onClick={() => { setBellOpen(false); router.push('/activities') }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px',
                    background: 'none', border: 'none', borderTop: '1px solid var(--border)',
                    color: 'var(--teal)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    textAlign: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,212,170,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  Ver todas las actividades →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendar → Activities */}
      <button className="icon-btn" title="Actividades" onClick={() => router.push('/activities')} style={{ width: 38, height: 38 }}>
        <IcCalendar size={16} />
      </button>
    </header>
  )
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px 4px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: 'var(--muted-2)',
      }}>
        {icon} {label}
      </div>
      {children}
    </div>
  )
}

function Row({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 14px',
        background: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left', color: '#fff',
        transition: 'background 80ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      {children}
    </button>
  )
}
