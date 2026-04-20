-- Split the list into two queues: owner (Bob) and manager.
-- Groceries/alcohol default to the owner, everything else to manager.
-- Supplier lets us group shopping lists by origin (Costco, JFC, Walmart, etc.)

alter table public.oos_reports
  add column if not exists destination text not null default 'owner'
    check (destination in ('owner', 'manager'));

alter table public.catalog_items
  add column if not exists destination text not null default 'owner'
    check (destination in ('owner', 'manager'));

alter table public.catalog_items
  add column if not exists supplier text;

create index if not exists oos_reports_destination_idx
  on public.oos_reports (destination, status);

create index if not exists catalog_items_destination_supplier_idx
  on public.catalog_items (destination, supplier);
