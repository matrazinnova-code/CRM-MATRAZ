import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import UserTable from '@/components/admin/UserTable'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) notFound()

  const admin = createAdminClient()

  // Platform-wide stats (bypasses RLS)
  const [
    { data: { users: authUsers } },
    { count: totalContacts },
    { count: totalDeals },
    { count: totalActivities },
    { data: profiles },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('contacts').select('*', { count: 'exact', head: true }),
    admin.from('deals').select('*', { count: 'exact', head: true }),
    admin.from('activities').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('id, full_name, role, avatar_initials, is_admin, created_at'),
  ])

  const { data: contactCounts } = await admin.from('contacts').select('user_id')
  const { data: dealCounts } = await admin.from('deals').select('user_id')
  const { data: actRows } = await admin.from('activities').select('user_id, created_at')

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const countFor = (rows: { user_id: string }[] | null, uid: string) =>
    (rows ?? []).filter(r => r.user_id === uid).length

  const lastAct = (uid: string) => {
    const acts = (actRows ?? []).filter(a => a.user_id === uid)
    if (!acts.length) return null
    return acts.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at
  }

  const userData = authUsers.map(u => ({
    id: u.id,
    email: u.email ?? '—',
    full_name: profileMap[u.id]?.full_name ?? '—',
    role: profileMap[u.id]?.role ?? '—',
    avatar_initials: profileMap[u.id]?.avatar_initials ?? '?',
    is_admin: profileMap[u.id]?.is_admin ?? false,
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at ?? null,
    last_activity: lastAct(u.id),
    contacts: countFor(contactCounts, u.id),
    deals: countFor(dealCounts, u.id),
    activities: countFor(actRows, u.id),
    confirmed: !!u.email_confirmed_at,
  }))

  const kpis = [
    { label: 'Usuarios registrados', value: authUsers.length, color: '#00D4AA' },
    { label: 'Contactos totales', value: totalContacts ?? 0, color: '#7B5FFF' },
    { label: 'Deals totales', value: totalDeals ?? 0, color: '#00B4D8' },
    { label: 'Actividades totales', value: totalActivities ?? 0, color: '#E040A0' },
  ]

  return (
    <div style={{ padding: '28px 32px 60px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#E040A0,#7B5FFF)',
            display: 'grid', placeItems: 'center', fontSize: 18,
          }}>⚙️</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Panel de administración
          </div>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13.5, marginLeft: 48 }}>
          Gestión de usuarios · Datos de toda la plataforma
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Users section */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Usuarios de la plataforma</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
            Haz click en el rol para editarlo · Toggle para dar/quitar permisos de admin
          </div>
        </div>
      </div>

      <UserTable initialUsers={userData} currentUserId={user.id} />
    </div>
  )
}
