begin;

drop index if exists public.idx_case_invoices_case_type_unique;

create index if not exists idx_case_invoices_case_type_created_at
  on public.case_invoices (case_id, invoice_type, created_at desc);

commit;
