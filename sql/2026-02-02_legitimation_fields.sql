-- Legitimation and nationality fields for customer/advisor flows
-- Date: 2026-02-02

alter table if exists public.case_additional_details
  add column if not exists id_document_number text,
  add column if not exists id_issued_place text,
  add column if not exists id_issued_at date,
  add column if not exists id_expires_at date;

alter table if exists public.case_applicants
  add column if not exists nationality text;

-- Optional consistency check: expiry date should not be before issue date.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_additional_details_id_date_check'
  ) then
    alter table public.case_additional_details
      add constraint case_additional_details_id_date_check
      check (
        id_issued_at is null
        or id_expires_at is null
        or id_expires_at >= id_issued_at
      );
  end if;
end $$;
