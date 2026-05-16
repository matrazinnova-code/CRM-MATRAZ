'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  IcPhone, IcMail, IcVideo, IcDoc, IcCheck, IcSparkle, IcMessage,
  IcPlus, IcX, IcTrash,
} from '@/components/ui/Icons'
import { createActivity, deleteActivity } from '@/lib/actions'
import type { Activity, ActivityKind } from '@/lib/supabase/database.types'

const KIND_ICONS: Record<ActivityKind, React.ReactNode> = {
  call:    <IcPhone size={16} />,
  email:   <IcMail size={16} />,
  meeting: <IcVideo size={16} />,
  note:    <IcDoc size={16} />,
  task:    <IcCheck size={16} />,
  doc:     <IcDoc size={16} />,
  star:    <IcSparkle size={16} />,
}

const KINDS: { key: ActivityKind; label: string }[] = [
  { key: 'call',    label: 'Llamada' },
  { key: 'email',   label: 'Email' },
  { key: 'meeting', label: 'Reunión' },
  { key: 'note',    label: 'Nota' },
  { key: 'task',    label: 'Tarea' },
  { key: 'doc',     label: 'Documento' },
]

interface Props {
  activities: Activity[]
  contactId: string
}

export default function Timeline({ activities, contactId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [kind, setKind] = useState<ActivityKind>('note')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    if (!title.trim()) return
    setError(null)
    createActivity({ kind, title: title.trim(), body: body.trim() || undefined, contact_id: contactId })
      .then((res) => {
        if (res.error) { setError(res.error); return }
        setTitle(''); setBody(''); setShowForm(false)
        router.refresh()
      })
  }

  const handleDelete = (id: string) => {
    deleteActivity(id, contactId).then(() => router.refresh())
  }

  return (
    <div>
      {/* Add activity */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className="btn teal" style={{ height: 34, padding: '0 14px', fontSize: 12.5 }} onClick={() => setShowForm(!showForm)}>
          <IcPlus size={13} /> Añadir actividad
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => setKind(k.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 7,
                  fontSize: 12, fontWeight: 600,
                  border: '1px solid',
                  borderColor: kind === k.key ? 'rgba(0,212,170,0.4)' : 'var(--border)',
                  background: kind === k.key ? 'rgba(0,212,170,0.10)' : 'transparent',
                  color: kind === k.key ? 'var(--teal)' : 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                {KIND_ICONS[k.key]} {k.label}
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ marginBottom: 10 }}
            placeholder="Título de la actividad…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="textarea-input"
            style={{ minHeight: 80, marginBottom: 12 }}
            placeholder="Descripción o notas adicionales…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {error && <div style={{ color: 'var(--magenta)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn ghost" style={{ height: 32, padding: '0 12px', fontSize: 12 }} onClick={() => setShowForm(false)}>
              <IcX size={13} /> Cancelar
            </button>
            <button className="btn primary" style={{ height: 32, padding: '0 12px', fontSize: 12 }} disabled={pending || !title.trim()} onClick={handleAdd}>
              {pending ? 'Guardando…' : 'Añadir'}
            </button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No hay actividades registradas. Añade la primera.
        </div>
      ) : (
        <div className="timeline">
          {activities.map((a) => (
            <div key={a.id} className="tl-item">
              <div className="tl-ico">{KIND_ICONS[a.kind]}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</div>
                {a.body && <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>{a.body}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ color: 'var(--muted-2)', fontSize: 11.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {new Date(a.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                <button
                  className="icon-btn"
                  style={{ width: 24, height: 24, borderColor: 'transparent', background: 'transparent', color: 'var(--muted-2)' }}
                  onClick={() => handleDelete(a.id)}
                  title="Eliminar"
                >
                  <IcTrash size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
