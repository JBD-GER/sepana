-- Add support for bank follow-up questions on offers.
-- Run once in Supabase SQL editor.

begin;

alter table if exists public.case_offers
  add column if not exists bank_feedback_note text;

do $$
declare
  check_name text;
begin
  select c.conname
    into check_name
  from pg_constraint c
  where c.conrelid = 'public.case_offers'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%bank_status%'
  limit 1;

  if check_name is not null then
    execute format('alter table public.case_offers drop constraint %I', check_name);
  end if;
end $$;

alter table if exists public.case_offers
  add constraint case_offers_bank_status_check
  check (
    bank_status is null
    or bank_status in ('submitted', 'documents', 'approved', 'declined', 'questions')
  );

create index if not exists idx_case_offers_bank_status_questions
  on public.case_offers (bank_status)
  where bank_status = 'questions';

commit;
