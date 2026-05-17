'use client'

import { useState, useTransition } from 'react'
import { updateContact } from '@/lib/actions'
import { IcEdit } from '@/components/ui/Icons'
import type { Contact } from '@/lib/supabase/database.types'

const VERTICALS = ['healthcare', 'it', 'business'] as const
const STATUSES  = ['lead', 'prospect', 'customer'] as const

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 11px',
  fontSize: 13,
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function EditContactButton({ contact, avatarMode }: { contact: Contact; avatarMode?: boolean }) {
  const [open, setOpen] = useState(false)
  const [name,     setName]     = useState(contact.name ?? '')
  const [role,     setRole]     = useState(contact.role ?? '')
  const [email,    setEmail]    = useState(contact.email ?? '')
  const [phone,    setPhone]    = useState(contact.phone ?? '')
  const [city,     setCity]     = useState(contact.city ?? '')
  const [vertical, setVertical] = useState(contact.vertical)
  const [status,   setStatus]   = useState(contact.status)
  const [error,    setError]    = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setError(null)
    updateContact(contact.id, {
      name: name.trim(),
      role: role.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      vertical,
      status,
    }).then((res) => {
      if (res?.error) { setError(res.error); return }
      setOpen(false)
      // Server component will revalidate automatically
      window.location.reload()
    })
  }

  return (
    <>
      {avatarMode ? (
        <button
          onClick={() => setOpen(true)}
          title="Editar contacto"
          style={{
            position: 'absolute', bottom: 0, right: -4,
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--surface-2)', border: '2px solid var(--bg)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: 'var(--teal)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            transition: 'transform 120ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <IcEdit size={12} />
        </button>
      ) : (
        <button
          className="btn ghost"
          style={{ height: 32, padding: '0 12px', fontSize: 12, marginLeft: 'auto' }}
          onClick={() => setOpen(true)}
        >
          <IcEdit size={13} /> Editar
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px',
        }} onClick={() => setOpen(false)}>
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '24px 24px 20px', width: '100%', maxWidth: 480,
            maxHeight: '90vh', overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Editar contacto</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Nombre *</div>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Cargo</div>
                  <input style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} placeholder="CEO, CTO..." />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Ciudad</div>
                  <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Barcelona..." />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Email</div>
                  <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Teléfono</div>
                  <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34..." />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Vertical</div>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={vertical} onChange={(e) => setVertical(e.target.value as typeof vertical)}>
                    {VERTICALS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Estado</div>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--magenta)', marginTop: 12 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn primary" onClick={() => startTransition(handleSave)} disabled={pending}>
                {pending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
