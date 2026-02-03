-- Enable RLS for currently unrestricted tables/views and add explicit policies.
-- Run once in Supabase SQL Editor (or as migration).

begin;

-- ---------------------------------------------------------------------------
-- Helper functions used by policies
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_role()
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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.current_profile_role() = 'admin';
$$;

create or replace function public.is_case_customer(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cases c
    where c.id = target_case_id
      and c.customer_id = auth.uid()
  );
$$;

create or replace function public.is_case_advisor(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cases c
    where c.id = target_case_id
      and c.assigned_advisor_id = auth.uid()
  );
$$;

create or replace function public.is_signature_request_customer(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.case_signature_requests sr
    join public.cases c on c.id = sr.case_id
    where sr.id = target_request_id
      and c.customer_id = auth.uid()
  );
$$;

create or replace function public.is_signature_request_advisor(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.case_signature_requests sr
    join public.cases c on c.id = sr.case_id
    where sr.id = target_request_id
      and c.assigned_advisor_id = auth.uid()
  );
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_case_customer(uuid) from public;
revoke all on function public.is_case_advisor(uuid) from public;
revoke all on function public.is_signature_request_customer(uuid) from public;
revoke all on function public.is_signature_request_advisor(uuid) from public;

grant execute on function public.current_profile_role() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_case_customer(uuid) to anon, authenticated, service_role;
grant execute on function public.is_case_advisor(uuid) to anon, authenticated, service_role;
grant execute on function public.is_signature_request_customer(uuid) to anon, authenticated, service_role;
grant execute on function public.is_signature_request_advisor(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- advisor_availability
-- ---------------------------------------------------------------------------

alter table if exists public.advisor_availability enable row level security;

drop policy if exists advisor_availability_select on public.advisor_availability;
create policy advisor_availability_select
on public.advisor_availability
for select
to authenticated
using (public.is_admin() or advisor_id = auth.uid());

drop policy if exists advisor_availability_insert on public.advisor_availability;
create policy advisor_availability_insert
on public.advisor_availability
for insert
to authenticated
with check (public.is_admin() or advisor_id = auth.uid());

drop policy if exists advisor_availability_update on public.advisor_availability;
create policy advisor_availability_update
on public.advisor_availability
for update
to authenticated
using (public.is_admin() or advisor_id = auth.uid())
with check (public.is_admin() or advisor_id = auth.uid());

drop policy if exists advisor_availability_delete on public.advisor_availability;
create policy advisor_availability_delete
on public.advisor_availability
for delete
to authenticated
using (public.is_admin() or advisor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- case_additional_details
-- ---------------------------------------------------------------------------

alter table if exists public.case_additional_details enable row level security;

drop policy if exists case_additional_details_select on public.case_additional_details;
create policy case_additional_details_select
on public.case_additional_details
for select
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_additional_details_insert on public.case_additional_details;
create policy case_additional_details_insert
on public.case_additional_details
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_additional_details_update on public.case_additional_details;
create policy case_additional_details_update
on public.case_additional_details
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

drop policy if exists case_additional_details_delete on public.case_additional_details;
create policy case_additional_details_delete
on public.case_additional_details
for delete
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

-- ---------------------------------------------------------------------------
-- case_appointments (needed for customer/advisor realtime)
-- ---------------------------------------------------------------------------

alter table if exists public.case_appointments enable row level security;

drop policy if exists case_appointments_select on public.case_appointments;
create policy case_appointments_select
on public.case_appointments
for select
to authenticated
using (
  public.is_admin()
  or customer_id = auth.uid()
  or advisor_id = auth.uid()
);

drop policy if exists case_appointments_insert on public.case_appointments;
create policy case_appointments_insert
on public.case_appointments
for insert
to authenticated
with check (
  public.is_admin()
  or advisor_id = auth.uid()
);

drop policy if exists case_appointments_update on public.case_appointments;
create policy case_appointments_update
on public.case_appointments
for update
to authenticated
using (
  public.is_admin()
  or customer_id = auth.uid()
  or advisor_id = auth.uid()
)
with check (
  public.is_admin()
  or customer_id = auth.uid()
  or advisor_id = auth.uid()
);

drop policy if exists case_appointments_delete on public.case_appointments;
create policy case_appointments_delete
on public.case_appointments
for delete
to authenticated
using (
  public.is_admin()
  or advisor_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- case_children
-- ---------------------------------------------------------------------------

alter table if exists public.case_children enable row level security;

drop policy if exists case_children_select on public.case_children;
create policy case_children_select
on public.case_children
for select
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_children_insert on public.case_children;
create policy case_children_insert
on public.case_children
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_children_update on public.case_children;
create policy case_children_update
on public.case_children
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

drop policy if exists case_children_delete on public.case_children;
create policy case_children_delete
on public.case_children
for delete
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

-- ---------------------------------------------------------------------------
-- case_ref_seq (internal, should not be open)
-- ---------------------------------------------------------------------------

alter table if exists public.case_ref_seq enable row level security;

drop policy if exists case_ref_seq_admin_only on public.case_ref_seq;
create policy case_ref_seq_admin_only
on public.case_ref_seq
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- case_signature_requests
-- ---------------------------------------------------------------------------

alter table if exists public.case_signature_requests enable row level security;

drop policy if exists case_signature_requests_select on public.case_signature_requests;
create policy case_signature_requests_select
on public.case_signature_requests
for select
to authenticated
using (
  public.is_admin()
  or public.is_case_customer(case_id)
  or public.is_case_advisor(case_id)
);

drop policy if exists case_signature_requests_insert on public.case_signature_requests;
create policy case_signature_requests_insert
on public.case_signature_requests
for insert
to authenticated
with check (
  public.is_admin()
  or public.is_case_advisor(case_id)
);

drop policy if exists case_signature_requests_update on public.case_signature_requests;
create policy case_signature_requests_update
on public.case_signature_requests
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

drop policy if exists case_signature_requests_delete on public.case_signature_requests;
create policy case_signature_requests_delete
on public.case_signature_requests
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- case_signature_field_values
-- ---------------------------------------------------------------------------

alter table if exists public.case_signature_field_values enable row level security;

drop policy if exists case_signature_field_values_select on public.case_signature_field_values;
create policy case_signature_field_values_select
on public.case_signature_field_values
for select
to authenticated
using (
  public.is_admin()
  or actor_id = auth.uid()
  or public.is_signature_request_customer(request_id)
  or public.is_signature_request_advisor(request_id)
);

drop policy if exists case_signature_field_values_insert on public.case_signature_field_values;
create policy case_signature_field_values_insert
on public.case_signature_field_values
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and (
    public.is_admin()
    or public.is_signature_request_customer(request_id)
    or public.is_signature_request_advisor(request_id)
  )
);

drop policy if exists case_signature_field_values_update on public.case_signature_field_values;
create policy case_signature_field_values_update
on public.case_signature_field_values
for update
to authenticated
using (
  public.is_admin()
  or actor_id = auth.uid()
)
with check (
  public.is_admin()
  or actor_id = auth.uid()
);

drop policy if exists case_signature_field_values_delete on public.case_signature_field_values;
create policy case_signature_field_values_delete
on public.case_signature_field_values
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- case_signature_events
-- ---------------------------------------------------------------------------

alter table if exists public.case_signature_events enable row level security;

drop policy if exists case_signature_events_select on public.case_signature_events;
create policy case_signature_events_select
on public.case_signature_events
for select
to authenticated
using (
  public.is_admin()
  or public.is_signature_request_customer(request_id)
  or public.is_signature_request_advisor(request_id)
);

drop policy if exists case_signature_events_insert on public.case_signature_events;
create policy case_signature_events_insert
on public.case_signature_events
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and (
    public.is_admin()
    or public.is_signature_request_customer(request_id)
    or public.is_signature_request_advisor(request_id)
  )
);

drop policy if exists case_signature_events_update on public.case_signature_events;
create policy case_signature_events_update
on public.case_signature_events
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists case_signature_events_delete on public.case_signature_events;
create policy case_signature_events_delete
on public.case_signature_events
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- notification_log
-- ---------------------------------------------------------------------------

alter table if exists public.notification_log enable row level security;

drop policy if exists notification_log_select on public.notification_log;
create policy notification_log_select
on public.notification_log
for select
to authenticated
using (
  public.is_admin()
  or recipient_id = auth.uid()
  or actor_id = auth.uid()
);

drop policy if exists notification_log_insert on public.notification_log;
create policy notification_log_insert
on public.notification_log
for insert
to authenticated
with check (public.is_admin());

drop policy if exists notification_log_update on public.notification_log;
create policy notification_log_update
on public.notification_log
for update
to authenticated
using (
  public.is_admin()
  or recipient_id = auth.uid()
)
with check (
  public.is_admin()
  or recipient_id = auth.uid()
);

drop policy if exists notification_log_delete on public.notification_log;
create policy notification_log_delete
on public.notification_log
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Views marked as unrestricted in dashboard: explicitly remove anon/auth access
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.v_case_overview') is not null then
    execute 'revoke all on table public.v_case_overview from anon, authenticated';
    execute 'grant select on table public.v_case_overview to service_role';
  end if;

  if to_regclass('public.v_provider_comparison') is not null then
    execute 'revoke all on table public.v_provider_comparison from anon, authenticated';
    execute 'grant select on table public.v_provider_comparison to service_role';
  end if;
end $$;

commit;
