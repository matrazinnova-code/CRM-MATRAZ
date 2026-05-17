import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ChatWindow from '@/components/chat/ChatWindow'

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify membership
  const { data: member } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!member) notFound()

  const [{ data: conv }, { data: rawMessages }, { data: rawMembers }] = await Promise.all([
    supabase.from('conversations').select('*').eq('id', params.id).single(),
    supabase.from('messages').select('*').eq('conversation_id', params.id).order('created_at', { ascending: true }).limit(100),
    supabase.from('conversation_members').select('user_id').eq('conversation_id', params.id),
  ])

  if (!conv) notFound()

  const memberIds = (rawMembers ?? []).map((m: any) => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_initials, role')
    .in('id', memberIds)

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

  // Enrich messages with sender profile
  const messages = (rawMessages ?? []).map((m: any) => ({
    ...m,
    sender: profileMap[m.sender_id] ?? null,
  }))

  // Conversation label
  let title = conv.name ?? ''
  if (conv.type === 'direct') {
    const otherId = memberIds.find((id: string) => id !== user.id)
    title = otherId ? (profileMap[otherId]?.full_name ?? '—') : '—'
  }

  const currentProfile = profileMap[user.id] ?? null

  return (
    <ChatWindow
      conversationId={params.id}
      title={title}
      isGroup={conv.type === 'group'}
      initialMessages={messages}
      currentUserId={user.id}
      currentProfile={currentProfile}
      profileMap={profileMap}
      memberCount={memberIds.length}
    />
  )
}
