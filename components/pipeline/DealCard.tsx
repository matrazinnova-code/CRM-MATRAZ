'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { VerticalBadge } from '@/components/ui/Badge'
import { IcSparkle, IcMore, IcClock, IcCalendar } from '@/components/ui/Icons'
import { deleteDeal, updateDeal } from '@/lib/actions'
import type { Deal, Vertical, DealStage } from '@/lib/supabase/database.types'

const STAGES: DealStage[] = ['lead','qualified','proposal','negotiation','closing','won','lost']
const VERTICALS: Vertical[] = ['healthcare','it','business']

const iStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 11px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box',
}

interface Props {
  deal: Deal
  isDragging?: boolean
  isDragOverlay?: boolean
}

export default function DealCard({ deal, isDragging, isDragOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: deal.id })
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  // Edit form state
  const [eTitle,   setETitle]   = useState(deal.title)
  const [eValue,   setEValue]   = useState(String(deal.value))
  const [eVertical,setEVertical]= useState<Vertical>(deal.vertical)
  const [eStage,   setEStage]   = useState<DealStage>(deal.stage)
  const [eProb,    setEProb]    = useState(String(deal.probability ?? 80))
  const [eDate,    setEDate]    = useState(deal.close_date ?? '')
  const [eDesc,    setEDesc]    = useState(deal.description ?? '')
  const [editErr,  setEditErr]  = useState<string | null>(null)

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const fmt = (v: number) =>
    v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(2)}M` : `€${(v / 1000).toFixed(0)}K`

  const isHot = deal.stage === 'closing' && deal.value >= 200_000
  const ageDays = Math.floor((Date.now() - new Date(deal.created_at).getTime()) / 86_400_000)

  function handleDelete() {
    setMenuOpen(false)
    if (!confirm(`¿Eliminar "${deal.title}"?`)) return
    startTransition(() => deleteDeal(deal.id))
  }

  function handleEditSave() {
    if (!eTitle.trim()) { setEditErr('El título es obligatorio'); return }
    const val = parseFloat(eValue)
    if (isNaN(val) || val < 0) { setEditErr('Valor no válido'); return }
    setEditErr(null)
    updateDeal(deal.id, {
      title: eTitle.trim(),
      value: val,
      vertical: eVertical,
      stage: eStage,
      probability: parseInt(eProb) || 80,
      close_date: eDate || undefined,
      description: eDesc.trim() || undefined,
    }).then((res) => {
      if (res?.error) { setEditErr(res.error); return }
      setEditOpen(false)
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`k-card ${isDragging ? 'dragging' : ''}`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <VerticalBadge vertical={deal.vertical} />
        {isHot && (
          <span className="badge hot" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IcSparkle size={10} /> Hot
          </span>
        )}

        {/* ··· menu */}
        <div ref={menuRef} style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            className="icon-btn"
            style={{ width: 22, height: 22, borderColor: 'transparent', background: 'transparent' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
          >
            <IcMore size={14} />
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', zIndex: 50,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '4px 0', minWidth: 150,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setEditOpen(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#fff', fontSize: 13, textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                ✏️ Editar deal
              </button>
              <button
                disabled={isPending}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); handleDelete() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#ff6b6b', fontSize: 13, textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,107,107,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                {isPending ? 'Eliminando…' : '🗑 Eliminar deal'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title + company */}
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{deal.title}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
        {deal.company?.name ?? deal.contact?.name ?? '—'}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          fontSize: 9.5, fontWeight: 700,
          background: 'rgba(0,212,170,0.10)',
          color: 'var(--teal)',
          border: '1px solid rgba(0,212,170,0.3)',
          flexShrink: 0,
        }}>
          {(deal.owner_name ?? 'IM').substring(0, 2).toUpperCase()}
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {deal.contact?.name ?? deal.owner_name ?? '—'}
        </span>
        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>
          {fmt(deal.value)}
        </span>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, color: 'var(--muted-2)', fontSize: 11 }}>
        <IcClock size={11} />
        <span>{ageDays}d</span>
        <span style={{ width: 2, height: 2, background: 'currentColor', borderRadius: '50%' }} />
        <IcCalendar size={11} />
        <span>{deal.close_date ? new Date(deal.close_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Sin fecha'}</span>
        {deal.probability != null && (
          <>
            <span style={{ width: 2, height: 2, background: 'currentColor', borderRadius: '50%' }} />
            <span>{deal.probability}%</span>
          </>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setEditOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 28, width: 500, maxWidth: '95vw',
              maxHeight: '90vh', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Editar deal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Título *</div>
                <input style={iStyle} value={eTitle} onChange={(e) => setETitle(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Valor (€)</div>
                  <input style={iStyle} type="number" min="0" value={eValue} onChange={(e) => setEValue(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Probabilidad (%)</div>
                  <input style={iStyle} type="number" min="0" max="100" value={eProb} onChange={(e) => setEProb(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Vertical</div>
                  <select style={{ ...iStyle, cursor: 'pointer' }} value={eVertical} onChange={(e) => setEVertical(e.target.value as Vertical)}>
                    {VERTICALS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Etapa</div>
                  <select style={{ ...iStyle, cursor: 'pointer' }} value={eStage} onChange={(e) => setEStage(e.target.value as DealStage)}>
                    {STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Fecha de cierre</div>
                <input style={iStyle} type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Descripción</div>
                <textarea
                  style={{ ...iStyle, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
                />
              </div>
            </div>
            {editErr && <div style={{ fontSize: 12, color: 'var(--magenta)', marginTop: 10 }}>{editErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button className="btn ghost" onClick={() => setEditOpen(false)}>Cancelar</button>
              <button className="btn primary" onClick={() => startTransition(handleEditSave)} disabled={isPending}>
                {isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
