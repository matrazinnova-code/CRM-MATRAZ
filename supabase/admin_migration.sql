-- ============================================================
-- ADMIN PANEL MIGRATION
-- ============================================================

-- 1. Add is_admin flag to profiles
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2. Make the first/only user superadmin
--    Run this separately after the migration, replacing YOUR_EMAIL:
--    UPDATE public.profiles SET is_admin = true
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');

-- 3. Allow admins to update any profile (for role changes)
create policy "admin_update_any_profile" on public.profiles for update
  using (
    (select is_admin from public.profiles where id = auth.uid())
    or auth.uid() = id
  );

-- 4. Helper: check if current user is admin
create or replace function is_admin()
returns boolean language sql security definer as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;
