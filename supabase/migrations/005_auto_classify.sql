-- Auto-classify: when a staff flag comes in, try to match an existing
-- catalog item by case-insensitive name. If found, inherit destination + link.
-- Over time the catalog becomes the source of truth for routing, and staff
-- never have to pick where their flag goes.

create or replace function public.match_report_to_catalog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  match public.catalog_items%rowtype;
begin
  if new.catalog_item_id is not null then
    return new;
  end if;

  select * into match
  from public.catalog_items
  where lower(name) = lower(new.item)
  limit 1;

  if found then
    new.catalog_item_id := match.id;
    new.destination := match.destination;
  end if;

  return new;
end;
$$;

drop trigger if exists match_report_to_catalog on public.oos_reports;
create trigger match_report_to_catalog
  before insert on public.oos_reports
  for each row execute function public.match_report_to_catalog();
