begin;

create table if not exists public.case_real_estate_assets (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  applicant_scope text,
  property_type text,
  description text,
  value_amount numeric,
  living_space_sqm integer,
  usage_type text,
  rented_living_space_sqm integer,
  rent_income_cold_monthly numeric,
  rent_income_warm_monthly numeric,
  ancillary_costs_monthly numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_real_estate_assets_applicant_scope_check'
      and conrelid = 'public.case_real_estate_assets'::regclass
  ) then
    alter table public.case_real_estate_assets
      add constraint case_real_estate_assets_applicant_scope_check
      check (
        applicant_scope is null
        or applicant_scope in ('primary', 'co', 'both')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_real_estate_assets_property_type_check'
      and conrelid = 'public.case_real_estate_assets'::regclass
  ) then
    alter table public.case_real_estate_assets
      add constraint case_real_estate_assets_property_type_check
      check (
        property_type is null
        or property_type in (
          'eigentumswohnung',
          'einfamilienhaus',
          'mehrfamilienhaus',
          'buerogebaeude'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_real_estate_assets_usage_type_check'
      and conrelid = 'public.case_real_estate_assets'::regclass
  ) then
    alter table public.case_real_estate_assets
      add constraint case_real_estate_assets_usage_type_check
      check (
        usage_type is null
        or usage_type in (
          'eigengenutzt',
          'vermietet',
          'beides'
        )
      );
  end if;
end $$;

create index if not exists idx_case_real_estate_assets_case_created
  on public.case_real_estate_assets (case_id, created_at asc);

create table if not exists public.case_real_estate_loans (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.case_real_estate_assets (id) on delete cascade,
  remaining_debt numeric,
  interest_fixed_until date,
  monthly_rate numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_case_real_estate_loans_asset_created
  on public.case_real_estate_loans (asset_id, created_at asc);

alter table if exists public.case_real_estate_assets enable row level security;
alter table if exists public.case_real_estate_loans enable row level security;

drop policy if exists case_real_estate_assets_select on public.case_real_estate_assets;
create policy case_real_estate_assets_select
on public.case_real_estate_assets
for select
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_real_estate_assets_insert on public.case_real_estate_assets;
create policy case_real_estate_assets_insert
on public.case_real_estate_assets
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_real_estate_assets_update on public.case_real_estate_assets;
create policy case_real_estate_assets_update
on public.case_real_estate_assets
for update
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
)
with check (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_real_estate_assets_delete on public.case_real_estate_assets;
create policy case_real_estate_assets_delete
on public.case_real_estate_assets
for delete
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_real_estate_loans_select on public.case_real_estate_loans;
create policy case_real_estate_loans_select
on public.case_real_estate_loans
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.case_real_estate_assets assets
    where assets.id = asset_id
      and (
        public.is_case_customer(assets.case_id)
        or public.is_case_advisor(assets.case_id)
      )
  )
);

drop policy if exists case_real_estate_loans_insert on public.case_real_estate_loans;
create policy case_real_estate_loans_insert
on public.case_real_estate_loans
for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1
    from public.case_real_estate_assets assets
    where assets.id = asset_id
      and (
        public.is_case_customer(assets.case_id)
        or public.is_case_advisor(assets.case_id)
      )
  )
);

drop policy if exists case_real_estate_loans_update on public.case_real_estate_loans;
create policy case_real_estate_loans_update
on public.case_real_estate_loans
for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.case_real_estate_assets assets
    where assets.id = asset_id
      and (
        public.is_case_customer(assets.case_id)
        or public.is_case_advisor(assets.case_id)
      )
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.case_real_estate_assets assets
    where assets.id = asset_id
      and (
        public.is_case_customer(assets.case_id)
        or public.is_case_advisor(assets.case_id)
      )
  )
);

drop policy if exists case_real_estate_loans_delete on public.case_real_estate_loans;
create policy case_real_estate_loans_delete
on public.case_real_estate_loans
for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.case_real_estate_assets assets
    where assets.id = asset_id
      and (
        public.is_case_customer(assets.case_id)
        or public.is_case_advisor(assets.case_id)
      )
  )
);

commit;
