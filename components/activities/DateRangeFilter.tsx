'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { IcDoc } from '@/components/ui/Icons'

const PRESETS = [
  { label: '7 días',   days: 7 },
  { label: '30 días',  days: 30 },
  { label: '90 días',  days: 90 },
  { label: 'Este año', days: 365 },
]

function toISO(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function DateRangeFilter() {
  const router = useRouter()
  const params = useSearchParams()

  const defaultFrom = params.get('from') ?? ''
  const defaultTo   = params.get('to')   ?? ''

  const [from, setFrom] = useState(defaultFrom)
  const [to,   setTo]   = useState(defaultTo)

  const apply = (f: string, t: string) => {
    const q = new URLSearchParams()
    if (f) q.set('from', f)
    if (t) q.set('to', t)
    router.push(`/activities?${q.toString()}`)
  }

  const applyPreset = (days: number) => {
    const f = toISO(new Date(Date.now() - days * 86_400_000))
    const t = toISO(new Date())
    setFrom(f); setTo(t)
    apply(f, t)
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    color: '#fff',
    outline: 'none',
    colorScheme: 'dark',
  }

  const reportHref = `/actividades/informe${from || to ? `?from=${from}&to=${to}` : ''}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {/* Presets */}
      <div style={{ display: 'flex', gap: 6 }}>
        {PRESETS.map(p => (
          <button
            key={p.days}
            className="chip"
            onClick={() => applyPreset(p.days)}
            style={{ height: 34 }}
          >
            {p.label}
          </button>
        ))}
        {(from || to) && (
          <button
            className="chip"
            onClick={() => { setFrom(''); setTo(''); router.push('/activities') }}
            style={{ height: 34, color: 'var(--magenta)', borderColor: 'rgba(224,64,160,0.3)' }}
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* Date inputs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Desde</span>
        <input
          type="date"
          style={inputStyle}
          value={from}
          onChange={e => setFrom(e.target.value)}
          onBlur={() => apply(from, to)}
        />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Hasta</span>
        <input
          type="date"
          style={inputStyle}
          value={to}
          onChange={e => setTo(e.target.value)}
          onBlur={() => apply(from, to)}
        />
        <button
          className="btn"
          style={{ height: 34, padding: '0 14px', fontSize: 12 }}
          onClick={() => apply(from, to)}
        >
          Aplicar
        </button>
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* Report link — carries the current date range */}
      <a
        href={reportHref}
        className="btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', fontSize: 12 }}
      >
        <IcDoc size={13} /> Ver informe
      </a>
    </div>
  )
}
