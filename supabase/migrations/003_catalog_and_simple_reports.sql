-- Simpler model per latest direction:
--   * Staff submit free-text entries: what's missing or low.
--   * Manager maintains a catalog of known items (the shopping list master).
--   * Manager can promote a staff entry → catalog item (links them).

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'grocery' check (category in ('grocery', 'alcohol')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text
);

create unique index if not exists catalog_items_name_unique
  on public.catalog_items (lower(name));

alter table public.catalog_items enable row level security;

drop policy if exists "catalog_read_auth" on public.catalog_items;
create policy "catalog_read_auth" on public.catalog_items
  for select using (auth.uid() is not null);

drop policy if exists "catalog_write_auth" on public.catalog_items;
create policy "catalog_write_auth" on public.catalog_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Staff reports: loosen to free-form. Keep old columns for back-compat but
-- relax their NOT NULLs so the new free-text path just populates `item` + `note`.
alter table public.oos_reports
  alter column category drop not null,
  alter column days_left drop not null;

alter table public.oos_reports
  add column if not exists catalog_item_id uuid references public.catalog_items(id) on delete set null;

create index if not exists oos_reports_catalog_idx
  on public.oos_reports (catalog_item_id);
