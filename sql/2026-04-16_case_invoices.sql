begin;

create table if not exists public.case_invoices (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  case_type text not null,
  invoice_type text not null,
  invoice_number text not null,
  title text not null,
  description text,
  status text not null default 'sent',
  loan_amount numeric(12,2),
  percentage_rate numeric(8,4),
  amount_total numeric(12,2) not null,
  currency text not null default 'EUR',
  recipient_name text,
  recipient_email text,
  sent_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_invoices_status_check check (status in ('sent', 'paid', 'refunded', 'cancelled'))
);

create unique index if not exists idx_case_invoices_case_type_unique
  on public.case_invoices (case_id, invoice_type);

create index if not exists idx_case_invoices_created_at
  on public.case_invoices (created_at desc);

create index if not exists idx_case_invoices_status
  on public.case_invoices (status);

commit;
