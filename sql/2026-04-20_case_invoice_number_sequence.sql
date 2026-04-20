begin;

create sequence if not exists public.case_invoice_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1;

with ordered as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as seq
  from public.case_invoices
)
update public.case_invoices as invoices
set invoice_number = ordered.seq::text
from ordered
where invoices.id = ordered.id
  and invoices.invoice_number is distinct from ordered.seq::text;

select setval(
  'public.case_invoice_number_seq',
  coalesce(
    (select max(invoice_number::bigint) from public.case_invoices where invoice_number ~ '^[0-9]+$'),
    1
  ),
  coalesce((select count(*) > 0 from public.case_invoices), false)
);

alter table public.case_invoices
  alter column invoice_number set default nextval('public.case_invoice_number_seq')::text;

create unique index if not exists idx_case_invoices_invoice_number_unique
  on public.case_invoices (invoice_number);

commit;
