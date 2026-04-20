-- Row-based flagging: each row is an item + status (out / low / emergency)
-- plus an optional quantity when status = 'low'.

alter table public.oos_reports
  add column if not exists status_kind text
    check (status_kind in ('out', 'low', 'emergency'));

alter table public.oos_reports
  add column if not exists qty_left integer check (qty_left >= 0);

-- Backfill existing rows from legacy fields so the list view keeps working.
update public.oos_reports
set status_kind = case
  when is_emergency then 'emergency'
  when days_left = 0 then 'out'
  when days_left is not null then 'low'
  else 'low'
end
where status_kind is null;

create index if not exists oos_reports_status_kind_idx
  on public.oos_reports (status_kind, status);
