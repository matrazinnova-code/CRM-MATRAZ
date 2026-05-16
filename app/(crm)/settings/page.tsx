import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <div style={{ padding: '28px 32px 56px', maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Ajustes</div>
        <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6 }}>Gestiona tu perfil y preferencias</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>
          Información de perfil
        </div>
        <div style={{ padding: '28px 24px' }}>
          <SettingsForm profile={profile} email={user?.email ?? ''} />
        </div>
      </div>
    </div>
  )
}
