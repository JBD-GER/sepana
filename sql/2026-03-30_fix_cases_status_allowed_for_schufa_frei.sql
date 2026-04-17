begin;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cases_status_allowed'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
      drop constraint cases_status_allowed;
  end if;

  alter table public.cases
    add constraint cases_status_allowed
    check (
      status in (
        'new',
        'draft',
        'open',
        'active',
        'submitted',
        'received',
        'in_review',
        'under_review',
        'processing',
        'needs_docs',
        'missing_docs',
        'waiting_customer',
        'waiting_advisor',
        'matching',
        'comparison_ready',
        'prequalified',
        'skag_submitted',
        'documents_requested',
        'correction_required',
        'offers_ready',
        'offer_created',
        'offer_open',
        'offer_sent',
        'offer_accepted',
        'offer_rejected',
        'approved',
        'rejected',
        'cancelled',
        'closed',
        'completed'
      )
    );
end $$;

commit;
