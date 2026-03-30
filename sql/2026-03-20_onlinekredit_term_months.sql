alter table if exists public.case_baufi_details
  add column if not exists term_months integer;
