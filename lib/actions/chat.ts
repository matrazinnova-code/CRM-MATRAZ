'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createDirectConversation(otherUserId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if direct conversation already exists between these two users
  const { data: existing } = await supabase.rpc('find_direct_conversation', {
    user_a: user.id,
    user_b: otherUserId,
  }) as { data: string | null }

  if (existing) return existing

  // Create new direct conversation
  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ type: 'direct', created_by: user.id })
    .select('id')
    .single()

  if (error || !conv) return null

  await supabase.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: user.id },
    { conversation_id: conv.id, user_id: otherUserId },
  ])

  revalidatePath('/chat')
  return conv.id
}

export async function createGroupConversation(
  name: string,
  memberIds: string[],
): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ type: 'group', name, created_by: user.id })
    .select('id')
    .single()

  if (error || !conv) return null

  const allIds = Array.from(new Set([user.id, ...memberIds]))
  await supabase.from('conversation_members').insert(
    allIds.map(uid => ({ conversation_id: conv.id, user_id: uid }))
  )

  revalidatePath('/chat')
  return conv.id
}

export async function sendMessage(conversationId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !content.trim()) return

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: content.trim(),
  })
}
