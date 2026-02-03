-- Track when a bank confirmation (approved) was set on offers.
-- Run once in Supabase SQL editor.

begin;

alter table if exists public.case_offers
  add column if not exists bank_confirmed_at timestamptz;

create index if not exists idx_case_offers_bank_confirmed_at
  on public.case_offers (bank_confirmed_at desc)
  where bank_status = 'approved';

-- Backfill historical approvals with created_at as first baseline.
update public.case_offers
set bank_confirmed_at = coalesce(bank_confirmed_at, created_at)
where bank_status = 'approved'
  and bank_confirmed_at is null;

commit;
