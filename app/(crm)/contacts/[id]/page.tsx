import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Timeline from '@/components/contacts/Timeline'
import EditContactButton from '@/components/contacts/EditContactButton'
import { VerticalBadge, StatusBadge } from '@/components/ui/Badge'
import {
  IcChevRight, IcBuilding, IcMail, IcPhone, IcMapPin, IcLinkedin,
  IcCalendar, IcBrief,
} from '@/components/ui/Icons'
import type { Contact, Activity, Deal } from '@/lib/supabase/database.types'

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: contact }, { data: activities }, { data: deals }] = await Promise.all([
    supabase
      .from('contacts')
      .select('*, company:companies(*)')
      .eq('id', params.id)
      .eq('user_id', user!.id)
      .single(),
    supabase
      .from('activities')
      .select('*')
      .eq('contact_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('deals')
      .select('*')
      .eq('contact_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (!contact) notFound()

  const c = contact as Contact
  const leadScore = c.lead_score ?? 0
  const pipelineValue = c.pipeline_value ?? 0
  const initials = (c.name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const linkedinSlug = (c.name ?? '').toLowerCase().replace(/\s+/g, '-')
  const activeDeals = (deals ?? []).filter((d: Deal) => d.stage !== 'won' && d.stage !== 'lost')

  const STAGE_COLORS: Record<string, string> = {
    lead: '#8A8A8F', qualified: '#C0C0C8', proposal: '#00B4D8',
    negotiation: '#7B5FFF', closing: '#E040A0', won: '#00D4AA', lost: '#6A6A70',
  }

  return (
    <div style={{ padding: '28px 32px 56px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
        <Link href="/contacts" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Contactos</Link>
        <IcChevRight size={12} />
        <span style={{ color: '#fff', fontWeight: 600 }}>{c.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left rail */}
        <div>
          {/* Contact card */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <EditContactButton contact={c} />
            </div>
            <div style={{
              width: 76, height: 76, borderRadius: '50%', margin: '0 auto 14px',
              display: 'grid', placeItems: 'center',
              fontWeight: 800, fontSize: 26, letterSpacing: '0.01em',
              background: 'var(--gradient)', color: '#0A0A0B',
            }}>
              {initials}
            </div>
            <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>{c.name}</div>
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{c.role ?? '—'}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
              <VerticalBadge vertical={c.vertical} />
              <StatusBadge status={c.status} />
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
              <button className="btn teal" style={{ justifyContent: 'center' }}><IcPhone size={14} /> Llamar</button>
              <button className="btn" style={{ justifyContent: 'center' }}><IcMail size={14} /> Email</button>
              <button className="btn" style={{ gridColumn: '1 / -1', justifyContent: 'center' }}><IcCalendar size={14} /> Agendar reunión</button>
            </div>

            {/* Meta */}
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: <IcBuilding size={16} />, label: 'Empresa', value: c.company?.name ?? '—' },
                { icon: <IcMail size={16} />,     label: 'Email',   value: c.email ?? '—', small: true },
                { icon: <IcPhone size={16} />,    label: 'Tel.',    value: c.phone ?? '—', mono: true },
                { icon: <IcMapPin size={16} />,   label: 'Sede',    value: c.city ?? '—' },
                { icon: <IcLinkedin size={16} />, label: 'Social',  value: `linkedin.com/in/${linkedinSlug}`, teal: true },
              ].map((m) => (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                  <span style={{ color: 'var(--teal)', flexShrink: 0 }}>{m.icon}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, width: 70 }}>{m.label}</span>
                  <span style={{
                    color: m.teal ? 'var(--teal)' : '#fff',
                    fontSize: m.small ? 12 : 13,
                    fontFamily: m.mono ? 'JetBrains Mono, monospace' : 'inherit',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lead score */}
          <div className="card" style={{ marginTop: 16, padding: 22 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>
              Lead Score
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div className="gradient-text" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1 }}>{leadScore}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>/ 100 · {leadScore >= 70 ? 'alto' : leadScore >= 40 ? 'medio' : 'bajo'}</div>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${leadScore}%`, background: 'var(--gradient)', borderRadius: 99 }} />
            </div>
          </div>

          {/* Deals */}
          {(deals ?? []).length > 0 && (
            <div className="card" style={{ marginTop: 16, padding: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Deals asociados</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(deals as Deal[]).slice(0, 4).map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLORS[d.stage], display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--teal)', flexShrink: 0 }}>
                      €{(d.value / 1000).toFixed(0)}K
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: stats + timeline */}
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
            {[
              {
                label: 'Valor en pipeline',
                value: `€${pipelineValue.toLocaleString('en-US')}`,
                sub: `${activeDeals.length} deal${activeDeals.length !== 1 ? 's' : ''} activos`,
              },
              {
                label: 'Deals totales',
                value: String((deals ?? []).length),
                sub: `${(deals ?? []).filter((d: Deal) => d.stage === 'won').length} cerrados`,
              },
              {
                label: 'Registrado',
                value: new Date(c.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                sub: 'fecha de alta',
              },
            ].map((s) => (
              <div key={s.label} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Timeline card */}
          <div className="card">
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Timeline de actividad</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{(activities ?? []).length} eventos registrados</div>
              </div>
            </div>
            <div style={{ padding: '6px 22px 18px' }}>
              <Timeline activities={(activities ?? []) as Activity[]} contactId={c.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
