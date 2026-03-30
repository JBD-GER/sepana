begin;

create table if not exists public.case_europace (
  case_id uuid primary key references public.cases (id) on delete cascade,
  vorgangsnummer text unique,
  datenkontext text,
  kundenbetreuer_partner_id text,
  bearbeiter_partner_id text,
  leadquelle text,
  annahme_job_id text,
  antragsnummer text,
  produktanbieterantragsnummer text,
  letzte_aenderung_am timestamptz,
  letztes_ereignis_am timestamptz,
  last_sync_at timestamptz,
  sync_status text not null default 'pending',
  last_error text,
  last_import_payload jsonb,
  last_export_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_europace_sync_status_check'
      and conrelid = 'public.case_europace'::regclass
  ) then
    alter table public.case_europace
      add constraint case_europace_sync_status_check
      check (
        sync_status in ('pending', 'imported', 'synced', 'error')
      );
  end if;
end $$;

create index if not exists idx_case_europace_vorgangsnummer
  on public.case_europace (vorgangsnummer);

create index if not exists idx_case_europace_sync_status
  on public.case_europace (sync_status);

create table if not exists public.case_europace_applicants (
  case_id uuid not null references public.cases (id) on delete cascade,
  case_applicant_id uuid not null references public.case_applicants (id) on delete cascade,
  antragsteller_nummer smallint not null,
  europace_antragsteller_id text not null,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (case_id, case_applicant_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_europace_applicants_antragsteller_nummer_check'
      and conrelid = 'public.case_europace_applicants'::regclass
  ) then
    alter table public.case_europace_applicants
      add constraint case_europace_applicants_antragsteller_nummer_check
      check (antragsteller_nummer in (1, 2));
  end if;
end $$;

create unique index if not exists idx_case_europace_applicants_case_nummer
  on public.case_europace_applicants (case_id, antragsteller_nummer);

create unique index if not exists idx_case_europace_applicants_case_external
  on public.case_europace_applicants (case_id, europace_antragsteller_id);

create table if not exists public.case_europace_offers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  angebot_id text not null,
  angebot_snapshot jsonb not null default '{}'::jsonb,
  machbarkeit_status text,
  vollstaendigkeit_status text,
  vertriebskanal text,
  calculated_at timestamptz,
  accepted_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_case_europace_offers_case_angebot
  on public.case_europace_offers (case_id, angebot_id);

create index if not exists idx_case_europace_offers_case_created
  on public.case_europace_offers (case_id, created_at desc);

create table if not exists public.case_europace_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  local_document_id uuid references public.documents (id) on delete set null,
  europace_document_id text,
  antragsnummer text,
  category text,
  assignment_id text,
  release_status text,
  upload_status text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_case_europace_documents_case_created
  on public.case_europace_documents (case_id, created_at desc);

create index if not exists idx_case_europace_documents_external
  on public.case_europace_documents (europace_document_id);

create table if not exists public.case_europace_sync_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.cases (id) on delete cascade,
  direction text not null,
  operation text not null,
  request_payload jsonb,
  response_payload jsonb,
  success boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_europace_sync_events_direction_check'
      and conrelid = 'public.case_europace_sync_events'::regclass
  ) then
    alter table public.case_europace_sync_events
      add constraint case_europace_sync_events_direction_check
      check (direction in ('outbound', 'inbound'));
  end if;
end $$;

create index if not exists idx_case_europace_sync_events_case_created
  on public.case_europace_sync_events (case_id, created_at desc);

commit;
