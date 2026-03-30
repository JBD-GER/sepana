alter table if exists public.case_children
  add column if not exists child_benefit boolean,
  add column if not exists maintenance_income_present boolean,
  add column if not exists applicant_scope text;
