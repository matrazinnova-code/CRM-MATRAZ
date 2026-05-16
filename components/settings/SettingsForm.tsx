'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from '@/lib/actions'
import type { Profile } from '@/lib/supabase/database.types'

interface SettingsFormProps {
  profile: Profile | null
  email: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'center', marginBottom: 20 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{label}</label>
      <div>{children}</div>
    </div>
  )
}

export default function SettingsForm({ profile, email }: SettingsFormProps) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [role, setRole] = useState(profile?.role ?? '')
  const [initials, setInitials] = useState(profile?.avatar_initials ?? '')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    setSuccess(false)
    setError(null)

    const derivedInitials = initials.trim() ||
      fullName.trim().split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

    updateProfile({
      full_name: fullName.trim() || undefined,
      role: role.trim() || undefined,
      avatar_initials: derivedInitials || undefined,
    }).then((res) => {
      if (res.error) { setError(res.error); return }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    })
  }

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

  return (
    <div>
      {/* Avatar preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--gradient)',
          display: 'grid', placeItems: 'center',
          color: '#0a0a0b', fontWeight: 700, fontSize: 18,
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}>
          {(initials || fullName.trim().split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')) || '?'}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{fullName || 'Tu nombre'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{email}</div>
        </div>
      </div>

      <Field label="Nombre completo">
        <input
          style={inputStyle}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Fran García"
        />
      </Field>

      <Field label="Rol / Cargo">
        <input
          style={inputStyle}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Partner, Consultor..."
        />
      </Field>

      <Field label="Iniciales (avatar)">
        <input
          style={{ ...inputStyle, width: 80 }}
          value={initials}
          onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 2))}
          placeholder="FG"
          maxLength={2}
        />
      </Field>

      <Field label="Email">
        <input style={{ ...inputStyle, opacity: 0.5 }} value={email} disabled />
      </Field>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          className="btn primary"
          onClick={() => startTransition(handleSave)}
          disabled={pending}
          style={{ minWidth: 120 }}
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {success && (
          <span style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 500 }}>¡Guardado correctamente!</span>
        )}
        {error && (
          <span style={{ fontSize: 13, color: 'var(--magenta)', fontWeight: 500 }}>{error}</span>
        )}
      </div>
    </div>
  )
}
