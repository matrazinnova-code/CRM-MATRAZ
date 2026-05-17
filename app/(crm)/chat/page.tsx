import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { IcMessage } from '@/components/ui/Icons'
import NewConversationModal from '@/components/chat/NewConversationModal'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch all conversations the user belongs to
  const { data: memberRows } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', user.id)

  const convIds = (memberRows ?? []).map(r => r.conversation_id)

  let conversations: any[] = []
  if (convIds.length > 0) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .order('created_at', { ascending: false })
    conversations = data ?? []
  }

  // Fetch all members for those conversations + their profiles
  let allMembers: any[] = []
  if (convIds.length > 0) {
    const { data } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)
    allMembers = data ?? []
  }

  const memberUserIds = Array.from(new Set(allMembers.map(m => m.user_id)))
  let profiles: any[] = []
  if (memberUserIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_initials, role')
      .in('id', memberUserIds)
    profiles = data ?? []
  }
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))

  // Fetch last message per conversation
  let lastMessages: any[] = []
  if (convIds.length > 0) {
    const { data } = await supabase
      .from('messages')
      .select('conversation_id, content, sender_id, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
    // Keep only last message per conversation
    const seen = new Set<string>()
    lastMessages = (data ?? []).filter(m => {
      if (seen.has(m.conversation_id)) return false
      seen.add(m.conversation_id)
      return true
    })
  }
  const lastMsgMap = Object.fromEntries(lastMessages.map(m => [m.conversation_id, m]))

  // Fetch all users for "new conversation" modal
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_initials, role')
    .neq('id', user.id)

  function getConvLabel(conv: any) {
    if (conv.type === 'group') return conv.name ?? 'Grupo sin nombre'
    const others = allMembers
      .filter(m => m.conversation_id === conv.id && m.user_id !== user.id)
      .map(m => profileMap[m.user_id]?.full_name ?? '—')
    return others.join(', ') || '—'
  }

  function getConvInitials(conv: any) {
    if (conv.type === 'group') {
      const name = conv.name ?? 'G'
      return name.slice(0, 2).toUpperCase()
    }
    const other = allMembers.find(m => m.conversation_id === conv.id && m.user_id !== user.id)
    return profileMap[other?.user_id]?.avatar_initials ?? '?'
  }

  return (
    <div style={{ padding: '28px 32px 56px', maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Chat</div>
          <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 4 }}>
            {conversations.length} conversación{conversations.length !== 1 ? 'es' : ''}
          </div>
        </div>
        <NewConversationModal users={allProfiles ?? []} currentUserId={user.id} />
      </div>

      {conversations.length === 0 ? (
        <div className="card" style={{ padding: 56, textAlign: 'center' }}>
          <div style={{
            display: 'inline-grid', placeItems: 'center', width: 56, height: 56,
            borderRadius: 14, background: 'linear-gradient(135deg,rgba(0,212,170,.15),rgba(123,95,255,.15))',
            color: 'var(--teal)', marginBottom: 16,
          }}>
            <IcMessage size={24} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Sin conversaciones aún</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
            Inicia un chat 1:1 o crea un grupo con el botón de arriba.
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {conversations.map((conv, idx) => {
            const label = getConvLabel(conv)
            const initials = getConvInitials(conv)
            const last = lastMsgMap[conv.id]
            const isGroup = conv.type === 'group'

            return (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border-soft)',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: isGroup ? 10 : '50%',
                  background: isGroup ? 'linear-gradient(135deg,#7B5FFF,#00D4AA)' : 'var(--gradient)',
                  display: 'grid', placeItems: 'center',
                  color: '#0a0a0b', fontWeight: 700, fontSize: 13,
                  flexShrink: 0,
                }}>
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {label}
                    {isGroup && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                        background: 'rgba(123,95,255,0.15)', color: '#7B5FFF',
                      }}>Grupo</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {last
                      ? (last.sender_id === user.id ? 'Tú: ' : '') + last.content
                      : 'Sin mensajes aún'}
                  </div>
                </div>

                {last && (
                  <div style={{ fontSize: 11, color: 'var(--muted-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(last.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
