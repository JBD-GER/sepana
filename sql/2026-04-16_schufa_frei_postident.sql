begin;

alter table public.case_skag_sync
  add column if not exists postident_url text;

alter table public.case_skag_sync
  add column if not exists postident_added_at timestamptz;

alter table public.case_skag_sync
  add column if not exists postident_notified_at timestamptz;

commit;
