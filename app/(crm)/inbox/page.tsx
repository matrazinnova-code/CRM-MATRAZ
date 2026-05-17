import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { IcBrief, IcUsers, IcCalendar, IcPhone, IcMail, IcTarget } from '@/components/ui/Icons'
import type { Deal, Contact, Activity } from '@/lib/supabase/database.types'

const KPI_CALLS_PER_DAY     = 80
const KPI_MEETINGS_PER_WEEK = 5

function workingDaysElapsed(): number {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth()
  let count = 0
  for (let d = 1; d <= today.getDate(); d++) {
    const dow = new Date(y, m, d).getDay()
    if (dow >= 1 && dow <= 5) count++
  }
  return count
}

function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso + 'T12:00:00').getTime() - Date.now()) / 86_400_000)
}

function fmt(v: number) {
  return v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : `€${(v / 1000).toFixed(0)}K`
}

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now  = new Date().toISOString()
  const d14  = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const d30  = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const d7f  = new Date(Date.now() +  7 * 86_400_000).toISOString().slice(0, 10)

  const [
    { data: rawDeals },
    { data: rawContacts },
    { data: rawActs },
  ] = await Promise.all([
    supabase.from('deals').select('id,title,value,stage,close_date,contact_id').eq('user_id', user.id),
    supabase.from('contacts').select('id,name,email,phone,vertical,status,created_at').eq('user_id', user.id),
    supabase.from('activities').select('contact_id,deal_id,created_at,kind').eq('user_id', user.id),
  ])

  const deals    = (rawDeals    ?? []) as Deal[]
  const contacts = (rawContacts ?? []) as Contact[]
  const acts     = (rawActs     ?? []) as Activity[]

  // Build contact map for deal contact names
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]))

  // Last activity date per deal and contact
  const lastByDeal: Record<string, string>    = {}
  const lastByContact: Record<string, string> = {}
  for (const a of acts) {
    if (a.deal_id    && (!lastByDeal[a.deal_id]       || a.created_at > lastByDeal[a.deal_id]))       lastByDeal[a.deal_id]       = a.created_at
    if (a.contact_id && (!lastByContact[a.contact_id] || a.created_at > lastByContact[a.contact_id])) lastByContact[a.contact_id] = a.created_at
  }

  // 1. Cierre inminente — open deals with close_date in next 7 days
  const closingSoon = deals
    .filter(d => d.stage !== 'won' && d.stage !== 'lost' && d.close_date)
    .filter(d => d.close_date! >= now.slice(0, 10) && d.close_date! <= d7f)
    .sort((a, b) => a.close_date!.localeCompare(b.close_date!))

  // 2. Deals sin actividad — open, no activity in 14+ days
  const dealsAtRisk = deals
    .filter(d => d.stage !== 'won' && d.stage !== 'lost')
    .filter(d => !lastByDeal[d.id] || lastByDeal[d.id] < d14)
    .sort((a, b) => (lastByDeal[a.id] ?? '') < (lastByDeal[b.id] ?? '') ? -1 : 1)
    .slice(0, 8)

  // 3. Nuevos sin actividad — added in last 7 days, no activity
  const newNoActivity = contacts
    .filter(c => !lastByContact[c.id] && daysAgo(c.created_at) <= 7)
    .slice(0, 5)

  // 4. Contactos fríos — prospect/customer, no activity in 30+ days
  const coldContacts = contacts
    .filter(c => c.status !== 'lead')
    .filter(c => !lastByContact[c.id] || lastByContact[c.id] < d30)
    .slice(0, 6)

  // 5. KPI this month
  const wd            = workingDaysElapsed()
  const callTarget    = KPI_CALLS_PER_DAY * wd
  const meetingTarget = Math.round(KPI_MEETINGS_PER_WEEK * (wd / 5))
  const monthStart    = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const callsNow      = acts.filter(a => a.kind === 'call'    && a.created_at >= monthStart).length
  const meetingsNow   = acts.filter(a => a.kind === 'meeting' && a.created_at >= monthStart).length
  const callPct       = callTarget    > 0 ? Math.min(Math.round((callsNow    / callTarget)    * 100), 100) : 0
  const meetingPct    = meetingTarget > 0 ? Math.min(Math.round((meetingsNow / meetingTarget) * 100), 100) : 0

  const totalAlerts = closingSoon.length + dealsAtRisk.length + newNoActivity.length + coldContacts.length

  return (
    <div style={{ padding: '28px 32px 56px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Inbox</div>
        <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 5 }}>
          Centro de alertas comerciales ·{' '}
          <span style={{ color: totalAlerts > 0 ? 'var(--magenta)' : 'var(--teal)', fontWeight: 600 }}>
            {totalAlerts} {totalAlerts === 1 ? 'acción pendiente' : 'acciones pendientes'}
          </span>
        </div>
      </div>

      {/* KPI Status */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {[
          {
            icon: <IcPhone size={14} />, label: 'Llamadas este mes',
            current: callsNow, target: callTarget, pct: callPct,
            color: callPct >= 100 ? '#00D4AA' : callPct >= 70 ? '#F59E0B' : 'var(--magenta)',
            sub: `Objetivo: ${KPI_CALLS_PER_DAY}/día · ${wd} días laborables`,
          },
          {
            icon: <IcCalendar size={14} />, label: 'Reuniones este mes',
            current: meetingsNow, target: meetingTarget, pct: meetingPct,
            color: meetingPct >= 100 ? '#00D4AA' : meetingPct >= 70 ? '#F59E0B' : 'var(--magenta)',
            sub: `Objetivo: ${KPI_MEETINGS_PER_WEEK}/semana · ${meetingTarget} este mes`,
          },
        ].map(kpi => (
          <div key={kpi.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: kpi.color }}>{kpi.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{kpi.label}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: kpi.color }}>
                {kpi.current} / {kpi.target} ({kpi.pct}%)
              </span>
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${kpi.pct}%`, borderRadius: 99, background: kpi.color }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Cierre inminente */}
        {closingSoon.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <SectionHeader icon={<IcTarget size={15} />} color="#E040A0"
              title="⚡ Cierre inminente"
              subtitle={`${closingSoon.length} deal${closingSoon.length > 1 ? 's' : ''} con fecha de cierre en los próximos 7 días`} />
            {closingSoon.map((d, i) => (
              <Link key={d.id} href="/pipeline" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)', textDecoration: 'none', color: 'inherit', background: 'rgba(224,64,160,0.03)' }}>
                <div style={{ width: 3, height: 36, borderRadius: 99, background: 'var(--magenta)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {d.contact_id ? (contactMap[d.contact_id]?.name ?? '—') : '—'} · Cierra el{' '}
                    <span style={{ color: '#E040A0', fontWeight: 600 }}>
                      {new Date(d.close_date! + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                    {' '}· en {daysUntil(d.close_date!)} días
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>{fmt(d.value)}</div>
              </Link>
            ))}
          </div>
        )}

        {/* Deals sin actividad */}
        {dealsAtRisk.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <SectionHeader icon={<IcBrief size={15} />} color="#F59E0B"
              title="⚠️ Deals sin actividad"
              subtitle={`${dealsAtRisk.length} deal${dealsAtRisk.length > 1 ? 's' : ''} abiertos sin contacto en más de 14 días`} />
            {dealsAtRisk.map((d, i) => {
              const last = lastByDeal[d.id]
              return (
                <Link key={d.id} href="/pipeline" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Etapa: <span style={{ textTransform: 'capitalize' }}>{d.stage}</span> ·{' '}
                      <span style={{ color: '#F59E0B' }}>
                        {last ? `Último contacto hace ${daysAgo(last)} días` : 'Sin actividad registrada'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>{fmt(d.value)}</div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Nuevos sin actividad */}
        {newNoActivity.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <SectionHeader icon={<IcUsers size={15} />} color="#7B5FFF"
              title="🆕 Nuevos contactos sin actividad"
              subtitle="Añadidos esta semana y aún sin ninguna interacción registrada" />
            {newNoActivity.map((c, i) => (
              <Link key={c.id} href={`/contacts/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {c.email ?? c.phone ?? '—'} · Añadido hace {daysAgo(c.created_at)} días
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {c.email  && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'rgba(123,95,255,0.12)', color: '#7B5FFF', fontWeight: 600 }}>Email</span>}
                  {c.phone  && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'rgba(0,212,170,0.12)', color: '#00D4AA', fontWeight: 600 }}>Llamar</span>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Contactos fríos */}
        {coldContacts.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <SectionHeader icon={<IcMail size={15} />} color="#00B4D8"
              title="❄️ Contactos fríos"
              subtitle="Prospects y Customers sin actividad en más de 30 días" />
            {coldContacts.map((c, i) => {
              const last = lastByContact[c.id]
              return (
                <Link key={c.id} href={`/contacts/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      <span style={{ textTransform: 'capitalize' }}>{c.status}</span> ·{' '}
                      <span style={{ color: '#00B4D8' }}>
                        {last ? `Sin contacto desde hace ${daysAgo(last)} días` : 'Nunca contactado'}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 600, flexShrink: 0 }}>Ver perfil →</span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {totalAlerts === 0 && (
          <div className="card" style={{ padding: '56px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Todo al día</div>
            <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 8, maxWidth: 360, margin: '8px auto 0' }}>
              No hay alertas pendientes. Todos tus deals y contactos están activos.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ icon, color, title, subtitle }: { icon: React.ReactNode; color: string; title: string; subtitle: string }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}18`, display: 'grid', placeItems: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  )
}
