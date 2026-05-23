import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return null
  return user
}

// UUID v4 format validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// DELETE /api/admin/users/[id] — delete a user
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(`admin-delete:${ip}`, 10, 60_000)) return rateLimitResponse()

  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }
  if (params.id === caller.id) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch target user info for audit log before deletion
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', params.id)
    .single()

  // Delete profile first (cleans up chat memberships, etc. via cascade)
  await admin.from('profiles').delete().eq('id', params.id)

  // Delete auth user
  const { error } = await admin.auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log (non-fatal if table doesn't exist yet)
  await admin.from('audit_logs').insert({
    action: 'ADMIN_DELETE_USER',
    actor_id: caller.id,
    target_id: params.id,
    details: { target_name: targetProfile?.full_name ?? 'unknown' },
  }).then(() => {/* ignore */})

  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/users/[id] — update role or is_admin
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(`admin-patch:${ip}`, 20, 60_000)) return rateLimitResponse()

  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const updates: { role?: string; is_admin?: boolean } = {}

  if (raw.role !== undefined) {
    if (typeof raw.role !== 'string' || raw.role.length > 100) {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
    }
    updates.role = raw.role.trim()
  }

  if (raw.is_admin !== undefined) {
    if (typeof raw.is_admin !== 'boolean') {
      return NextResponse.json({ error: 'is_admin must be a boolean' }, { status: 400 })
    }
    // Prevent removing admin from self
    if (params.id === caller.id && raw.is_admin === false) {
      return NextResponse.json({ error: 'No puedes quitarte permisos de admin' }, { status: 400 })
    }
    updates.is_admin = raw.is_admin
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log (non-fatal if table doesn't exist yet)
  await admin.from('audit_logs').insert({
    action: 'ADMIN_UPDATE_USER',
    actor_id: caller.id,
    target_id: params.id,
    details: updates,
  }).then(() => {/* ignore */})

  return NextResponse.json({ ok: true })
}
