-- Add advisor case ref + manual lead fields
-- Run once in Supabase SQL editor (or as migration).

begin;

alter table public.cases
  add column if not exists advisor_case_ref text,
  add column if not exists advisor_status text;

alter table public.cases
  alter column advisor_status set default 'neu';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_advisor_status_check'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
      add constraint cases_advisor_status_check
      check (
        advisor_status is null
        or advisor_status in (
          'neu',
          'kontaktaufnahme',
          'terminiert',
          'angebot',
          'nachfrage',
          'abgelehnt',
          'abgeschlossen'
        )
      );
  end if;
end $$;

update public.cases
  set advisor_status = 'abgeschlossen'
  where advisor_status is null
    and status = 'closed';

update public.cases
  set advisor_status = 'neu'
  where advisor_status is null
    and status is distinct from 'closed';

create sequence if not exists public.webhook_leads_external_id_seq;

alter table public.webhook_leads
  alter column external_lead_id set default nextval('public.webhook_leads_external_id_seq'::regclass);

alter table public.webhook_leads
  add column if not exists employment_type text,
  add column if not exists net_income_monthly numeric,
  add column if not exists loan_purpose text,
  add column if not exists loan_amount_total numeric,
  add column if not exists property_zip text,
  add column if not exists property_city text,
  add column if not exists property_type text,
  add column if not exists property_purchase_price numeric;

alter table public.case_signature_requests
  add column if not exists customer_notified_at timestamptz;

commit;
