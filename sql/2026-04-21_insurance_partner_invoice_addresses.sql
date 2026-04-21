begin;

alter table if exists public.insurance_partner_profiles
  add column if not exists street text,
  add column if not exists zipcode text,
  add column if not exists city text;

alter table if exists public.case_invoices
  add column if not exists recipient_street text,
  add column if not exists recipient_zipcode text,
  add column if not exists recipient_city text;

commit;
