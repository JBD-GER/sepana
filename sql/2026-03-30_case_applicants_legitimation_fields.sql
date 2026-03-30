alter table if exists public.case_applicants
  add column if not exists birth_place text,
  add column if not exists id_document_number text,
  add column if not exists id_issued_place text,
  add column if not exists id_issued_at date,
  add column if not exists id_expires_at date;

do $$
begin
  if exists (
    select 1
    from pg_class
    where oid = 'public.case_applicants'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.case_applicants'::regclass
      and conname = 'case_applicants_id_date_check'
  ) then
    alter table public.case_applicants
      add constraint case_applicants_id_date_check
      check (
        id_issued_at is null
        or id_expires_at is null
        or id_expires_at >= id_issued_at
      );
  end if;
end $$;
