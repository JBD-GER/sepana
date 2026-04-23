begin;

do $$
declare
  allowed_values_sql text;
begin
  if to_regclass('public.documents') is null then
    return;
  end if;

  select string_agg(value, ', ' order by value)
    into allowed_values_sql
  from (
    select distinct quote_literal(document_kind) as value
    from public.documents
    where document_kind is not null

    union

    select quote_literal(kind)
    from unnest(array[
      'signature_original',
      'signature_signed',
      'bank_submission_bundle'
    ]) as kind
  ) allowed_values;

  if exists (
    select 1
    from pg_constraint
    where conname = 'documents_document_kind_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      drop constraint documents_document_kind_check;
  end if;

  execute format(
    'alter table public.documents add constraint documents_document_kind_check check (document_kind is null or document_kind in (%s))',
    allowed_values_sql
  );
end $$;

commit;
