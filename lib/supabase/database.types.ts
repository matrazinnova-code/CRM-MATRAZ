export type Vertical = 'business' | 'healthcare' | 'it'
export type ContactStatus = 'lead' | 'prospect' | 'customer'
export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closing' | 'won' | 'lost'
export type ActivityKind = 'call' | 'email' | 'meeting' | 'note' | 'task' | 'doc' | 'star'

export interface Profile {
  id: string
  full_name: string | null
  role: string | null
  avatar_initials: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  user_id: string
  name: string
  industry: string | null
  website: string | null
  city: string | null
  country: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  user_id: string
  company_id: string | null
  name: string
  role: string | null
  email: string | null
  phone: string | null
  city: string | null
  vertical: Vertical
  status: ContactStatus
  lead_score: number
  pipeline_value: number
  created_at: string
  updated_at: string
  // joined
  company?: Company | null
}

export interface Deal {
  id: string
  user_id: string
  contact_id: string | null
  company_id: string | null
  title: string
  value: number
  vertical: Vertical
  stage: DealStage
  probability: number
  close_date: string | null
  description: string | null
  tags: string[]
  owner_name: string | null
  position: number
  created_at: string
  updated_at: string
  // joined
  contact?: Contact | null
  company?: Company | null
}

export interface Activity {
  id: string
  user_id: string
  contact_id: string | null
  deal_id: string | null
  kind: ActivityKind
  title: string
  body: string | null
  created_at: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name: string | null
  created_by: string | null
  created_at: string
  // joined
  members?: ConversationMember[]
  last_message?: Message | null
}

export interface ConversationMember {
  conversation_id: string
  user_id: string
  joined_at: string
  // joined
  profile?: Profile | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  // joined
  sender?: Profile | null
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      companies: { Row: Company; Insert: Partial<Company>; Update: Partial<Company> }
      contacts: { Row: Contact; Insert: Partial<Contact>; Update: Partial<Contact> }
      deals: { Row: Deal; Insert: Partial<Deal>; Update: Partial<Deal> }
      activities: { Row: Activity; Insert: Partial<Activity>; Update: Partial<Activity> }
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation> }
      conversation_members: { Row: ConversationMember; Insert: Partial<ConversationMember>; Update: Partial<ConversationMember> }
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message> }
    }
  }
}
