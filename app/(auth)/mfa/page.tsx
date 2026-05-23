'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function MfaPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)

  useEffect(() => {
    async function loadFactor() {
      const supabase = createClient()
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = data?.totp?.find(f => f.status === 'verified')
      if (verified) setFactorId(verified.id)
    }
    loadFactor()
  }, [])

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return
    setError(null)
    setPending(true)

    const supabase = createClient()
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr) {
      setError(challengeErr.message)
      setPending(false)
      return
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    setPending(false)
    if (verifyErr) {
      setError('Código incorrecto. Inténtalo de nuevo.')
      setCode('')
      return
    }

    router.replace('/')
  }

  return (
    <div className="card" style={{ padding: '40px' }}>
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
        Verificación en dos pasos
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
        Introduce el código de 6 dígitos de tu app autenticadora
      </p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="field-label">Código de verificación</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            placeholder="000000"
            className="input"
            style={{ letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }}
            autoFocus
          />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(224,64,160,0.08)',
            border: '1px solid rgba(224,64,160,0.25)',
            borderRadius: 8,
            color: 'var(--magenta)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={pending || code.length !== 6}
          className="btn primary"
          style={{ height: 44, marginTop: 4, justifyContent: 'center', width: '100%' }}
        >
          {pending ? 'Verificando…' : 'Verificar'}
        </button>
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--muted)' }}>
        Abre Google Authenticator, Authy o cualquier app TOTP para obtener el código
      </p>
    </div>
  )
}
