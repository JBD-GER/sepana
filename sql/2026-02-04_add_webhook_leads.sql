-- Inbox for external webhook leads, isolated from core case flow.
-- Run once in Supabase SQL editor.

begin;

create table if not exists public.webhook_leads (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'mustermann',
  external_lead_id bigint not null,
  event_type text not null default 'lead.new' check (event_type in ('lead.new', 'lead.complaint')),
  status text not null default 'new' check (status in ('new', 'complaint_accepted', 'complaint_declined')),
  complaint_reason text,
  source_created_at timestamptz,
  first_name text,
  last_name text,
  email text,
  phone text,
  phone_mobile text,
  phone_work text,
  birth_date date,
  title text,
  marital_status text,
  employment_status text,
  address_street text,
  address_zip text,
  address_city text,
  product_name text,
  product_price numeric,
  notes text,
  additional jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  assigned_advisor_id uuid references auth.users(id),
  assigned_at timestamptz,
  linked_case_id uuid references public.cases(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  unique (source, external_lead_id)
);

create index if not exists idx_webhook_leads_created_at on public.webhook_leads (created_at desc);
create index if not exists idx_webhook_leads_status on public.webhook_leads (status);
create index if not exists idx_webhook_leads_assigned_advisor on public.webhook_leads (assigned_advisor_id);

create or replace function public.touch_webhook_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_webhook_leads_updated_at on public.webhook_leads;
create trigger trg_webhook_leads_updated_at
before update on public.webhook_leads
for each row
execute function public.touch_webhook_leads_updated_at();

alter table public.webhook_leads enable row level security;

commit;
