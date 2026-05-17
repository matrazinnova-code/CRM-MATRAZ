'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDirectConversation, createGroupConversation } from '@/lib/actions/chat'
import { IcPlus, IcX } from '@/components/ui/Icons'

interface Profile { id: string; full_name: string | null; avatar_initials: string | null; role: string | null }

export default function NewConversationModal({
  users,
  currentUserId,
}: {
  users: Profile[]
  currentUserId: string
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'direct' | 'group'>('direct')
  const [selected, setSelected] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function toggle(id: string) {
    setSelected(prev =>
      mode === 'direct' ? [id] : prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function close() {
    setOpen(false)
    setSelected([])
    setGroupName('')
    setMode('direct')
  }

  function handleCreate() {
    if (selected.length === 0) return
    startTransition(async () => {
      let id: string | null = null
      if (mode === 'direct') {
        id = await createDirectConversation(selected[0])
      } else {
        if (!groupName.trim()) return
        id = await createGroupConversation(groupName.trim(), selected)
      }
      if (id) {
        close()
        router.push(`/chat/${id}`)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn primary"
        style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
      >
        <IcPlus size={14} /> Nueva conversación
      </button>

      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, width: 440, maxHeight: '80vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Nueva conversación</div>
              <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
                <IcX size={18} />
              </button>
            </div>

            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0' }}>
              {(['direct', 'group'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setSelected([]) }}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    background: mode === m ? 'var(--teal)' : 'rgba(255,255,255,0.06)',
                    color: mode === m ? '#0a0a0b' : 'var(--muted)',
                    transition: 'all 150ms',
                  }}
                >
                  {m === 'direct' ? '1 a 1' : 'Grupo'}
                </button>
              ))}
            </div>

            {/* Group name input */}
            {mode === 'group' && (
              <div style={{ padding: '14px 20px 0' }}>
                <input
                  placeholder="Nombre del grupo"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)',
                    color: 'var(--fg)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* User list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                {mode === 'direct' ? 'Selecciona un usuario' : `Selecciona miembros (${selected.length} seleccionados)`}
              </div>

              {users.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
                  No hay otros usuarios en la plataforma aún.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {users.map(u => {
                  const isSelected = selected.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggle(u.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: isSelected ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.03)',
                        outline: isSelected ? '1px solid var(--teal)' : '1px solid transparent',
                        transition: 'all 120ms', textAlign: 'left', width: '100%',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient)',
                        display: 'grid', placeItems: 'center',
                        color: '#0a0a0b', fontWeight: 700, fontSize: 12, flexShrink: 0,
                      }}>
                        {u.avatar_initials ?? '?'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>{u.full_name ?? '—'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{u.role ?? ''}</div>
                      </div>
                      {isSelected && (
                        <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: 'var(--teal)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0a0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={close} className="btn" style={{ fontSize: 13 }}>Cancelar</button>
              <button
                onClick={handleCreate}
                disabled={selected.length === 0 || pending || (mode === 'group' && !groupName.trim())}
                className="btn primary"
                style={{ fontSize: 13, opacity: (selected.length === 0 || (mode === 'group' && !groupName.trim())) ? 0.4 : 1 }}
              >
                {pending ? 'Creando...' : mode === 'direct' ? 'Iniciar chat' : 'Crear grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
