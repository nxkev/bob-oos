-- Run this in the Supabase SQL editor for a fresh project.

create extension if not exists "pgcrypto";

create table if not exists public.oos_reports (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  category text not null check (category in ('grocery', 'alcohol')),
  days_left int not null check (days_left >= 0),
  is_emergency boolean not null default false,
  note text,
  submitted_by text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists oos_reports_open_idx
  on public.oos_reports (status, is_emergency desc, days_left asc, created_at asc);

alter table public.oos_reports enable row level security;

-- MVP: anyone with the anon key can read, insert, and mark resolved.
-- Tighten with auth later.
drop policy if exists "oos_select_all" on public.oos_reports;
create policy "oos_select_all" on public.oos_reports
  for select using (true);

drop policy if exists "oos_insert_all" on public.oos_reports;
create policy "oos_insert_all" on public.oos_reports
  for insert with check (true);

drop policy if exists "oos_update_all" on public.oos_reports;
create policy "oos_update_all" on public.oos_reports
  for update using (true) with check (true);
