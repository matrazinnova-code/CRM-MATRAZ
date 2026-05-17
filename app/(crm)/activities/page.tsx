import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  IcSparkle, IcMail, IcPhone, IcCalendar, IcBrief, IcPlus, IcDoc,
} from '@/components/ui/Icons'

const KIND_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  call:    { label: 'Llamada',  color: '#00D4AA', icon: <IcPhone size={15} /> },
  email:   { label: 'Email',   color: '#7B5FFF', icon: <IcMail size={15} /> },
  meeting: { label: 'Reunión', color: '#00B4D8', icon: <IcCalendar size={15} /> },
  task:    { label: 'Tarea',   color: '#E040A0', icon: <IcBrief size={15} /> },
  note:    { label: 'Nota',    color: '#C0C0C8', icon: <IcSparkle size={15} /> },
}

export default async function ActivitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: rawActs }, { data: contacts }] = await Promise.all([
    supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('contacts')
      .select('id, name, vertical')
      .eq('user_id', user.id),
  ])

  const contactMap = Object.fromEntries((contacts ?? []).map((c) => [c.id, c]))

  const list = (rawActs ?? []).map((a) => ({
    ...a,
    contact: a.contact_id ? (contactMap[a.contact_id] ?? null) : null,
  }))

  // Group by date
  const groups: Record<string, typeof list> = {}
  for (const a of list) {
    const day = new Date(a.created_at).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    if (!groups[day]) groups[day] = []
    groups[day].push(a)
  }

  return (
    <div style={{ padding: '28px 32px 56px', maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Actividades</div>
          <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 4 }}>
            {list.length} eventos registrados
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href="/api/export/activities"
            download
            className="btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <IcDoc size={14} /> Exportar CSV
          </a>
          <Link href="/contacts" className="btn primary" style={{ display: 'inline-flex' }}>
            <IcPlus size={14} /> Nuevo registro
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card" style={{ padding: 56, textAlign: 'center' }}>
          <div style={{
            display: 'inline-grid', placeItems: 'center', width: 56, height: 56,
            borderRadius: 14, background: 'linear-gradient(135deg,rgba(0,212,170,.15),rgba(123,95,255,.15))',
            color: 'var(--teal)', marginBottom: 16,
          }}>
            <IcCalendar size={24} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Sin actividades aún</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6, maxWidth: 320, margin: '6px auto 0' }}>
            Registra llamadas, emails o reuniones desde el perfil de un contacto.
          </div>
          <Link href="/contacts" className="btn primary" style={{ marginTop: 22, display: 'inline-flex' }}>
            Ir a Contactos
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {Object.entries(groups).map(([day, items]) => (
            <div key={day}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--muted)',
                marginBottom: 10, paddingBottom: 8,
                borderBottom: '1px solid var(--border-soft)',
              }}>
                {day}
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                {items.map((a: any, idx: number) => {
                  const meta = KIND_META[a.kind] ?? KIND_META.note
                  return (
                    <div
                      key={a.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr auto',
                        gap: 14, alignItems: 'center',
                        padding: '14px 20px',
                        borderTop: idx === 0 ? 'none' : '1px solid var(--border-soft)',
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: `${meta.color}18`,
                        border: `1px solid ${meta.color}40`,
                        display: 'grid', placeItems: 'center',
                        color: meta.color,
                      }}>
                        {meta.icon}
                      </div>

                      {/* Content */}
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35 }}>
                          {a.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{
                            background: `${meta.color}18`, color: meta.color,
                            padding: '1px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                          }}>
                            {meta.label}
                          </span>
                          {a.contact && (
                            <>
                              <span>·</span>
                              <Link
                                href={`/contacts/${a.contact.id}`}
                                className="act-contact-link"
                              >
                                {a.contact.name}
                              </Link>
                            </>
                          )}
                          {a.body && (
                            <>
                              <span>·</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                                {a.body}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: 11.5, color: 'var(--muted-2)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(a.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
