-- ============================================================
-- CHAT UNREAD + GROUP MANAGEMENT — run after chat_migration.sql
-- ============================================================

-- 1. Add last_read_at to track unread messages per member
alter table public.conversation_members
  add column if not exists last_read_at timestamptz;

-- 2. Allow members to update their own last_read_at
create policy "members_update" on public.conversation_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Allow creator to delete members (for remove-member feature)
create policy "creator_delete_members" on public.conversation_members for delete
  using (
    user_id = auth.uid() or
    auth.uid() = (select created_by from public.conversations where id = conversation_id)
  );

-- 4. Function: total unread messages for the current user
create or replace function get_unread_count()
returns bigint
language sql
security definer
as $$
  select count(m.id)
  from public.messages m
  join public.conversation_members cm
    on cm.conversation_id = m.conversation_id
  where cm.user_id = auth.uid()
    and m.sender_id != auth.uid()
    and (cm.last_read_at is null or m.created_at > cm.last_read_at);
$$;

-- 5. Function: unread count per conversation for the current user
create or replace function get_unread_per_conversation()
returns table(conversation_id uuid, unread_count bigint)
language sql
security definer
as $$
  select m.conversation_id, count(m.id) as unread_count
  from public.messages m
  join public.conversation_members cm
    on cm.conversation_id = m.conversation_id
  where cm.user_id = auth.uid()
    and m.sender_id != auth.uid()
    and (cm.last_read_at is null or m.created_at > cm.last_read_at)
  group by m.conversation_id;
$$;
