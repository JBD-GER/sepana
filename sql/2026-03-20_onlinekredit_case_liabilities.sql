begin;

create table if not exists public.case_liabilities (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  liability_type text not null,
  applicant_scope text,
  creditor text,
  monthly_rate numeric,
  final_installment numeric,
  last_rate_date date,
  current_balance numeric,
  original_amount numeric,
  first_payment_date date,
  utilized_amount numeric,
  credit_limit numeric,
  interest_rate numeric,
  refinance boolean,
  iban text,
  bic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_liabilities_type_check'
      and conrelid = 'public.case_liabilities'::regclass
  ) then
    alter table public.case_liabilities
      add constraint case_liabilities_type_check
      check (
        liability_type in (
          'ratenkredit',
          'dispositionskredit',
          'kreditkarte',
          'privates_leasing',
          'sonstige_verbindlichkeit'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_liabilities_applicant_scope_check'
      and conrelid = 'public.case_liabilities'::regclass
  ) then
    alter table public.case_liabilities
      add constraint case_liabilities_applicant_scope_check
      check (
        applicant_scope is null
        or applicant_scope in ('primary', 'co', 'both')
      );
  end if;
end $$;

create index if not exists idx_case_liabilities_case_created
  on public.case_liabilities (case_id, created_at asc);

alter table if exists public.case_liabilities enable row level security;

drop policy if exists case_liabilities_select on public.case_liabilities;
create policy case_liabilities_select
on public.case_liabilities
for select
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_liabilities_insert on public.case_liabilities;
create policy case_liabilities_insert
on public.case_liabilities
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_liabilities_update on public.case_liabilities;
create policy case_liabilities_update
on public.case_liabilities
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

drop policy if exists case_liabilities_delete on public.case_liabilities;
create policy case_liabilities_delete
on public.case_liabilities
for delete
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

commit;
