begin;

-- ---------------------------------------------------------------------------
-- Profiles role support (add "insurance")
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
    check (role in ('customer', 'advisor', 'admin', 'tipgeber', 'insurance'));
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

create or replace function public.is_insurance_partner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.get_my_role() = 'insurance';
$$;

revoke all on function public.is_insurance_partner() from public;
grant execute on function public.is_insurance_partner() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Insurance partner profiles
-- ---------------------------------------------------------------------------

create table if not exists public.insurance_partner_profiles (
  user_id uuid primary key,
  partner_code text not null,
  company_name text,
  display_name text,
  bio text,
  languages text[] not null default '{}'::text[],
  photo_path text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insurance_partner_profiles_partner_code_idx
  on public.insurance_partner_profiles (partner_code);

create index if not exists insurance_partner_profiles_is_active_idx
  on public.insurance_partner_profiles (is_active);

-- ---------------------------------------------------------------------------
-- Routed insurance cases
-- ---------------------------------------------------------------------------

create table if not exists public.case_insurance_routes (
  case_id uuid primary key references public.cases(id) on delete cascade,
  route_source text not null default 'advisor_manual',
  route_status text not null default 'new',
  routed_by uuid,
  routed_at timestamptz not null default now(),
  decision_sent_at timestamptz,
  advisor_private_note_snapshot text,
  last_status_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_insurance_routes_source_check check (
    route_source in ('precheck_rejected', 'advisor_manual')
  ),
  constraint case_insurance_routes_status_check check (
    route_status in ('new', 'contacted', 'in_review', 'quoted', 'waiting_feedback', 'completed', 'rejected')
  )
);

create index if not exists case_insurance_routes_status_idx
  on public.case_insurance_routes (route_status);

create index if not exists case_insurance_routes_routed_at_idx
  on public.case_insurance_routes (routed_at desc);

-- ---------------------------------------------------------------------------
-- Internal insurance notes
-- ---------------------------------------------------------------------------

create table if not exists public.case_insurance_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  author_id uuid not null,
  author_role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint case_insurance_notes_author_role_check check (
    author_role in ('insurance', 'admin')
  )
);

create index if not exists case_insurance_notes_case_created_idx
  on public.case_insurance_notes (case_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
select 'insurance_partner_avatars', 'insurance_partner_avatars', false
where not exists (
  select 1
  from storage.buckets
  where id = 'insurance_partner_avatars'
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.insurance_partner_profiles enable row level security;
alter table public.case_insurance_routes enable row level security;
alter table public.case_insurance_notes enable row level security;

drop policy if exists insurance_partner_profiles_select on public.insurance_partner_profiles;
create policy insurance_partner_profiles_select
on public.insurance_partner_profiles
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists insurance_partner_profiles_insert on public.insurance_partner_profiles;
create policy insurance_partner_profiles_insert
on public.insurance_partner_profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists insurance_partner_profiles_update on public.insurance_partner_profiles;
create policy insurance_partner_profiles_update
on public.insurance_partner_profiles
for update
to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists insurance_partner_profiles_delete on public.insurance_partner_profiles;
create policy insurance_partner_profiles_delete
on public.insurance_partner_profiles
for delete
to authenticated
using (public.is_admin());

drop policy if exists case_insurance_routes_select on public.case_insurance_routes;
create policy case_insurance_routes_select
on public.case_insurance_routes
for select
to authenticated
using (
  public.is_admin()
  or public.is_insurance_partner()
  or public.is_case_advisor(case_id)
);

drop policy if exists case_insurance_routes_insert on public.case_insurance_routes;
create policy case_insurance_routes_insert
on public.case_insurance_routes
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_case_advisor(case_id)
);

drop policy if exists case_insurance_routes_update on public.case_insurance_routes;
create policy case_insurance_routes_update
on public.case_insurance_routes
for update
to authenticated
using (
  public.is_admin()
  or public.is_insurance_partner()
  or public.is_case_advisor(case_id)
)
with check (
  public.is_admin()
  or public.is_insurance_partner()
  or public.is_case_advisor(case_id)
);

drop policy if exists case_insurance_notes_select on public.case_insurance_notes;
create policy case_insurance_notes_select
on public.case_insurance_notes
for select
to authenticated
using (
  public.is_admin()
  or public.is_insurance_partner()
  or public.is_case_advisor(case_id)
);

drop policy if exists case_insurance_notes_insert on public.case_insurance_notes;
create policy case_insurance_notes_insert
on public.case_insurance_notes
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_insurance_partner()
);

drop policy if exists case_insurance_notes_delete on public.case_insurance_notes;
create policy case_insurance_notes_delete
on public.case_insurance_notes
for delete
to authenticated
using (public.is_admin());

commit;
