-- Collapse to two categories: grocery (was food/drink) and alcohol.

update public.oos_reports
set category = 'grocery'
where category in ('food', 'drink');

alter table public.oos_reports
  drop constraint if exists oos_reports_category_check;

alter table public.oos_reports
  add constraint oos_reports_category_check
  check (category in ('grocery', 'alcohol'));
