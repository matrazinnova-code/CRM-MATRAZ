'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string; email: string; full_name: string; role: string
  avatar_initials: string; is_admin: boolean; created_at: string
  last_sign_in: string | null; last_activity: string | null
  contacts: number; deals: number; activities: number; confirmed: boolean
}

const ROLES = ['Partner', 'Manager', 'Director', 'Admin', 'Comercial', 'Consultor']

function ago(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Ayer'
  if (d < 30) return `Hace ${d}d`
  const m = Math.floor(d / 30)
  if (m < 12) return `Hace ${m}m`
  return `Hace ${Math.floor(m / 12)}a`
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function UserTable({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: string }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al eliminar')
        return
      }
      setUsers(prev => prev.filter(u => u.id !== id))
      setConfirmDelete(null)
    })
  }

  async function handleRoleChange(id: string, role: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) { setError('Error al cambiar rol'); return }
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
      setEditRole(null)
    })
  }

  async function handleToggleAdmin(id: string, current: boolean) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: !current }),
      })
      if (!res.ok) { setError('Error al cambiar permisos'); return }
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_admin: !current } : u))
    })
  }

  return (
    <div>
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(224,64,160,0.12)', border: '1px solid rgba(224,64,160,0.3)', borderRadius: 8, color: '#E040A0', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#E040A0', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Usuario', 'Email', 'Rol', 'Alta', 'Último acceso', 'Datos', 'Admin', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)', background: u.id === currentUserId ? 'rgba(0,212,170,0.03)' : 'transparent' }}>

                {/* Usuario */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', background: 'var(--gradient)',
                      display: 'grid', placeItems: 'center', color: '#0a0a0b', fontWeight: 700, fontSize: 11, flexShrink: 0,
                    }}>
                      {u.avatar_initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {u.full_name}
                        {u.id === currentUserId && <span style={{ fontSize: 10, color: 'var(--teal)', marginLeft: 6, fontWeight: 600 }}>Tú</span>}
                      </div>
                      {!u.confirmed && <div style={{ fontSize: 10, color: '#E040A0', marginTop: 1 }}>Sin confirmar</div>}
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12.5 }}>{u.email}</td>

                {/* Rol */}
                <td style={{ padding: '12px 16px' }}>
                  {editRole === u.id ? (
                    <select
                      defaultValue={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      onBlur={() => setEditRole(null)}
                      autoFocus
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditRole(u.id)}
                      style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, fontWeight: 600, background: 'rgba(0,212,170,0.1)', color: 'var(--teal)', border: 'none', cursor: 'pointer' }}
                    >
                      {u.role}
                    </button>
                  )}
                </td>

                {/* Alta */}
                <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(u.created_at)}</td>

                {/* Último acceso */}
                <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <div>{ago(u.last_sign_in)}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 1 }}>Act. {ago(u.last_activity)}</div>
                </td>

                {/* Datos */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                    <span title="Contactos" style={{ color: 'var(--teal)' }}>👤 {u.contacts}</span>
                    <span title="Deals" style={{ color: '#7B5FFF' }}>💼 {u.deals}</span>
                    <span title="Actividades" style={{ color: '#00B4D8' }}>📋 {u.activities}</span>
                  </div>
                </td>

                {/* Admin toggle */}
                <td style={{ padding: '12px 16px' }}>
                  {u.id !== currentUserId ? (
                    <button
                      onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                      disabled={pending}
                      style={{
                        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                        background: u.is_admin ? 'var(--teal)' : 'rgba(255,255,255,0.1)',
                        transition: 'background 200ms', position: 'relative',
                      }}
                      title={u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                    >
                      <span style={{
                        position: 'absolute', top: 3, left: u.is_admin ? 21 : 3,
                        width: 16, height: 16, borderRadius: '50%',
                        background: u.is_admin ? '#0a0a0b' : 'rgba(255,255,255,0.4)',
                        transition: 'left 200ms',
                      }} />
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>Super</span>
                  )}
                </td>

                {/* Acciones */}
                <td style={{ padding: '12px 16px' }}>
                  {u.id !== currentUserId ? (
                    confirmDelete === u.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>¿Seguro?</span>
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={pending}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none', background: '#E040A0', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Sí, eliminar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', cursor: 'pointer' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(u.id)}
                        style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(224,64,160,0.3)', background: 'rgba(224,64,160,0.08)', color: '#E040A0', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Eliminar
                      </button>
                    )
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
