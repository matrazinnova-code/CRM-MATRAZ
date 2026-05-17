import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PrintButton from './PrintButton'

const KIND_META: Record<string, { label: string; color: string; emoji: string }> = {
  call:    { label: 'Llamadas',  color: '#00D4AA', emoji: '📞' },
  email:   { label: 'Emails',   color: '#7B5FFF', emoji: '✉️' },
  meeting: { label: 'Reuniones', color: '#00B4D8', emoji: '🤝' },
  task:    { label: 'Tareas',   color: '#E040A0', emoji: '✅' },
  note:    { label: 'Notas',    color: '#C0C0C8', emoji: '📝' },
}

export default async function InformeActividadesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const [{ data: rawActs }, { data: contacts }, { data: profile }] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('contacts').select('id, name, vertical').eq('user_id', user.id),
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
  ])

  const acts = rawActs ?? []
  const contactMap = Object.fromEntries((contacts ?? []).map(c => [c.id, c]))

  const list = acts.map(a => ({ ...a, contact: a.contact_id ? (contactMap[a.contact_id] ?? null) : null }))

  // KPIs
  const total = list.length
  const byKind = Object.entries(KIND_META).map(([kind, meta]) => ({
    ...meta, kind, count: list.filter(a => a.kind === kind).length,
  })).filter(k => k.count > 0).sort((a, b) => b.count - a.count)
  const maxKind = Math.max(...byKind.map(k => k.count), 1)

  // Top contacts
  const contactCount: Record<string, { name: string; count: number; vertical: string }> = {}
  for (const a of list) {
    if (!a.contact) continue
    const id = a.contact.id
    if (!contactCount[id]) contactCount[id] = { name: a.contact.name, count: 0, vertical: a.contact.vertical }
    contactCount[id].count++
  }
  const topContacts = Object.values(contactCount).sort((a, b) => b.count - a.count).slice(0, 6)
  const maxContact = Math.max(...topContacts.map(c => c.count), 1)

  // Last 30 days vs previous
  const now = Date.now()
  const d30 = new Date(now - 30 * 86_400_000).toISOString()
  const d60 = new Date(now - 60 * 86_400_000).toISOString()
  const last30 = list.filter(a => a.created_at >= d30).length
  const prev30 = list.filter(a => a.created_at >= d60 && a.created_at < d30).length
  const trend = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : 0

  // Recent activities (last 12)
  const recent = list.slice(0, 12)

  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const authorName = profile?.full_name ?? user.email ?? '—'
  const authorRole = profile?.role ?? ''

  const VERTICAL_COLOR: Record<string, string> = {
    healthcare: '#00B4D8', it: '#7B5FFF', business: '#C0C0C8',
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .report-page { background: #fff !important; color: #000 !important; padding: 0 !important; }
          .report-card { background: #f8f8f8 !important; border: 1px solid #e0e0e0 !important; }
          .report-header { background: #0A0A0B !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @page { margin: 0; size: A4; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print" style={{
        position: 'fixed', top: 20, right: 20, zIndex: 100,
        display: 'flex', gap: 10,
      }}>
        <a href="/actividades" className="btn" style={{ display: 'inline-flex' }}>← Volver</a>
        <PrintButton />
      </div>

      <div className="report-page" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px 60px', fontFamily: 'system-ui, sans-serif' }}>

        {/* ── HEADER ── */}
        <div className="report-header" style={{
          background: '#0A0A0B', borderRadius: 16, padding: '28px 32px',
          marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00D4AA', fontWeight: 700, marginBottom: 8 }}>
              MATRAZ INNOVA · CRM
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Informe de Actividad Comercial
            </div>
            <div style={{ fontSize: 13, color: '#8A8A8F', marginTop: 6 }}>
              Generado el {today} · {total} eventos registrados
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{authorName}</div>
            <div style={{ fontSize: 12, color: '#8A8A8F', marginTop: 2 }}>{authorRole}</div>
            {trend !== 0 && (
              <div style={{
                marginTop: 10, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: trend > 0 ? 'rgba(0,212,170,0.15)' : 'rgba(224,64,160,0.15)',
                color: trend > 0 ? '#00D4AA' : '#E040A0',
              }}>
                {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% vs mes anterior
              </div>
            )}
          </div>
        </div>

        {/* ── KPI ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total actividades', value: total, color: '#00D4AA' },
            { label: 'Últimos 30 días', value: last30, color: '#7B5FFF' },
            { label: 'Contactos activos', value: topContacts.length, color: '#00B4D8' },
            { label: 'Tipos registrados', value: byKind.length, color: '#E040A0' },
          ].map(kpi => (
            <div key={kpi.label} className="report-card" style={{
              background: '#1A1A1E', border: '1px solid #2A2A30',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 11, color: '#8A8A8F', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: kpi.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

          {/* ── ACTIVIDAD POR TIPO ── */}
          <div className="report-card" style={{ background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 18, letterSpacing: '-0.01em' }}>
              Actividad por tipo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {byKind.map(k => (
                <div key={k.kind}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, color: '#fff', fontWeight: 500 }}>{k.emoji} {k.label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: k.color }}>{k.count}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(k.count / maxKind) * 100}%`, background: k.color, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
              {byKind.length === 0 && (
                <div style={{ fontSize: 12, color: '#6A6A70', textAlign: 'center', padding: '20px 0' }}>Sin actividades</div>
              )}
            </div>
          </div>

          {/* ── TOP CONTACTOS ── */}
          <div className="report-card" style={{ background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 18, letterSpacing: '-0.01em' }}>
              Contactos más activos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topContacts.map((c, i) => (
                <div key={c.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#8A8A8F', width: 16 }}>#{i + 1}</span>
                    <span style={{ fontSize: 12.5, color: '#fff', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                      background: `${VERTICAL_COLOR[c.vertical] ?? '#8A8A8F'}20`,
                      color: VERTICAL_COLOR[c.vertical] ?? '#8A8A8F',
                    }}>{c.vertical}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#00D4AA', width: 20, textAlign: 'right' }}>{c.count}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginLeft: 24 }}>
                    <div style={{ height: '100%', width: `${(c.count / maxContact) * 100}%`, background: VERTICAL_COLOR[c.vertical] ?? '#00D4AA', borderRadius: 99 }} />
                  </div>
                </div>
              ))}
              {topContacts.length === 0 && (
                <div style={{ fontSize: 12, color: '#6A6A70', textAlign: 'center', padding: '20px 0' }}>Sin contactos con actividad</div>
              )}
            </div>
          </div>
        </div>

        {/* ── ÚLTIMAS ACTIVIDADES ── */}
        <div className="report-card" style={{ background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: '-0.01em' }}>
            Últimas actividades registradas
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2A2A30' }}>
                {['Fecha', 'Tipo', 'Título', 'Contacto', 'Notas'].map(h => (
                  <th key={h} style={{ padding: '0 10px 10px 0', textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6A6A70' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((a, i) => {
                const meta = KIND_META[a.kind] ?? KIND_META.note
                return (
                  <tr key={a.id} style={{ borderBottom: i < recent.length - 1 ? '1px solid #1E1E22' : 'none' }}>
                    <td style={{ padding: '9px 10px 9px 0', color: '#8A8A8F', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(a.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </td>
                    <td style={{ padding: '9px 10px 9px 0' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${meta.color}20`, color: meta.color }}>
                        {meta.emoji} {meta.label.slice(0, -1)}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px 9px 0', color: '#fff', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.title}
                    </td>
                    <td style={{ padding: '9px 10px 9px 0', color: '#8A8A8F', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.contact?.name ?? '—'}
                    </td>
                    <td style={{ padding: '9px 0', color: '#6A6A70', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.body ?? '—'}
                    </td>
                  </tr>
                )
              })}
              {recent.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '20px 0', textAlign: 'center', color: '#6A6A70' }}>Sin actividades registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#6A6A70' }}>
          <span>Matraz Innova CRM · v2.0</span>
          <span>Generado el {today}</span>
        </div>
      </div>
    </>
  )
}
