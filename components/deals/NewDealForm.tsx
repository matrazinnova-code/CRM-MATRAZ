'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IcChevRight, IcCheck, IcX, IcPlus, IcUsers, IcBrief, IcWallet, IcCalendar, IcTarget } from '@/components/ui/Icons'
import { createDeal } from '@/lib/actions'
import type { Vertical, DealStage, Contact, Company } from '@/lib/supabase/database.types'

interface Props {
  contacts: Pick<Contact, 'id' | 'name' | 'vertical'>[]
  companies: Pick<Company, 'id' | 'name'>[]
}

const VERTICALS: { key: Vertical; label: string }[] = [
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'it',         label: 'IT' },
  { key: 'business',   label: 'Business' },
]

const STAGES: { id: DealStage; title: string }[] = [
  { id: 'lead',        title: 'Lead' },
  { id: 'qualified',   title: 'Qualified' },
  { id: 'proposal',    title: 'Proposal' },
  { id: 'negotiation', title: 'Negotiation' },
  { id: 'closing',     title: 'Closing' },
  { id: 'won',         title: 'Won' },
]

const INFLUENCE = ['Decisor', 'Influencer', 'Champion', 'Bloqueador', 'Usuario final']

interface Stakeholder { name: string; role: string; influence: string }

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: '#fff',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

export default function NewDealForm({ contacts, companies }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)

  // Step 1 — Detalles
  const [title,       setTitle]       = useState('')
  const [vertical,    setVertical]    = useState<Vertical>('healthcare')
  const [company,     setCompany]     = useState('')
  const [contactId,   setContactId]   = useState('')
  const [value,       setValue]       = useState(180000)
  const [probability, setProbability] = useState(65)
  const [stage,       setStage]       = useState<DealStage>('qualified')
  const [closeDate,   setCloseDate]   = useState('')
  const [tags,        setTags]        = useState<string[]>(['EMEA', 'Regulatory'])
  const [tagInput,    setTagInput]    = useState('')
  const [description, setDescription] = useState('')

  // Step 2 — Stakeholders
  const [ownerName,     setOwnerName]     = useState('')
  const [stakeholders,  setStakeholders]  = useState<Stakeholder[]>([])
  const [shName,        setShName]        = useState('')
  const [shRole,        setShRole]        = useState('')
  const [shInfluence,   setShInfluence]   = useState(INFLUENCE[0])

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))
  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const addStakeholder = () => {
    if (!shName.trim()) return
    setStakeholders([...stakeholders, { name: shName.trim(), role: shRole.trim(), influence: shInfluence }])
    setShName(''); setShRole(''); setShInfluence(INFLUENCE[0])
  }

  const removeStakeholder = (i: number) => setStakeholders(stakeholders.filter((_, idx) => idx !== i))

  const handleSubmit = () => {
    if (!title.trim()) return
    const selectedCompany = companies.find((c) => c.name === company)
    startTransition(async () => {
      setError(null)
      const res = await createDeal({
        title: title.trim(),
        value,
        vertical,
        stage,
        probability,
        close_date: closeDate || undefined,
        description: description.trim() || undefined,
        tags,
        owner_name: ownerName.trim() || 'IM',
        contact_id: contactId || undefined,
        company_id: selectedCompany?.id,
      })
      if (res.error) { setError(res.error); return }
      router.push('/pipeline')
    })
  }

  const weighted = Math.round(value * probability / 100)
  const fmt = (v: number) => v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(2)}M` : `€${(v / 1000).toFixed(0)}K`
  const contactName = contacts.find((c) => c.id === contactId)?.name ?? '—'
  const stageName = STAGES.find((s) => s.id === stage)?.title ?? '—'
  const verticalName = VERTICALS.find((v) => v.key === vertical)?.label ?? '—'

  const step1Valid = title.trim().length > 0
  const STEPS = ['Detalles', 'Stakeholders', 'Resumen']

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26, gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
            <Link href="/pipeline" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Pipeline</Link>
            <IcChevRight size={12} />
            <span style={{ color: '#fff', fontWeight: 600 }}>Nuevo deal</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Nuevo deal</div>
          <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6 }}>Captura una oportunidad y asígnala a una etapa del pipeline.</div>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {STEPS.map((label, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {i > 0 && <div style={{ width: 18, height: 1, background: done ? 'var(--teal)' : 'var(--border)' }} />}
                <button
                  type="button"
                  onClick={() => { if (done || (n === 2 && step1Valid)) setStep(n) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, fontWeight: 500, background: 'none', border: 'none',
                    cursor: done || (n === 2 && step1Valid) ? 'pointer' : 'default',
                    color: active ? '#fff' : done ? 'var(--teal)' : 'var(--muted)', padding: 0,
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: active ? 'var(--gradient)' : done ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? 'transparent' : done ? 'var(--teal)' : 'var(--border)'}`,
                    color: active ? '#0A0A0B' : done ? 'var(--teal)' : 'inherit',
                  }}>
                    {done ? <IcCheck size={11} /> : n}
                  </span>
                  {label}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── STEP 1: Detalles ── */}
        {step === 1 && (
          <div className="card">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>
              Información del deal
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginTop: 3 }}>
                Los campos con <span style={{ color: 'var(--teal)' }}>•</span> son obligatorios.
              </div>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 20px' }}>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Nombre del deal <span style={{ color: 'var(--teal)' }}>•</span>
                </label>
                <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Plataforma de farmacovigilancia — Fase I" />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Vertical <span style={{ color: 'var(--teal)' }}>•</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {VERTICALS.map((v) => (
                    <button key={v.key} type="button" onClick={() => setVertical(v.key)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${vertical === v.key ? 'var(--teal)' : 'var(--border)'}`,
                      background: vertical === v.key ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.03)',
                      color: vertical === v.key ? 'var(--teal)' : 'var(--muted)',
                      transition: 'all 120ms',
                    }}>{v.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Empresa</label>
                <input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} list="companies-list" placeholder="Atlas Biopharma" />
                <datalist id="companies-list">{companies.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Contacto principal</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Valor (€) <span style={{ color: 'var(--teal)' }}>•</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600 }}>€</span>
                  <input style={{ ...inputStyle, paddingLeft: 28 }} type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Probabilidad (%)</label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inputStyle, paddingRight: 32 }} type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(Number(e.target.value))} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>%</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Etapa inicial</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Fecha estimada cierre</label>
                <input style={inputStyle} type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, minHeight: 42 }}>
                  {tags.map((t) => (
                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 6, padding: '2px 8px', fontSize: 12, color: 'var(--teal)' }}>
                      {t}
                      <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeTag(t)}><IcX size={10} /></span>
                    </span>
                  ))}
                  <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={addTag}
                    placeholder="Añadir y pulsar Enter…"
                    style={{ background: 'transparent', border: 'none', color: '#fff', flex: 1, minWidth: 100, outline: 'none', font: 'inherit', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Descripción</label>
                <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe el alcance del proyecto, objetivos y contexto relevante…" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.12)', borderRadius: '0 0 12px 12px' }}>
              <Link href="/pipeline" className="btn ghost">Cancelar</Link>
              <button type="button" className="btn primary" disabled={!step1Valid} onClick={() => setStep(2)}>
                Siguiente: Stakeholders →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Stakeholders ── */}
        {step === 2 && (
          <div className="card">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IcUsers size={16} /> Stakeholders
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Personas clave involucradas en este deal.</div>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Owner */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Responsable (owner)</label>
                <input style={inputStyle} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Tu nombre o iniciales (ej. FG)" />
              </div>

              {/* Existing stakeholders */}
              {stakeholders.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stakeholders.map((sh, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 9 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(123,95,255,0.15)', display: 'grid', placeItems: 'center', color: '#7B5FFF', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                        {sh.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{sh.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sh.role} · <span style={{ color: 'var(--teal)' }}>{sh.influence}</span></div>
                      </div>
                      <button type="button" onClick={() => removeStakeholder(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                        <IcX size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add stakeholder form */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>+ Añadir stakeholder</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input style={inputStyle} value={shName} onChange={(e) => setShName(e.target.value)} placeholder="Nombre completo" />
                  <input style={inputStyle} value={shRole} onChange={(e) => setShRole(e.target.value)} placeholder="Cargo (ej. CFO)" />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select style={{ ...inputStyle, flex: 1, cursor: 'pointer' }} value={shInfluence} onChange={(e) => setShInfluence(e.target.value)}>
                    {INFLUENCE.map((inf) => <option key={inf} value={inf}>{inf}</option>)}
                  </select>
                  <button type="button" onClick={addStakeholder} className="btn primary" style={{ height: 38, padding: '0 16px', flexShrink: 0 }}>
                    <IcPlus size={14} /> Añadir
                  </button>
                </div>
              </div>

              {/* Contact principal */}
              {contactId && (
                <div style={{ padding: '10px 14px', background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 9, fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contacto principal · </span>
                  <span style={{ fontWeight: 600, color: 'var(--teal)' }}>{contactName}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.12)', borderRadius: '0 0 12px 12px' }}>
              <button type="button" className="btn ghost" onClick={() => setStep(1)}>← Atrás</button>
              <button type="button" className="btn primary" onClick={() => setStep(3)}>
                Siguiente: Resumen →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Resumen ── */}
        {step === 3 && (
          <div className="card">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IcBrief size={16} /> Resumen del deal
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Revisa los datos antes de crear el deal.</div>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Title block */}
              <div style={{ padding: '16px 20px', background: 'var(--gradient)', borderRadius: 10, color: '#0A0A0B' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.6, marginBottom: 4 }}>Deal</div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.2 }}>{title}</div>
                <div style={{ fontSize: 13, marginTop: 6, opacity: 0.7 }}>{verticalName} · {stageName}</div>
              </div>

              {/* Key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { icon: <IcWallet size={14} />, label: 'Valor total', val: fmt(value) },
                  { icon: <IcTarget size={14} />, label: 'Ponderado',   val: fmt(weighted) },
                  { icon: <IcCalendar size={14} />, label: 'Cierre est.',val: closeDate || '—' },
                ].map((m) => (
                  <div key={m.label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 9, textAlign: 'center' }}>
                    <div style={{ color: 'var(--teal)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m.val}</div>
                  </div>
                ))}
              </div>

              {/* Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {[
                  { label: 'Empresa',    val: company || '—' },
                  { label: 'Contacto',   val: contactName },
                  { label: 'Responsable',val: ownerName || 'IM' },
                  { label: 'Probabilidad', val: `${probability}%` },
                ].map((r, i) => (
                  <div key={r.label} style={{ display: 'flex', padding: '11px 16px', borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)', flex: 1, fontWeight: 500 }}>{r.label}</span>
                    <span style={{ fontWeight: 600 }}>{r.val}</span>
                  </div>
                ))}
              </div>

              {/* Stakeholders */}
              {stakeholders.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Stakeholders</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {stakeholders.map((sh, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                        <span style={{ fontWeight: 600, flex: 1 }}>{sh.name}</span>
                        <span style={{ color: 'var(--muted)' }}>{sh.role}</span>
                        <span style={{ color: 'var(--teal)', fontSize: 11, fontWeight: 600 }}>{sh.influence}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {tags.map((t) => (
                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: 'var(--teal)' }}>{t}</span>
                  ))}
                </div>
              )}

              {/* Description */}
              {description && (
                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {description}
                </div>
              )}

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(224,64,160,0.08)', border: '1px solid rgba(224,64,160,0.25)', borderRadius: 8, color: 'var(--magenta)', fontSize: 13 }}>
                  {error}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.12)', borderRadius: '0 0 12px 12px' }}>
              <button type="button" className="btn ghost" onClick={() => setStep(2)}>← Atrás</button>
              <button type="button" className="btn primary" disabled={pending} onClick={() => startTransition(handleSubmit)}>
                <IcCheck size={15} /> {pending ? 'Creando…' : 'Crear deal'}
              </button>
            </div>
          </div>
        )}

        {/* Live summary rail (siempre visible) */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 20 }}>
          <div style={{ padding: '20px 22px 18px', background: 'var(--gradient)', color: '#0A0A0B' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700, opacity: 0.7 }}>Valor ponderado</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 8, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              €{weighted.toLocaleString('en-US')}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{probability}% sobre €{value.toLocaleString('en-US')}</div>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              { label: 'Vertical',      val: verticalName },
              { label: 'Etapa',         val: stageName },
              { label: 'Empresa',       val: company || '—' },
              { label: 'Contacto',      val: contactName },
              { label: 'Cierre',        val: closeDate || '—' },
              { label: 'Stakeholders',  val: String(stakeholders.length) },
            ].map((r) => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, flex: 1 }}>{r.label}</span>
                <span style={{ fontWeight: 600 }}>{r.val}</span>
              </div>
            ))}
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {tags.slice(0, 4).map((t) => (
                  <span key={t} style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 5, padding: '2px 7px', fontSize: 10.5, color: 'var(--teal)' }}>{t}</span>
                ))}
                {tags.length > 4 && <span style={{ color: 'var(--muted)', fontSize: 11 }}>+{tags.length - 4}</span>}
              </div>
            )}
            {/* Step indicator */}
            <div style={{ marginTop: 8, padding: '10px 0 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Progreso</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3].map((n) => (
                  <div key={n} style={{ flex: 1, height: 4, borderRadius: 99, background: step >= n ? 'var(--teal)' : 'var(--border)', transition: 'background 200ms' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
