'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createDirectConversation(otherUserId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: existing } = await supabase.rpc('find_direct_conversation', {
    user_a: user.id,
    user_b: otherUserId,
  })

  if (existing) return existing as string

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

export async function addGroupMember(
  conversationId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('created_by, type')
    .eq('id', conversationId)
    .single()

  if (!conv || conv.type !== 'group') return { error: 'Conversación no válida' }
  if (conv.created_by !== user.id) return { error: 'Solo el creador puede añadir miembros' }

  const { error } = await supabase.from('conversation_members').insert({
    conversation_id: conversationId,
    user_id: userId,
  })

  revalidatePath(`/chat/${conversationId}`)
  return { error: error?.message ?? null }
}

export async function removeGroupMember(
  conversationId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('created_by')
    .eq('id', conversationId)
    .single()

  if (userId !== user.id && conv?.created_by !== user.id) {
    return { error: 'Sin permiso para eliminar este miembro' }
  }

  await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  revalidatePath(`/chat/${conversationId}`)
  return { error: null }
}
