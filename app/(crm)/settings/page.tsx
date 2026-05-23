import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/settings/SettingsForm'
import PasswordForm from '@/components/settings/PasswordForm'
import MfaForm from '@/components/settings/MfaForm'

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '24px 24px 28px' }}>
        {children}
      </div>
    </div>
  )
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div style={{ padding: '28px 32px 56px', maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Ajustes</div>
        <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6 }}>Gestiona tu perfil, seguridad y preferencias</div>
      </div>

      {/* Profile */}
      <Section title="Información de perfil" subtitle="Nombre, cargo e iniciales que aparecen en el CRM">
        <SettingsForm profile={profile} email={user?.email ?? ''} />
      </Section>

      {/* Password */}
      <Section title="Contraseña" subtitle="Actualiza tu contraseña de acceso">
        <PasswordForm />
      </Section>

      {/* 2FA */}
      <Section title="Autenticación en dos pasos (2FA)" subtitle="Protege tu cuenta con un código adicional al iniciar sesión">
        <MfaForm />
      </Section>

      {/* Account info (read-only) */}
      <Section title="Información de cuenta">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Email', value: user?.email ?? '—' },
            { label: 'Cuenta creada', value: createdAt },
            { label: 'Último acceso', value: lastSignIn },
            { label: 'ID de usuario', value: user?.id ?? '—', mono: true, small: true },
          ].map((row) => (
            <div
              key={row.label}
              style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'center' }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{row.label}</span>
              <span style={{
                fontSize: row.small ? 11.5 : 13,
                fontFamily: row.mono ? 'monospace' : 'inherit',
                color: '#fff',
                wordBreak: 'break-all',
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
