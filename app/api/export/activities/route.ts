import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const KIND_LABEL: Record<string, string> = {
  call: 'Llamada',
  email: 'Email',
  meeting: 'Reunión',
  task: 'Tarea',
  note: 'Nota',
}

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  // Prefix formula injection chars so Excel/Sheets don't evaluate them
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(`export:${ip}`, 10, 60_000)) return rateLimitResponse()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: rawActs }, { data: contacts }] = await Promise.all([
    supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('contacts')
      .select('id, name, company_id, vertical')
      .eq('user_id', user.id),
  ])

  const contactMap = Object.fromEntries((contacts ?? []).map(c => [c.id, c]))

  const rows = (rawActs ?? []).map(a => {
    const contact = a.contact_id ? contactMap[a.contact_id] : null
    const date = new Date(a.created_at)
    return [
      escapeCsv(date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })),
      escapeCsv(date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })),
      escapeCsv(KIND_LABEL[a.kind] ?? a.kind),
      escapeCsv(a.title),
      escapeCsv(contact?.name ?? ''),
      escapeCsv(contact?.vertical ?? ''),
      escapeCsv(a.body ?? ''),
    ].join(',')
  })

  const header = ['Fecha', 'Hora', 'Tipo', 'Título', 'Contacto', 'Vertical', 'Notas'].join(',')
  const csv = [header, ...rows].join('\n')

  const filename = `actividades_${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
