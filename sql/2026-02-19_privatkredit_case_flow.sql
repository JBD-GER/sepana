-- Privatkredit case-flow baseline:
-- - explicit lead_case_type on webhook_leads
-- - indexes for product-tab filtering
-- - keep document requests in sync: konsum uses same templates as baufi

begin;

alter table public.webhook_leads
  add column if not exists lead_case_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'webhook_leads_lead_case_type_check'
      and conrelid = 'public.webhook_leads'::regclass
  ) then
    alter table public.webhook_leads
      add constraint webhook_leads_lead_case_type_check
      check (
        lead_case_type is null
        or lead_case_type in ('baufi', 'konsum')
      );
  end if;
end $$;

update public.webhook_leads
set lead_case_type = case
  when lower(coalesce(product_name, '')) like '%privatkredit%' then 'konsum'
  when lower(coalesce(product_name, '')) like '%ratenkredit%' then 'konsum'
  when lower(coalesce(product_name, '')) like '%konsum%' then 'konsum'
  when lower(coalesce(product_name, '')) like '%baufinanzierung%' then 'baufi'
  when lower(coalesce(product_name, '')) like '%baufi%' then 'baufi'
  when lower(coalesce(product_name, '')) like '%immobil%' then 'baufi'
  when lower(coalesce(product_name, '')) like '%darlehen%' then 'baufi'
  else null
end
where lead_case_type is null;

create index if not exists idx_webhook_leads_case_type
  on public.webhook_leads (lead_case_type);

create index if not exists idx_webhook_leads_case_type_assigned_created
  on public.webhook_leads (lead_case_type, assigned_advisor_id, created_at desc);

create index if not exists idx_cases_assigned_case_type_created
  on public.cases (assigned_advisor_id, case_type, created_at desc);

create index if not exists idx_cases_customer_case_type_created
  on public.cases (customer_id, case_type, created_at desc);

update public.cases
set case_type = 'baufi'
where case_type is null
   or trim(case_type) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_case_type_check'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
      add constraint cases_case_type_check
      check (case_type in ('baufi', 'konsum'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_offers_product_type_check'
      and conrelid = 'public.case_offers'::regclass
  ) then
    alter table public.case_offers
      add constraint case_offers_product_type_check
      check (product_type in ('baufi', 'konsum'));
  end if;
end $$;

create index if not exists idx_case_offers_case_product_created
  on public.case_offers (case_id, product_type, created_at desc);

insert into public.document_templates (case_type, title, required, sort_order, is_active)
select
  'konsum' as case_type,
  t.title,
  t.required,
  t.sort_order,
  t.is_active
from public.document_templates t
where t.case_type = 'baufi'
  and not exists (
    select 1
    from public.document_templates existing
    where existing.case_type = 'konsum'
      and existing.title = t.title
  );

commit;
