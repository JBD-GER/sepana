begin;

alter table public.case_schufa_free_details
  add column if not exists ratenschutz_opt_in boolean not null default false,
  add column if not exists ratenschutz_opt_in_at timestamptz;

commit;
