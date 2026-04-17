begin;

alter table public.webhook_leads
  add column if not exists lead_case_type text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'webhook_leads_lead_case_type_check'
      and conrelid = 'public.webhook_leads'::regclass
  ) then
    alter table public.webhook_leads
      drop constraint webhook_leads_lead_case_type_check;
  end if;

  alter table public.webhook_leads
    add constraint webhook_leads_lead_case_type_check
    check (
      lead_case_type is null
      or lead_case_type in ('baufi', 'konsum', 'schufa_frei')
    );
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cases_case_type_check'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
      drop constraint cases_case_type_check;
  end if;

  alter table public.cases
    add constraint cases_case_type_check
    check (case_type in ('baufi', 'konsum', 'schufa_frei'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cases_status_allowed'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
      drop constraint cases_status_allowed;
  end if;

  alter table public.cases
    add constraint cases_status_allowed
    check (
      status in (
        'new',
        'draft',
        'open',
        'active',
        'submitted',
        'received',
        'in_review',
        'under_review',
        'processing',
        'needs_docs',
        'missing_docs',
        'waiting_customer',
        'waiting_advisor',
        'matching',
        'comparison_ready',
        'prequalified',
        'skag_submitted',
        'documents_requested',
        'correction_required',
        'offers_ready',
        'offer_created',
        'offer_open',
        'offer_sent',
        'offer_accepted',
        'offer_rejected',
        'approved',
        'rejected',
        'cancelled',
        'closed',
        'completed'
      )
    );
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'case_offers_product_type_check'
      and conrelid = 'public.case_offers'::regclass
  ) then
    alter table public.case_offers
      drop constraint case_offers_product_type_check;
  end if;

  alter table public.case_offers
    add constraint case_offers_product_type_check
    check (product_type in ('baufi', 'konsum', 'schufa_frei'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'document_templates_case_type_check'
      and conrelid = 'public.document_templates'::regclass
  ) then
    alter table public.document_templates
      drop constraint document_templates_case_type_check;
  end if;

  alter table public.document_templates
    add constraint document_templates_case_type_check
    check (case_type in ('baufi', 'konsum', 'schufa_frei'));
end $$;

create table if not exists public.case_schufa_free_details (
  case_id uuid primary key references public.cases(id) on delete cascade,
  loan_amount_requested integer,
  term_months integer,
  precheck_variant text,
  precheck_passed boolean default false,
  precheck_reason text,
  minimum_income_required numeric(12,2),
  nationality_group text,
  sigma_existing_customer boolean default false,
  employment_mode text,
  employment_months_current integer,
  net_income_monthly numeric(12,2),
  dependent_children_count integer,
  children_ages_csv text,
  gender integer,
  birth_name text,
  date_of_birth date,
  place_of_birth text,
  nationality text,
  family_situation integer,
  tax_child numeric(6,2),
  street text,
  house_number text,
  zipcode text,
  city text,
  phone_primary text,
  phone_secondary text,
  email text,
  residence_type integer,
  rent_monthly numeric(12,2),
  resident_since date,
  tax_class integer,
  profession integer,
  profession_begin_date date,
  employer_name text,
  employer_street text,
  employer_house text,
  employer_zipcode text,
  employer_city text,
  employer_phone text,
  employer_email text,
  additional_income_monthly numeric(12,2),
  additional_income_begin_date date,
  employment_relationship_limited boolean default false,
  wage_garnishment_assignment boolean default false,
  bank_name text,
  iban text,
  spouse_first_name text,
  spouse_birth_date date,
  spouse_birth_name text,
  spouse_income_monthly numeric(12,2),
  completed_application_at timestamptz,
  submitted_to_skag_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_skag_sync (
  case_id uuid primary key references public.cases(id) on delete cascade,
  api_variant text not null default 'standard',
  skag_client_id text,
  skag_credit_id text,
  last_submit_at timestamptz,
  last_document_upload_at timestamptz,
  last_push_at timestamptz,
  last_status_alias text,
  last_status_description text,
  last_error text,
  raw_last_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_case_skag_sync_credit_id
  on public.case_skag_sync (skag_credit_id)
  where skag_credit_id is not null;

create unique index if not exists idx_case_skag_sync_client_id
  on public.case_skag_sync (skag_client_id)
  where skag_client_id is not null;

create table if not exists public.case_skag_push_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete set null,
  skag_credit_id text,
  status_alias text,
  status_description text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_skag_push_events_case_created
  on public.case_skag_push_events (case_id, created_at desc);

create table if not exists public.case_skag_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  local_document_id uuid not null references public.documents(id) on delete cascade,
  skag_credit_id text,
  file_name text,
  upload_status text not null default 'pending',
  uploaded_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_case_skag_documents_local_document
  on public.case_skag_documents (local_document_id);

do $$
declare
  has_template_key boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_templates'
      and column_name = 'template_key'
  )
  into has_template_key;

  if has_template_key then
    with desired(template_key, case_type, title, required, sort_order, is_active) as (
      values
        ('schufa_id_passport', 'schufa_frei', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('schufa_registration_certificate', 'schufa_frei', 'Meldebescheinigung', true, 20, true),
        ('schufa_salary_slips_3', 'schufa_frei', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('schufa_bank_statements_salary_3m', 'schufa_frei', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true),
        ('schufa_iban_proof', 'schufa_frei', 'IBAN-Nachweis / EC-Karte', true, 50, true),
        ('schufa_additional_documents', 'schufa_frei', 'Weitere Unterlagen laut Pruefung', false, 90, true)
    )
    insert into public.document_templates (template_key, case_type, title, required, sort_order, is_active)
    select d.template_key, d.case_type, d.title, d.required, d.sort_order, d.is_active
    from desired d
    where not exists (
      select 1
      from public.document_templates t
      where t.case_type = d.case_type
        and t.template_key = d.template_key
    );
  else
    with desired(case_type, title, required, sort_order, is_active) as (
      values
        ('schufa_frei', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('schufa_frei', 'Meldebescheinigung', true, 20, true),
        ('schufa_frei', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('schufa_frei', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true),
        ('schufa_frei', 'IBAN-Nachweis / EC-Karte', true, 50, true),
        ('schufa_frei', 'Weitere Unterlagen laut Pruefung', false, 90, true)
    )
    insert into public.document_templates (case_type, title, required, sort_order, is_active)
    select d.case_type, d.title, d.required, d.sort_order, d.is_active
    from desired d
    where not exists (
      select 1
      from public.document_templates t
      where t.case_type = d.case_type
        and t.title = d.title
    );
  end if;
end $$;

commit;
