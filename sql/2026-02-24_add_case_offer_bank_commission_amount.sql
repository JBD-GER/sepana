-- Internal commission amount per accepted/approved offer (used for advisor/tippgeber share calculations).
-- Run once in Supabase SQL editor.

begin;

alter table if exists public.case_offers
  add column if not exists bank_commission_amount numeric(14,2);

create index if not exists idx_case_offers_bank_commission_amount
  on public.case_offers (bank_commission_amount)
  where bank_commission_amount is not null;

commit;
