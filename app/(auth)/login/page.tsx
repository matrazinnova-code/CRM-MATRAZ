'use client'

import { useEffect, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { login } from '@/lib/actions'

export default function LoginPage() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, action] = useFormState(login, null)

  useEffect(() => {
    if (state?.success) router.replace('/')
  }, [state, router])

  return (
    <div className="card" style={{ padding: '40px' }}>
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <Image
          src="/assets/matraz-innova-logo.png"
          alt="Matraz Innova"
          width={180}
          height={50}
          style={{ objectFit: 'contain', width: 180, height: 'auto' }}
        />
        <div style={{ fontSize: 11, letterSpacing: '0.32em', color: 'var(--muted)', fontWeight: 500 }}>
          CRM · v2.0
        </div>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>
        Bienvenido de nuevo
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
        Accede a tu cuenta de Matraz Innova CRM
      </p>

      <form action={(fd) => startTransition(() => action(fd))} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="field-label">Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@empresa.com"
            className="input"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="field-label">Contraseña</label>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="input"
          />
        </div>

        {state?.error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(224,64,160,0.08)',
            border: '1px solid rgba(224,64,160,0.25)',
            borderRadius: 8,
            color: 'var(--magenta)',
            fontSize: 13,
          }}>
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn primary"
          style={{ height: 44, marginTop: 4, justifyContent: 'center', width: '100%' }}
        >
          {pending ? 'Accediendo…' : 'Acceder'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted)' }}>
        ¿No tienes cuenta?{' '}
        <Link href="/register" style={{ color: 'var(--teal)', fontWeight: 600 }}>
          Registrarse
        </Link>
      </div>
    </div>
  )
}
