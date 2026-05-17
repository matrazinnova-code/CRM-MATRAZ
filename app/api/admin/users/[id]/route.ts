import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return null
  return user
}

// DELETE /api/admin/users/[id] — delete a user
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (params.id === caller.id) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })

  const admin = createAdminClient()

  // Delete profile first (cleans up chat memberships, etc. via cascade)
  await admin.from('profiles').delete().eq('id', params.id)

  // Delete auth user
  const { error } = await admin.auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/users/[id] — update role or is_admin
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()

  const updates: Record<string, any> = {}
  if (body.role !== undefined) updates.role = body.role
  if (body.is_admin !== undefined) updates.is_admin = body.is_admin

  const { error } = await admin.from('profiles').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
