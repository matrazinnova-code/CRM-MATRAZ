-- Audit log table for tracking privileged admin actions.
-- Run this in the Supabase SQL editor.

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  actor_id    uuid references auth.users(id) on delete set null,
  target_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

-- Only service role (admin API) can insert; nobody can update/delete audit logs
alter table public.audit_logs enable row level security;

create policy "Service role only"
  on public.audit_logs
  for all
  using (false)
  with check (false);

-- Index for querying by actor or target
create index if not exists audit_logs_actor_idx  on public.audit_logs (actor_id);
create index if not exists audit_logs_target_idx on public.audit_logs (target_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
