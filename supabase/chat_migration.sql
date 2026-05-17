-- ============================================================
-- CHAT MIGRATION — run this in the Supabase SQL editor
-- ============================================================

-- 1. Conversations (direct or group)
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('direct', 'group')),
  name        text,                    -- only for group chats
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

-- 2. Conversation members
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  joined_at       timestamptz default now(),
  primary key (conversation_id, user_id)
);

-- 3. Messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  content         text not null,
  created_at      timestamptz default now()
);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.conversations       enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages            enable row level security;

-- conversations: visible to members
create policy "conv_select" on public.conversations for select
  using (exists (
    select 1 from public.conversation_members
    where conversation_id = conversations.id and user_id = auth.uid()
  ));

create policy "conv_insert" on public.conversations for insert
  with check (auth.uid() = created_by);

-- conversation_members: visible to members of same conversation
create policy "members_select" on public.conversation_members for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
        and cm.user_id = auth.uid()
    )
  );

create policy "members_insert" on public.conversation_members for insert
  with check (
    -- the conversation creator can add anyone; users can add themselves
    auth.uid() = (select created_by from public.conversations where id = conversation_id)
    or auth.uid() = user_id
  );

-- messages: members can read and send
create policy "msg_select" on public.messages for select
  using (exists (
    select 1 from public.conversation_members
    where conversation_id = messages.conversation_id and user_id = auth.uid()
  ));

create policy "msg_insert" on public.messages for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.conversation_members
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

-- ── Realtime ────────────────────────────────────────────────
-- Enable Realtime on messages table so the chat updates live
alter publication supabase_realtime add table public.messages;

-- ── Helper function: find existing direct conversation ───────
create or replace function find_direct_conversation(user_a uuid, user_b uuid)
returns uuid
language sql
security definer
as $$
  select cm1.conversation_id
  from public.conversation_members cm1
  join public.conversation_members cm2
    on cm1.conversation_id = cm2.conversation_id
  join public.conversations c
    on c.id = cm1.conversation_id
  where cm1.user_id = user_a
    and cm2.user_id = user_b
    and c.type = 'direct'
  limit 1;
$$;
