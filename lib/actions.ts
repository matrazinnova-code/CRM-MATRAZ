'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Vertical, ContactStatus, DealStage, ActivityKind } from '@/lib/supabase/database.types'

// ── AUTH ─────────────────────────────────────────────────────────────────────

export async function login(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  return { success: true }
}

export async function register(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const full_name = formData.get('full_name') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

// ── PROFILE ───────────────────────────────────────────────────────────────────

export async function updateProfile(data: {
  full_name?: string
  role?: string
  avatar_initials?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/')
  return { success: true }
}

// ── COMPANIES ─────────────────────────────────────────────────────────────────

export async function createCompany(data: {
  name: string
  industry?: string
  city?: string
  country?: string
  website?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: company, error } = await supabase
    .from('companies')
    .insert({ ...data, user_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { data: company }
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────

export async function createContact(data: {
  name: string
  role?: string
  email?: string
  phone?: string
  city?: string
  vertical: Vertical
  status: ContactStatus
  company_id?: string
  lead_score?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({ ...data, user_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { data: contact }
}

export async function updateContact(id: string, data: Partial<{
  name: string
  role: string
  email: string
  phone: string
  city: string
  vertical: Vertical
  status: ContactStatus
  lead_score: number
  pipeline_value: number
  company_id: string
}>) {
  const supabase = await createClient()
  const { error } = await supabase.from('contacts').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/contacts')
  revalidatePath(`/contacts/${id}`)
  return { success: true }
}

export async function deleteContact(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { success: true }
}

// ── DEALS ─────────────────────────────────────────────────────────────────────

export async function createDeal(data: {
  title: string
  value: number
  vertical: Vertical
  stage: DealStage
  probability?: number
  close_date?: string
  description?: string
  tags?: string[]
  owner_name?: string
  contact_id?: string
  company_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get max position in stage
  const { data: maxPos } = await supabase
    .from('deals')
    .select('position')
    .eq('stage', data.stage)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const position = (maxPos?.position ?? -1) + 1

  const { data: deal, error } = await supabase
    .from('deals')
    .insert({ ...data, user_id: user.id, position })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/pipeline')
  revalidatePath('/deals/new')
  return { data: deal }
}

export async function updateDeal(id: string, data: Partial<{
  title: string
  value: number
  vertical: Vertical
  stage: DealStage
  probability: number
  close_date: string
  description: string
  tags: string[]
  owner_name: string
  position: number
  contact_id: string
  company_id: string
}>) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pipeline')
  return { success: true }
}

export async function moveDeal(id: string, stage: DealStage, position: number) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('deals')
    .update({ stage, position })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pipeline')
  return { success: true }
}

export async function deleteDeal(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pipeline')
  return { success: true }
}

// ── ACTIVITIES ────────────────────────────────────────────────────────────────

export async function createActivity(data: {
  kind: ActivityKind
  title: string
  body?: string
  contact_id?: string
  deal_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: activity, error } = await supabase
    .from('activities')
    .insert({ ...data, user_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  if (data.contact_id) revalidatePath(`/contacts/${data.contact_id}`)
  return { data: activity }
}

export async function deleteActivity(id: string, contactId?: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) return { error: error.message }
  if (contactId) revalidatePath(`/contacts/${contactId}`)
  return { success: true }
}
