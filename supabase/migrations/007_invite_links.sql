-- Shareable invite links. Admins mint a link, share it; anyone with the
-- link can self-add their email to allowed_emails (with the link's role).

create table if not exists public.invite_links (
  id uuid primary key default gen_random_uuid(),
  role text not null default 'staff' check (role in ('admin', 'staff')),
  active boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  created_by text
);

alter table public.invite_links enable row level security;

drop policy if exists "invite_links_read_any" on public.invite_links;
create policy "invite_links_read_any" on public.invite_links
  for select using (true);

drop policy if exists "invite_links_admin_write" on public.invite_links;
create policy "invite_links_admin_insert" on public.invite_links
  for insert with check (public.is_admin());
create policy "invite_links_admin_update" on public.invite_links
  for update using (public.is_admin()) with check (public.is_admin());
create policy "invite_links_admin_delete" on public.invite_links
  for delete using (public.is_admin());

-- Accept a join request: validates link, upserts allowed_emails.
-- SECURITY DEFINER so anonymous callers can add themselves without being
-- able to touch allowed_emails directly.
create or replace function public.redeem_invite(link_id uuid, user_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  link public.invite_links%rowtype;
begin
  if user_email is null or length(trim(user_email)) = 0 then
    raise exception 'email required';
  end if;

  select * into link from public.invite_links where id = link_id;
  if not found or link.active = false then
    raise exception 'This invite link is no longer active.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.allowed_emails (email, role, created_by)
  values (lower(trim(user_email)), link.role, 'invite:' || link_id::text)
  on conflict (email) do nothing;
end;
$$;

grant execute on function public.redeem_invite(uuid, text) to anon, authenticated;
