import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  IcPhone, IcMail, IcVideo, IcMessage, IcCheck, IcDoc,
  IcCalendar, IcUsers, IcBrief, IcTarget, IcWallet, IcChart,
} from '@/components/ui/Icons'
import type { Activity, Deal, Contact } from '@/lib/supabase/database.types'

const KIND_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  call:    { label: 'Llamadas',   color: '#00D4AA', icon: <IcPhone size={14} /> },
  email:   { label: 'Emails',     color: '#7B5FFF', icon: <IcMail size={14} /> },
  meeting: { label: 'Reuniones',  color: '#00B4D8', icon: <IcVideo size={14} /> },
  note:    { label: 'Notas',      color: '#C0C0C8', icon: <IcMessage size={14} /> },
  task:    { label: 'Tareas',     color: '#E040A0', icon: <IcCheck size={14} /> },
  doc:     { label: 'Documentos', color: '#F59E0B', icon: <IcDoc size={14} /> },
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', closing: 'Closing', won: 'Won', lost: 'Lost',
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: rawActs }, { data: deals }, { data: contacts }] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
    supabase.from('deals').select('*').eq('user_id', user!.id),
    supabase.from('contacts').select('id, name, vertical, status, lead_score').eq('user_id', user!.id),
  ])

  const allContacts = (contacts ?? []) as Contact[]
  const contactMap = Object.fromEntries(allContacts.map((c) => [c.id, c]))
  const acts = (rawActs ?? []).map((a: Activity) => ({
    ...a,
    contact: a.contact_id ? (contactMap[a.contact_id] ?? null) : null,
  })) as (Activity & { contact: { id: string; name: string } | null })[]
  const allDeals = (deals ?? []) as Deal[]

  // Activity stats by kind
  const byKind = acts.reduce((acc, a) => {
    acc[a.kind] = (acc[a.kind] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Activity by day (last 30 days)
  const last30 = acts.filter((a) => {
    const d = new Date(a.created_at)
    return Date.now() - d.getTime() < 30 * 86_400_000
  })

  // Deal stats
  const wonDeals  = allDeals.filter((d) => d.stage === 'won')
  const openDeals = allDeals.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const totalWon  = wonDeals.reduce((s, d) => s + d.value, 0)
  const totalOpen = openDeals.reduce((s, d) => s + d.value, 0)
  const closeRate = allDeals.length > 0 ? Math.round((wonDeals.length / allDeals.length) * 100) : 0

  // Deals by stage
  const byStage = allDeals.reduce((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Contact stats
  const byStatus = allContacts.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const avgLeadScore = allContacts.length > 0
    ? Math.round(allContacts.reduce((s, c) => s + (c.lead_score ?? 0), 0) / allContacts.length)
    : 0

  const fmt = (v: number) => v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(2)}M` : `€${(v / 1000).toFixed(0)}K`

  // Monthly breakdown (last 12 months with data)
  const monthlyMap: Record<string, Record<string, number>> = {}
  for (const a of acts) {
    const d = new Date(a.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyMap[key]) monthlyMap[key] = {}
    monthlyMap[key][a.kind] = (monthlyMap[key][a.kind] ?? 0) + 1
  }
  // KPI targets
  const KPI_CALLS_PER_DAY = 80
  const KPI_MEETINGS_PER_WEEK = 5

  function workingDaysInPeriod(year: number, month: number): { total: number; elapsed: number } {
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
    const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate()
    let total = 0, elapsed = 0
    for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow >= 1 && dow <= 5) {
        total++
        if (d <= lastDay) elapsed++
      }
    }
    return { total, elapsed }
  }

  const monthlyRows = Object.entries(monthlyMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([key, counts]) => {
      const [year, month] = key.split('-')
      const y = Number(year), m = Number(month)
      const label = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      const total = Object.values(counts).reduce((s, v) => s + v, 0)

      const { total: wdTotal, elapsed: wdElapsed } = workingDaysInPeriod(y, m)
      const isCurrentMonth = new Date().getFullYear() === y && new Date().getMonth() + 1 === m
      const activeDays = isCurrentMonth ? wdElapsed : wdTotal

      const callTarget    = KPI_CALLS_PER_DAY * activeDays
      const meetingTarget = Math.round(KPI_MEETINGS_PER_WEEK * (activeDays / 5))

      const calls    = counts['call']    ?? 0
      const meetings = counts['meeting'] ?? 0

      const callPct    = callTarget    > 0 ? Math.min(Math.round((calls    / callTarget)    * 100), 100) : 0
      const meetingPct = meetingTarget > 0 ? Math.min(Math.round((meetings / meetingTarget) * 100), 100) : 0

      const callOk    = callPct    >= 100
      const meetingOk = meetingPct >= 100

      return {
        label, counts, total, isCurrentMonth,
        callTarget, meetingTarget, calls, meetings,
        callPct, meetingPct, callOk, meetingOk,
      }
    })

  const kindKeys = ['call', 'email', 'meeting', 'task', 'note']

  // Group recent activities by date
  const grouped = acts.slice(0, 30).reduce((acc, a) => {
    const day = new Date(a.created_at).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })
    if (!acc[day]) acc[day] = []
    acc[day].push(a)
    return acc
  }, {} as Record<string, typeof acts>)

  const statCard = (label: string, value: string, sub: string, icon: React.ReactNode, color = 'var(--teal)') => (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'grid', placeItems: 'center', color }}>{icon}</div>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ padding: '28px 32px 56px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Reportes</div>
        <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6 }}>
          Resumen de actividad · <b style={{ color: '#fff' }}>{acts.length}</b> eventos · <b style={{ color: 'var(--teal)' }}>{last30.length}</b> en los últimos 30 días
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {statCard('Revenue cerrado', fmt(totalWon), `${wonDeals.length} deals cerrados`, <IcWallet size={15} />)}
        {statCard('Pipeline activo', fmt(totalOpen), `${openDeals.length} deals abiertos`, <IcBrief size={15} />, '#7B5FFF')}
        {statCard('Tasa de cierre', `${closeRate}%`, `${wonDeals.length} de ${allDeals.length} deals`, <IcTarget size={15} />, '#00B4D8')}
        {statCard('Actividades', String(acts.length), `${last30.length} últimos 30 días`, <IcCalendar size={15} />, '#E040A0')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Activity by kind */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcChart size={15} /> Actividad por tipo
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(KIND_META).map(([kind, meta]) => {
              const count = byKind[kind] ?? 0
              const max = Math.max(...Object.values(byKind), 1)
              return (
                <div key={kind}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{meta.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: meta.color, borderRadius: 99, transition: 'width 400ms' }} />
                  </div>
                </div>
              )
            })}
            {acts.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Sin actividades registradas</div>}
          </div>
        </div>

        {/* Deals by stage */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcBrief size={15} /> Deals por etapa
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['lead','qualified','proposal','negotiation','closing','won','lost'].map((stage) => {
              const count = byStage[stage] ?? 0
              const max = Math.max(...Object.values(byStage), 1)
              const color = stage === 'won' ? '#00D4AA' : stage === 'lost' ? '#6A6A70' : '#7B5FFF'
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, color: count === 0 ? 'var(--muted-2)' : '#fff' }}>{STAGE_LABELS[stage]}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: count === 0 ? 'var(--muted-2)' : '#fff' }}>{count}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: color, borderRadius: 99 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Contact stats */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcUsers size={15} /> Contactos
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Lead',     val: byStatus.lead ?? 0,     color: '#8A8A8F' },
                { label: 'Prospect', val: byStatus.prospect ?? 0, color: '#7B5FFF' },
                { label: 'Customer', val: byStatus.customer ?? 0, color: '#00D4AA' },
              ].map((s) => {
                const total = allContacts.length || 1
                return (
                  <div key={s.label}>
                    <div style={{ display: 'flex', marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{s.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{s.val}</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(s.val / total) * 100}%`, background: s.color, borderRadius: 99 }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Total contactos</span>
                <span style={{ fontWeight: 700 }}>{allContacts.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Lead score medio</span>
                <span style={{ fontWeight: 700, color: avgLeadScore >= 70 ? 'var(--teal)' : avgLeadScore >= 40 ? '#F59E0B' : 'var(--muted)' }}>{avgLeadScore}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly breakdown */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Actividad mensual por tipo</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Número de interacciones registradas cada mes</div>
        </div>

        {monthlyRows.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Sin actividades registradas.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '11px 22px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    Mes
                  </th>
                  {kindKeys.map(k => (
                    <th key={k} style={{ padding: '11px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: KIND_META[k]?.color ?? 'var(--muted)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        {KIND_META[k]?.icon} {KIND_META[k]?.label}
                      </span>
                    </th>
                  ))}
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    Total
                  </th>
                  <th style={{ padding: '11px 22px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F59E0B', whiteSpace: 'nowrap' }}>
                    KPI mensual
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row, i) => {
                  const bothOk  = row.callOk && row.meetingOk
                  const noneOk  = !row.callOk && !row.meetingOk
                  const kpiColor = bothOk ? '#00D4AA' : noneOk ? '#E040A0' : '#F59E0B'
                  const kpiLabel = bothOk ? '✅ Cumplido' : noneOk ? '❌ No cumplido' : '⚠️ Parcial'

                  return (
                  <tr key={row.label} style={{ borderBottom: i < monthlyRows.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '12px 22px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                      {row.label}
                      {row.isCurrentMonth && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--teal)', fontWeight: 700, letterSpacing: '0.1em' }}>EN CURSO</span>}
                    </td>
                    {kindKeys.map(k => {
                      const val = row.counts[k] ?? 0
                      const color = KIND_META[k]?.color ?? 'var(--muted)'
                      return (
                        <td key={k} style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {val > 0 ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              minWidth: 28, height: 24, borderRadius: 6,
                              background: `${color}18`, color, fontWeight: 700, fontSize: 13,
                              padding: '0 8px',
                            }}>
                              {val}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted-2)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--teal)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.total}
                    </td>
                    <td style={{ padding: '12px 22px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                        {/* Badge */}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                          background: `${kpiColor}18`, color: kpiColor, border: `1px solid ${kpiColor}30`,
                          alignSelf: 'flex-start',
                        }}>
                          {kpiLabel}
                        </span>
                        {/* Call KPI bar */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>
                            <span>📞 Llamadas</span>
                            <span style={{ color: row.callOk ? '#00D4AA' : '#fff' }}>{row.calls} / {row.callTarget}</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${row.callPct}%`, borderRadius: 99, background: row.callOk ? '#00D4AA' : row.callPct >= 70 ? '#F59E0B' : '#E040A0' }} />
                          </div>
                        </div>
                        {/* Meeting KPI bar */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>
                            <span>🤝 Reuniones</span>
                            <span style={{ color: row.meetingOk ? '#00D4AA' : '#fff' }}>{row.meetings} / {row.meetingTarget}</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${row.meetingPct}%`, borderRadius: 99, background: row.meetingOk ? '#00D4AA' : row.meetingPct >= 70 ? '#F59E0B' : '#E040A0' }} />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity timeline */}
      <div className="card">
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Historial de actividades</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Las últimas 30 actividades registradas</div>
          </div>
          <Link href="/activities" className="btn ghost" style={{ height: 32, padding: '0 12px', fontSize: 12 }}>
            Ver todas →
          </Link>
        </div>

        {acts.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No hay actividades registradas aún.{' '}
            <Link href="/contacts" style={{ color: 'var(--teal)' }}>Añade una desde un contacto.</Link>
          </div>
        ) : (
          Object.entries(grouped).map(([day, dayActs]) => (
            <div key={day}>
              <div style={{ padding: '10px 22px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-2)', background: 'rgba(255,255,255,0.01)' }}>
                {day}
              </div>
              {dayActs.map((a) => {
                const meta = KIND_META[a.kind] ?? KIND_META.note
                const timeStr = new Date(a.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 14, padding: '12px 22px', borderTop: '1px solid var(--border-soft)', alignItems: 'flex-start' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: `${meta.color}14`, border: `1px solid ${meta.color}30`, display: 'grid', placeItems: 'center', color: meta.color }}>
                      {meta.icon}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{a.title}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted-2)', marginLeft: 'auto', flexShrink: 0 }}>{timeStr}</span>
                      </div>
                      {a.contact && (
                        <Link href={`/contacts/${a.contact.id}`} style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}>
                          {a.contact.name}
                        </Link>
                      )}
                      {a.body && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                          {a.body}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
