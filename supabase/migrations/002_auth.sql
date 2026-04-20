-- Whitelist-based passwordless auth.
--
-- Anyone trying to log in via magic link must already be in public.allowed_emails.
-- A trigger on auth.users blocks unapproved sign-ups. Admins manage the whitelist
-- from /admin, which RLS gates.

create table if not exists public.allowed_emails (
  email text primary key,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  created_by text
);

-- Seed first admin. INSERT ... ON CONFLICT so re-runs are safe.
insert into public.allowed_emails (email, role, created_by)
values ('kevin@splashradius.com', 'admin', 'bootstrap')
on conflict (email) do update set role = excluded.role;

alter table public.allowed_emails enable row level security;

drop policy if exists "allowed_emails_read" on public.allowed_emails;
create policy "allowed_emails_read" on public.allowed_emails
  for select using (
    auth.uid() is not null
  );

drop policy if exists "allowed_emails_admin_all" on public.allowed_emails;
create policy "allowed_emails_admin_all" on public.allowed_emails
  for all using (
    exists (
      select 1
      from public.allowed_emails a
      where a.email = (auth.jwt() ->> 'email')
        and a.role = 'admin'
    )
  ) with check (
    exists (
      select 1
      from public.allowed_emails a
      where a.email = (auth.jwt() ->> 'email')
        and a.role = 'admin'
    )
  );

-- Block sign-ups from un-whitelisted emails.
create or replace function public.enforce_email_whitelist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_emails a where a.email = new.email
  ) then
    raise exception 'Email % is not authorized to sign in. Ask an admin to invite you.', new.email
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_whitelist on auth.users;
create trigger enforce_email_whitelist
  before insert on auth.users
  for each row execute function public.enforce_email_whitelist();

-- Tighten oos_reports: authenticated users only.
drop policy if exists "oos_select_all" on public.oos_reports;
create policy "oos_select_auth" on public.oos_reports
  for select using (auth.uid() is not null);

drop policy if exists "oos_insert_all" on public.oos_reports;
create policy "oos_insert_auth" on public.oos_reports
  for insert with check (auth.uid() is not null);

drop policy if exists "oos_update_all" on public.oos_reports;
create policy "oos_update_auth" on public.oos_reports
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "oos_delete_auth" on public.oos_reports;
create policy "oos_delete_auth" on public.oos_reports
  for delete using (auth.uid() is not null);
