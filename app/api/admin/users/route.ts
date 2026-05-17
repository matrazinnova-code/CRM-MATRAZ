import { NextResponse } from 'next/server'
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

export async function GET() {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()

  // List all auth users
  const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch all profiles
  const { data: profiles } = await admin.from('profiles').select('id, full_name, role, avatar_initials, is_admin, created_at')

  // Fetch counts per user
  const { data: contactCounts } = await admin.from('contacts').select('user_id')
  const { data: dealCounts } = await admin.from('deals').select('user_id')
  const { data: actCounts } = await admin.from('activities').select('user_id, created_at')

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const countByUser = (rows: { user_id: string }[] | null, uid: string) =>
    (rows ?? []).filter(r => r.user_id === uid).length

  const lastActivity = (uid: string) => {
    const acts = (actCounts ?? []).filter(a => a.user_id === uid)
    if (!acts.length) return null
    return acts.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at
  }

  const result = users.map(u => ({
    id: u.id,
    email: u.email ?? '—',
    full_name: profileMap[u.id]?.full_name ?? '—',
    role: profileMap[u.id]?.role ?? '—',
    avatar_initials: profileMap[u.id]?.avatar_initials ?? '?',
    is_admin: profileMap[u.id]?.is_admin ?? false,
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at ?? null,
    last_activity: lastActivity(u.id),
    contacts: countByUser(contactCounts, u.id),
    deals: countByUser(dealCounts, u.id),
    activities: countByUser(actCounts, u.id),
    confirmed: !!u.email_confirmed_at,
  }))

  return NextResponse.json(result)
}
