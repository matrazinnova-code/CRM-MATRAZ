'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = 'loading' | 'idle' | 'enrolling' | 'verifying' | 'enrolled'

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

export default function MfaForm() {
  const [step, setStep] = useState<Step>('loading')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    async function checkEnrollment() {
      const supabase = createClient()
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = data?.totp?.find(f => f.status === 'verified')
      if (verified) {
        setEnrolledFactorId(verified.id)
        setStep('enrolled')
      } else {
        setStep('idle')
      }
    }
    checkEnrollment()
  }, [])

  const handleStartEnroll = async () => {
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    setPending(false)
    if (err) { setError(err.message); return }
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setPendingFactorId(data.id)
    setStep('verifying')
  }

  const handleVerify = async () => {
    if (!pendingFactorId || code.length !== 6) return
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId })
    if (challengeErr) { setError(challengeErr.message); setPending(false); return }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId,
      challengeId: challenge.id,
      code,
    })
    setPending(false)
    if (verifyErr) { setError('Código incorrecto. Inténtalo de nuevo.'); setCode(''); return }
    setEnrolledFactorId(pendingFactorId)
    setStep('enrolled')
    setCode('')
    setQrCode(null)
    setSecret(null)
  }

  const handleUnenroll = async () => {
    if (!enrolledFactorId) return
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId })
    setPending(false)
    if (err) { setError(err.message); return }
    setEnrolledFactorId(null)
    setStep('idle')
  }

  const handleCancel = async () => {
    if (pendingFactorId) {
      const supabase = createClient()
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId })
    }
    setStep('idle')
    setQrCode(null)
    setSecret(null)
    setPendingFactorId(null)
    setCode('')
    setError(null)
  }

  if (step === 'loading') {
    return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando…</div>
  }

  if (step === 'enrolled') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--teal)', flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 500 }}>
            2FA activo — tu cuenta está protegida con autenticación de dos factores
          </span>
        </div>
        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,64,160,0.08)', border: '1px solid rgba(224,64,160,0.25)', borderRadius: 8, color: 'var(--magenta)', fontSize: 13 }}>
            {error}
          </div>
        )}
        <button
          className="btn"
          onClick={handleUnenroll}
          disabled={pending}
          style={{ fontSize: 13, color: 'var(--magenta)', borderColor: 'rgba(224,64,160,0.3)' }}
        >
          {pending ? 'Desactivando…' : 'Desactivar 2FA'}
        </button>
      </div>
    )
  }

  if (step === 'verifying') {
    return (
      <div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
          Escanea el código QR con Google Authenticator, Authy u otra app TOTP y luego introduce el código de 6 dígitos para confirmar.
        </p>

        {qrCode && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
            <div
              style={{ background: '#fff', padding: 12, borderRadius: 10, flexShrink: 0 }}
              dangerouslySetInnerHTML={{ __html: qrCode }}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                ¿No puedes escanear? Introduce este código manualmente:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '6px 10px',
                  borderRadius: 6,
                  letterSpacing: '0.1em',
                  wordBreak: 'break-all',
                  flex: 1,
                  filter: showSecret ? 'none' : 'blur(5px)',
                  userSelect: showSecret ? 'text' : 'none',
                  transition: 'filter 0.2s',
                }}>
                  {secret}
                </code>
                <button
                  onClick={() => setShowSecret(s => !s)}
                  style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                >
                  {showSecret ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>
            Código de verificación
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            placeholder="000000"
            style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 18, textAlign: 'center', width: 180 }}
            autoFocus
          />
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,64,160,0.08)', border: '1px solid rgba(224,64,160,0.25)', borderRadius: 8, color: 'var(--magenta)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn primary"
            onClick={handleVerify}
            disabled={pending || code.length !== 6}
          >
            {pending ? 'Verificando…' : 'Activar 2FA'}
          </button>
          <button className="btn" onClick={handleCancel} disabled={pending}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // step === 'idle'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--muted)', flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          2FA desactivado — tu cuenta solo usa contraseña
        </span>
      </div>
      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,64,160,0.08)', border: '1px solid rgba(224,64,160,0.25)', borderRadius: 8, color: 'var(--magenta)', fontSize: 13 }}>
          {error}
        </div>
      )}
      <button className="btn primary" onClick={handleStartEnroll} disabled={pending}>
        {pending ? 'Iniciando…' : 'Activar autenticación en dos pasos'}
      </button>
    </div>
  )
}
