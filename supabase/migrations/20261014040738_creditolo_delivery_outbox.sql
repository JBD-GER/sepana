create table public.creditolo_deliveries (
  case_id uuid primary key references public.cases(id) on delete cascade,
  variant text not null check (variant in ('standard','schufa_free')),
  status text not null default 'awaiting_data' check (status in ('awaiting_data','pending','sending','delivered','failed','unknown','test_ok')),
  payload jsonb,
  consent_version text,
  consent_at timestamptz,
  schufa_consent boolean not null default false,
  response_code integer,
  client_id text,
  login_url text,
  last_error text,
  lock_token uuid,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creditolo_consent_required check (status='awaiting_data' or consent_at is not null)
);
alter table public.creditolo_deliveries enable row level security;
revoke all on public.creditolo_deliveries from anon, authenticated;
grant all on public.creditolo_deliveries to service_role;
create index creditolo_pending_idx on public.creditolo_deliveries(updated_at) where status='pending';
