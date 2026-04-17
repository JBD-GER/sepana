begin;

alter table public.case_schufa_free_details
  add column if not exists tax_child numeric(6,2);

commit;
