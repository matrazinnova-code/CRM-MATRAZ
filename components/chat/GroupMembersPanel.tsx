'use client'

import { useState, useTransition } from 'react'
import { addGroupMember, removeGroupMember } from '@/lib/actions/chat'
import { IcX, IcPlus } from '@/components/ui/Icons'
import { useRouter } from 'next/navigation'

interface Profile { id: string; full_name: string | null; avatar_initials: string | null; role: string | null }

interface Props {
  conversationId: string
  currentUserId: string
  isCreator: boolean
  members: Profile[]
  allUsers: Profile[]
  onClose: () => void
}

export default function GroupMembersPanel({
  conversationId, currentUserId, isCreator, members, allUsers, onClose,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [localMembers, setLocalMembers] = useState<Profile[]>(members)
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const nonMembers = allUsers.filter(u => !localMembers.some(m => m.id === u.id))

  function handleAdd(user: Profile) {
    startTransition(async () => {
      const { error: err } = await addGroupMember(conversationId, user.id)
      if (err) { setError(err); return }
      setLocalMembers(prev => [...prev, user])
      setAddOpen(false)
      router.refresh()
    })
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      const { error: err } = await removeGroupMember(conversationId, userId)
      if (err) { setError(err); return }
      setLocalMembers(prev => prev.filter(m => m.id !== userId))
      if (userId === currentUserId) {
        router.push('/chat')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div style={{
      width: 280, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      height: '100%', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Miembros del grupo</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
          <IcX size={16} />
        </button>
      </div>

      {/* Members list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
          {localMembers.length} miembro{localMembers.length !== 1 ? 's' : ''}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {localMembers.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 9,
              background: 'rgba(255,255,255,0.03)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient)',
                display: 'grid', placeItems: 'center',
                color: '#0a0a0b', fontWeight: 700, fontSize: 11, flexShrink: 0,
              }}>
                {m.avatar_initials ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.full_name ?? '—'}
                  {m.id === currentUserId && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>Tú</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.role ?? ''}</div>
              </div>
              {(isCreator || m.id === currentUserId) && (
                <button
                  onClick={() => handleRemove(m.id)}
                  disabled={pending}
                  title={m.id === currentUserId ? 'Salir del grupo' : 'Eliminar'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 6,
                    opacity: pending ? 0.4 : 1,
                  }}
                >
                  <IcX size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add member */}
        {isCreator && nonMembers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {!addOpen ? (
              <button
                onClick={() => setAddOpen(true)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 9,
                  border: '1px dashed var(--border)', background: 'transparent',
                  color: 'var(--muted)', cursor: 'pointer', fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <IcPlus size={13} /> Añadir miembro
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Añadir miembro
                </div>
                {nonMembers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleAdd(u)}
                    disabled={pending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 9, border: 'none',
                      background: 'rgba(0,212,170,0.06)', cursor: 'pointer',
                      opacity: pending ? 0.4 : 1, textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: 'var(--gradient)',
                      display: 'grid', placeItems: 'center',
                      color: '#0a0a0b', fontWeight: 700, fontSize: 10, flexShrink: 0,
                    }}>
                      {u.avatar_initials ?? '?'}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg)' }}>{u.full_name ?? '—'}</div>
                  </button>
                ))}
                <button
                  onClick={() => setAddOpen(false)}
                  style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#E040A0', marginTop: 10, padding: '8px 10px', background: 'rgba(224,64,160,0.1)', borderRadius: 8 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
