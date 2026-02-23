begin;

-- ---------------------------------------------------------------------------
-- Profiles role support (add "tipgeber")
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', r.conname);
  end loop;

  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('customer', 'advisor', 'admin', 'tipgeber'));
exception
  when undefined_table then
    null;
end $$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role::text
      from public.profiles p
      where p.user_id = auth.uid()
      limit 1
    ),
    'customer'
  );
$$;

revoke all on function public.get_my_role() from public;
grant execute on function public.get_my_role() to anon, authenticated, service_role;

create or replace function public.is_tippgeber()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.get_my_role() = 'tipgeber';
$$;

revoke all on function public.is_tippgeber() from public;
grant execute on function public.is_tippgeber() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tippgeber profiles
-- ---------------------------------------------------------------------------

create table if not exists public.tippgeber_profiles (
  user_id uuid primary key,
  company_name text not null,
  address_street text not null,
  address_house_number text not null,
  address_zip text not null,
  address_city text not null,
  phone text,
  email text,
  logo_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tippgeber_profiles_company_name_idx on public.tippgeber_profiles (company_name);
create index if not exists tippgeber_profiles_is_active_idx on public.tippgeber_profiles (is_active);

-- ---------------------------------------------------------------------------
-- Tippgeber referrals (Tips)
-- ---------------------------------------------------------------------------

create table if not exists public.tippgeber_referrals (
  id uuid primary key default gen_random_uuid(),
  tippgeber_user_id uuid not null,
  status text not null default 'new',

  customer_first_name text not null,
  customer_last_name text not null,
  customer_email text not null,
  customer_phone text not null,

  expose_file_path text,
  expose_file_name text,
  expose_mime_type text,
  expose_size_bytes bigint,

  manual_purchase_price numeric(14,2),
  manual_broker_commission_percent numeric(8,4) not null default 0,
  property_street text,
  property_house_number text,
  property_zip text,
  property_city text,

  assigned_advisor_id uuid,
  assigned_at timestamptz,
  linked_lead_id uuid,
  linked_case_id uuid,
  linked_offer_id uuid,

  bank_outcome text,
  bank_decided_at timestamptz,

  commission_status text not null default 'none',
  commission_base_amount numeric(14,2),
  commission_percent_rate numeric(10,6),
  commission_fixed_net_amount numeric(14,2),
  commission_net_amount numeric(14,2),
  commission_vat_rate numeric(6,4),
  commission_vat_amount numeric(14,2),
  commission_gross_amount numeric(14,2),
  commission_reason text,
  commission_calculated_at timestamptz,

  payout_credit_note_path text,
  payout_credit_note_file_name text,
  payout_credit_note_mime_type text,
  payout_credit_note_size_bytes bigint,
  payout_credit_note_uploaded_at timestamptz,
  payout_released_at timestamptz,

  admin_internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tippgeber_referrals_status_check check (
    status in ('new', 'assigned', 'case_created', 'bank_declined', 'bank_approved', 'commission_open', 'paid')
  ),
  constraint tippgeber_referrals_bank_outcome_check check (
    bank_outcome is null or bank_outcome in ('approved', 'declined')
  ),
  constraint tippgeber_referrals_commission_status_check check (
    commission_status in ('none', 'open', 'paid')
  )
);

create index if not exists tippgeber_referrals_tippgeber_user_id_idx on public.tippgeber_referrals (tippgeber_user_id);
create index if not exists tippgeber_referrals_created_at_idx on public.tippgeber_referrals (created_at desc);
create index if not exists tippgeber_referrals_assigned_advisor_id_idx on public.tippgeber_referrals (assigned_advisor_id);
create index if not exists tippgeber_referrals_linked_case_id_idx on public.tippgeber_referrals (linked_case_id);
create index if not exists tippgeber_referrals_linked_lead_id_idx on public.tippgeber_referrals (linked_lead_id);
create index if not exists tippgeber_referrals_commission_status_idx on public.tippgeber_referrals (commission_status);
create index if not exists tippgeber_referrals_bank_outcome_idx on public.tippgeber_referrals (bank_outcome);

-- Optional foreign keys (only if tables exist)
do $$
begin
  if to_regclass('public.cases') is not null then
    begin
      alter table public.tippgeber_referrals
        add constraint tippgeber_referrals_linked_case_fk
        foreign key (linked_case_id) references public.cases(id) on delete set null;
    exception when duplicate_object then null;
    end;
  end if;

  if to_regclass('public.webhook_leads') is not null then
    begin
      alter table public.tippgeber_referrals
        add constraint tippgeber_referrals_linked_lead_fk
        foreign key (linked_lead_id) references public.webhook_leads(id) on delete set null;
    exception when duplicate_object then null;
    end;
  end if;

  if to_regclass('public.case_offers') is not null then
    begin
      alter table public.tippgeber_referrals
        add constraint tippgeber_referrals_linked_offer_fk
        foreign key (linked_offer_id) references public.case_offers(id) on delete set null;
    exception when duplicate_object then null;
    end;
  end if;
exception
  when undefined_table then null;
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets (logos + files like Expose/Gutschrift)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
select 'tipgeber_logos', 'tipgeber_logos', false
where not exists (select 1 from storage.buckets where id = 'tipgeber_logos');

insert into storage.buckets (id, name, public)
select 'tipgeber_files', 'tipgeber_files', false
where not exists (select 1 from storage.buckets where id = 'tipgeber_files');

-- ---------------------------------------------------------------------------
-- RLS (optional but useful for future direct access)
-- ---------------------------------------------------------------------------

alter table public.tippgeber_profiles enable row level security;
alter table public.tippgeber_referrals enable row level security;

drop policy if exists tippgeber_profiles_select on public.tippgeber_profiles;
create policy tippgeber_profiles_select
on public.tippgeber_profiles
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists tippgeber_profiles_insert on public.tippgeber_profiles;
create policy tippgeber_profiles_insert
on public.tippgeber_profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists tippgeber_profiles_update on public.tippgeber_profiles;
create policy tippgeber_profiles_update
on public.tippgeber_profiles
for update
to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists tippgeber_profiles_delete on public.tippgeber_profiles;
create policy tippgeber_profiles_delete
on public.tippgeber_profiles
for delete
to authenticated
using (public.is_admin());

drop policy if exists tippgeber_referrals_select on public.tippgeber_referrals;
create policy tippgeber_referrals_select
on public.tippgeber_referrals
for select
to authenticated
using (public.is_admin() or tippgeber_user_id = auth.uid());

drop policy if exists tippgeber_referrals_insert on public.tippgeber_referrals;
create policy tippgeber_referrals_insert
on public.tippgeber_referrals
for insert
to authenticated
with check (public.is_admin() or tippgeber_user_id = auth.uid());

drop policy if exists tippgeber_referrals_update on public.tippgeber_referrals;
create policy tippgeber_referrals_update
on public.tippgeber_referrals
for update
to authenticated
using (public.is_admin() or tippgeber_user_id = auth.uid())
with check (public.is_admin() or tippgeber_user_id = auth.uid());

drop policy if exists tippgeber_referrals_delete on public.tippgeber_referrals;
create policy tippgeber_referrals_delete
on public.tippgeber_referrals
for delete
to authenticated
using (public.is_admin());

commit;
