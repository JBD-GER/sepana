alter table if exists public.case_additional_details
  add column if not exists has_children boolean,
  add column if not exists maintenance_income_monthly numeric;
