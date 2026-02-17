-- Add advisor-only private note field on cases.
-- Run once in Supabase SQL editor (or as migration).

begin;

alter table public.cases
  add column if not exists advisor_private_note text;

commit;
