-- Flatten RLS for allowed_emails. The previous admin policy queried
-- allowed_emails inside its USING clause, which re-applies RLS and can
-- evaluate as false even for seeded admins. Use a SECURITY DEFINER helper
-- that bypasses RLS cleanly.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

drop policy if exists "allowed_emails_read" on public.allowed_emails;
drop policy if exists "allowed_emails_admin_all" on public.allowed_emails;

create policy "allowed_emails_read" on public.allowed_emails
  for select using (auth.uid() is not null);

create policy "allowed_emails_admin_insert" on public.allowed_emails
  for insert with check (public.is_admin());

create policy "allowed_emails_admin_update" on public.allowed_emails
  for update using (public.is_admin()) with check (public.is_admin());

create policy "allowed_emails_admin_delete" on public.allowed_emails
  for delete using (public.is_admin());
