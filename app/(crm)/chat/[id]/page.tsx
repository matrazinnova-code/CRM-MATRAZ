import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ChatWindow from '@/components/chat/ChatWindow'

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!member) notFound()

  const [{ data: conv }, { data: rawMessages }, { data: rawMembers }] = await Promise.all([
    supabase.from('conversations').select('*').eq('id', params.id).single(),
    supabase.from('messages').select('*').eq('conversation_id', params.id).order('created_at', { ascending: true }).limit(200),
    supabase.from('conversation_members').select('user_id').eq('conversation_id', params.id),
  ])

  if (!conv) notFound()

  const memberIds = (rawMembers ?? []).map((m: any) => m.user_id)

  // Fetch member profiles + all platform profiles (for add-member)
  const [{ data: memberProfilesRaw }, { data: allProfilesRaw }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_initials, role').in('id', memberIds),
    supabase.from('profiles').select('id, full_name, avatar_initials, role'),
  ])

  const profileMap = Object.fromEntries((memberProfilesRaw ?? []).map((p: any) => [p.id, p]))
  const allUsers = (allProfilesRaw ?? []).filter((p: any) => p.id !== user.id)

  const messages = (rawMessages ?? []).map((m: any) => ({
    ...m,
    sender: profileMap[m.sender_id] ?? null,
  }))

  let title = conv.name ?? ''
  if (conv.type === 'direct') {
    const otherId = memberIds.find((id: string) => id !== user.id)
    title = otherId ? (profileMap[otherId]?.full_name ?? '—') : '—'
  }

  return (
    <ChatWindow
      conversationId={params.id}
      title={title}
      isGroup={conv.type === 'group'}
      initialMessages={messages}
      currentUserId={user.id}
      currentProfile={profileMap[user.id] ?? null}
      profileMap={profileMap}
      memberCount={memberIds.length}
      allUsers={allUsers}
      isCreator={conv.created_by === user.id}
      memberProfiles={memberProfilesRaw ?? []}
    />
  )
}
