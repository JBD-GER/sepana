begin;

create table if not exists public.case_financial_analysis_services (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  service_status text not null default 'offered',
  analysis_status text not null default 'not_started',
  offered_by uuid,
  assigned_advisor_id uuid,
  price_gross_cents integer not null default 24900,
  currency text not null default 'EUR',
  service_duration_days integer not null default 90,
  offer_title text not null default 'Persoenliche Finanzanalyse',
  offer_summary text,
  terms_version text not null default 'financial_analysis_2026_04_23_v1',
  customer_confirmed_terms_version text,
  offer_email_sent_at timestamptz,
  customer_confirmed_at timestamptz,
  payment_received_at timestamptz,
  activated_at timestamptz,
  access_expires_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  published_household_overview text,
  published_recommendations text,
  published_action_plan text,
  published_schufa_notes text,
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_financial_analysis_services_status_check check (
    service_status in ('offered', 'customer_confirmed', 'payment_received', 'active', 'expired', 'cancelled')
  ),
  constraint case_financial_analysis_services_analysis_status_check check (
    analysis_status in ('not_started', 'documents_received', 'in_review', 'published')
  ),
  constraint case_financial_analysis_services_price_check check (price_gross_cents > 0),
  constraint case_financial_analysis_services_duration_check check (service_duration_days > 0),
  constraint case_financial_analysis_services_currency_check check (currency = 'EUR')
);

create index if not exists case_financial_analysis_services_case_created_idx
  on public.case_financial_analysis_services (case_id, created_at desc);

create index if not exists case_financial_analysis_services_status_idx
  on public.case_financial_analysis_services (service_status, access_expires_at);

create table if not exists public.case_financial_analysis_documents (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.case_financial_analysis_services(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  document_kind text not null,
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  processing_status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_financial_analysis_documents_kind_check check (
    document_kind in ('bank_statement', 'schufa_report', 'supporting_document')
  ),
  constraint case_financial_analysis_documents_processing_status_check check (
    processing_status in ('uploaded', 'processing', 'processed', 'error')
  )
);

create index if not exists case_financial_analysis_documents_service_created_idx
  on public.case_financial_analysis_documents (service_id, created_at desc);

create index if not exists case_financial_analysis_documents_case_created_idx
  on public.case_financial_analysis_documents (case_id, created_at desc);

alter table public.case_financial_analysis_services enable row level security;
alter table public.case_financial_analysis_documents enable row level security;

drop policy if exists case_financial_analysis_services_select on public.case_financial_analysis_services;
create policy case_financial_analysis_services_select
on public.case_financial_analysis_services
for select
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_financial_analysis_services_insert on public.case_financial_analysis_services;
create policy case_financial_analysis_services_insert
on public.case_financial_analysis_services
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_case_advisor(case_id)
);

drop policy if exists case_financial_analysis_services_update on public.case_financial_analysis_services;
create policy case_financial_analysis_services_update
on public.case_financial_analysis_services
for update
to authenticated
using (
  public.is_admin()
  or public.is_case_advisor(case_id)
)
with check (
  public.is_admin()
  or public.is_case_advisor(case_id)
);

drop policy if exists case_financial_analysis_documents_select on public.case_financial_analysis_documents;
create policy case_financial_analysis_documents_select
on public.case_financial_analysis_documents
for select
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_financial_analysis_documents_insert on public.case_financial_analysis_documents;
create policy case_financial_analysis_documents_insert
on public.case_financial_analysis_documents
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_financial_analysis_documents_update on public.case_financial_analysis_documents;
create policy case_financial_analysis_documents_update
on public.case_financial_analysis_documents
for update
to authenticated
using (
  public.is_admin()
  or public.is_case_advisor(case_id)
)
with check (
  public.is_admin()
  or public.is_case_advisor(case_id)
);

commit;
