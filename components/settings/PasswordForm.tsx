'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'center', marginBottom: 20 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{label}</label>
      <div>{children}</div>
    </div>
  )
}

export default function PasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    setSuccess(false)

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (newPassword !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setPending(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    setPending(false)

    if (err) {
      setError(err.message)
      return
    }

    // Invalidate all other active sessions after password change
    await supabase.auth.signOut({ scope: 'others' })

    setSuccess(true)
    setNewPassword('')
    setConfirm('')
    setTimeout(() => setSuccess(false), 4000)
  }

  return (
    <div>
      <Field label="Nueva contraseña">
        <input
          style={inputStyle}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
        />
      </Field>

      <Field label="Confirmar contraseña">
        <input
          style={inputStyle}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repite la contraseña"
          autoComplete="new-password"
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
      </Field>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          className="btn primary"
          onClick={handleSave}
          disabled={pending || !newPassword || !confirm}
          style={{ minWidth: 160 }}
        >
          {pending ? 'Actualizando…' : 'Cambiar contraseña'}
        </button>
        {success && (
          <span style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 500 }}>
            ✓ Contraseña actualizada correctamente
          </span>
        )}
        {error && (
          <span style={{ fontSize: 13, color: 'var(--magenta)', fontWeight: 500 }}>{error}</span>
        )}
      </div>
    </div>
  )
}
