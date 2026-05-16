'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { VerticalBadge, StatusBadge, ContactAvatar, VERTICAL_COLORS } from '@/components/ui/Badge'
import { IcSearch, IcFilter, IcPlus, IcDoc, IcMore, IcEdit, IcTrash, IcUsers } from '@/components/ui/Icons'
import type { Contact, Vertical, ContactStatus } from '@/lib/supabase/database.types'
import AddContactModal from './AddContactModal'
import { deleteContact, updateContact } from '@/lib/actions'

const VERTICALS: { key: Vertical; label: string }[] = [
  { key: 'business',   label: 'Business' },
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'it',         label: 'IT' },
]
const STATUSES: { key: ContactStatus; label: string }[] = [
  { key: 'lead',     label: 'Lead' },
  { key: 'prospect', label: 'Prospect' },
  { key: 'customer', label: 'Customer' },
]

type SortKey = 'name' | 'company' | 'pipeline_value' | 'created_at'

// ── Row menu ─────────────────────────────────────────────────────────────────
function RowMenu({ contact, onEdit }: { contact: Contact; onEdit: (c: Contact) => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function handleDelete() {
    setOpen(false)
    if (!confirm(`¿Eliminar a "${contact.name}"? Esta acción no se puede deshacer.`)) return
    startTransition(() => deleteContact(contact.id))
  }

  const items = [
    {
      label: 'Ver perfil',
      icon: <IcUsers size={13} />,
      color: 'var(--muted)',
      action: () => { setOpen(false); router.push(`/contacts/${contact.id}`) },
    },
    {
      label: 'Modificar',
      icon: <IcEdit size={13} />,
      color: 'var(--muted)',
      action: () => { setOpen(false); onEdit(contact) },
    },
    {
      label: isPending ? 'Eliminando…' : 'Eliminar',
      icon: <IcTrash size={13} />,
      color: '#ff6b6b',
      action: handleDelete,
    },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        style={{ width: 28, height: 28 }}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
      >
        <IcMore size={14} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 60,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '4px 0', minWidth: 150,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}>
          {items.map((item) => (
            <button
              key={item.label}
              disabled={isPending}
              onClick={(e) => { e.stopPropagation(); item.action() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '8px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: item.color, fontSize: 13, textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditContactModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(contact.name)
  const [role, setRole] = useState(contact.role ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [city, setCity] = useState(contact.city ?? '')
  const [status, setStatus] = useState<ContactStatus>(contact.status)
  const [vertical, setVertical] = useState<Vertical>(contact.vertical)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    startTransition(() => {
      updateContact(contact.id, { name, role: role || null, email: email || null, phone: phone || null, city: city || null, status, vertical })
        .then((res: any) => {
          if (res?.error) { setError(res.error); return }
          router.refresh()
          onClose()
        })
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Modificar contacto</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Nombre', value: name, set: setName, required: true },
            { label: 'Cargo', value: role, set: setRole },
            { label: 'Email', value: email, set: setEmail },
            { label: 'Teléfono', value: phone, set: setPhone },
            { label: 'Ciudad', value: city, set: setCity },
          ].map((f) => (
            <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{f.label}</label>
              <input className="input" value={f.value} onChange={(e) => f.set(e.target.value)} />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Vertical</label>
              <select className="select-input" value={vertical} onChange={(e) => setVertical(e.target.value as Vertical)}>
                {VERTICALS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Estado</label>
              <select className="select-input" value={status} onChange={(e) => setStatus(e.target.value as ContactStatus)}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={isPending || !name.trim()} onClick={handleSave}>
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main table ────────────────────────────────────────────────────────────────
export default function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [vertical, setVertical] = useState<Vertical | 'all'>('all')
  const [status, setStatus] = useState<ContactStatus | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('pipeline_value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showAdd, setShowAdd] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)

  const filtered = useMemo(() => {
    let out = contacts.filter((c) => {
      const q = query.trim().toLowerCase()
      if (q && !(c.name.toLowerCase().includes(q) || (c.company?.name ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q))) return false
      if (vertical !== 'all' && c.vertical !== vertical) return false
      if (status !== 'all' && c.status !== status) return false
      return true
    })
    out.sort((a, b) => {
      let va: string | number = a[sortKey] ?? ''
      let vb: string | number = b[sortKey] ?? ''
      if (sortKey === 'company') { va = a.company?.name ?? ''; vb = b.company?.name ?? '' }
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return out
  }, [contacts, query, vertical, status, sortKey, sortDir])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('asc') }
  }
  const arrow = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
            <IcSearch size={16} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: 38, height: 36 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, empresa o email…"
          />
        </div>

        <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Vertical</span>
        <button className={`chip ${vertical === 'all' ? 'active' : ''}`} onClick={() => setVertical('all')}>Todas</button>
        {VERTICALS.map((v) => (
          <button
            key={v.key}
            className={`chip ${vertical === v.key ? 'active' : ''}`}
            onClick={() => setVertical(v.key)}
            style={vertical === v.key ? { color: VERTICAL_COLORS[v.key], borderColor: VERTICAL_COLORS[v.key] + '66', background: VERTICAL_COLORS[v.key] + '14' } : undefined}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: VERTICAL_COLORS[v.key], display: 'inline-block' }} />
            {v.label}
          </button>
        ))}

        <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Estado</span>
        <button className={`chip ${status === 'all' ? 'active' : ''}`} onClick={() => setStatus('all')}>Todos</button>
        {STATUSES.map((s) => (
          <button key={s.key} className={`chip ${status === s.key ? 'active' : ''}`} onClick={() => setStatus(s.key)}>
            {s.label}
          </button>
        ))}

        <button className="btn ghost" style={{ marginLeft: 'auto' }}>
          <IcFilter size={14} /> Más filtros
        </button>
        <button className="btn ghost">
          <IcDoc size={14} /> Exportar
        </button>
        <button className="btn primary" onClick={() => setShowAdd(true)}>
          <IcPlus size={14} /> Nuevo contacto
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {[
                { key: 'name' as SortKey, label: 'Contacto', w: '24%' },
                { key: 'company' as SortKey, label: 'Empresa', w: '22%' },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{
                    width: col.w, textAlign: 'left',
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--muted)', padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.015)',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  {col.label}
                  <span style={{ color: 'var(--teal)', marginLeft: 4, fontSize: 10 }}>{arrow(col.key)}</span>
                </th>
              ))}
              {['Vertical', 'Estado'].map((h) => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
                  {h}
                </th>
              ))}
              <th
                onClick={() => toggleSort('pipeline_value')}
                style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)', cursor: 'pointer', userSelect: 'none', fontVariantNumeric: 'tabular-nums' }}
              >
                Valor{arrow('pipeline_value')}
              </th>
              <th style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
                Creado
              </th>
              <th style={{ width: 44, borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/contacts/${c.id}`)}
                style={{ borderBottom: '1px solid var(--border-soft)', cursor: 'pointer', transition: '100ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,212,170,0.025)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ContactAvatar name={c.name} vertical={c.vertical} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 1 }}>{c.role ?? '—'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                  <div style={{ fontWeight: 500 }}>{c.company?.name ?? '—'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 1 }}>{c.email ?? ''}</div>
                </td>
                <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}><VerticalBadge vertical={c.vertical} /></td>
                <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}><StatusBadge status={c.status} /></td>
                <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  €{(c.pipeline_value ?? 0).toLocaleString('en-US')}
                </td>
                <td style={{ padding: '14px 16px', verticalAlign: 'middle', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                  {new Date(c.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '14px 8px', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                  <RowMenu contact={c} onEdit={setEditContact} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '48px 22px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  No se encontraron contactos con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12.5 }}>
          <span>Mostrando {filtered.length} de {contacts.length} contactos</span>
        </div>
      </div>

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} />}
      {editContact && <EditContactModal contact={editContact} onClose={() => setEditContact(null)} />}
    </>
  )
}
