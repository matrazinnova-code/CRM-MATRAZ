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

// ── LEAD SCORE ────────────────────────────────────────────────────────────────

export async function computeAndSaveLeadScore(contactId: string) {
  const supabase = await createClient()

  const [{ data: contact }, { data: activities }, { data: deals }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', contactId).single(),
    supabase.from('activities').select('id, created_at').eq('contact_id', contactId),
    supabase.from('deals').select('id, stage, value').eq('contact_id', contactId),
  ])

  if (!contact) return { error: 'Contact not found' }

  let score = 0

  // Datos de perfil (max 30)
  if (contact.email)   score += 15
  if (contact.phone)   score += 10
  if (contact.city)    score += 5

  // Estado (max 30)
  if (contact.status === 'prospect') score += 15
  if (contact.status === 'customer') score += 30

  // Empresa asociada (max 5)
  if (contact.company_id) score += 5

  // Deals (max 20)
  const activeDeals = (deals ?? []).filter(d => d.stage !== 'won' && d.stage !== 'lost')
  const wonDeals    = (deals ?? []).filter(d => d.stage === 'won')
  const hotDeals    = (deals ?? []).filter(d => d.stage === 'negotiation' || d.stage === 'closing')
  if (activeDeals.length > 0) score += Math.min(activeDeals.length * 5, 10)
  if (hotDeals.length > 0)    score += 5
  if (wonDeals.length > 0)    score += 5

  // Actividades (max 15)
  const actCount = (activities ?? []).length
  if (actCount >= 1) score += 5
  if (actCount >= 3) score += 5
  if (actCount >= 6) score += 5

  // Actividad reciente último mes (bonus)
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const recentAct = (activities ?? []).some(a => a.created_at > monthAgo)
  if (recentAct) score += 5

  score = Math.min(score, 100)

  await supabase.from('contacts').update({ lead_score: score }).eq('id', contactId)
  revalidatePath(`/contacts/${contactId}`)

  return { score }
}

// ── SEARCH ────────────────────────────────────────────────────────────────────

export async function searchAll(query: string) {
  if (!query.trim()) return { contacts: [], deals: [], companies: [] }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { contacts: [], deals: [], companies: [] }

  const q = query.trim()
  const [{ data: contacts }, { data: deals }, { data: companies }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, role, vertical')
      .eq('user_id', user.id)
      .ilike('name', `%${q}%`)
      .limit(5),
    supabase
      .from('deals')
      .select('id, title, value, stage')
      .eq('user_id', user.id)
      .ilike('title', `%${q}%`)
      .limit(5),
    supabase
      .from('companies')
      .select('id, name, industry')
      .eq('user_id', user.id)
      .ilike('name', `%${q}%`)
      .limit(5),
  ])

  return {
    contacts: contacts ?? [],
    deals: deals ?? [],
    companies: companies ?? [],
  }
}

export async function getRecentActivities(limit = 8) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('activities')
    .select('id, kind, title, created_at, contact:contacts(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
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
