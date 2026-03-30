alter table if exists public.case_additional_details
  add column if not exists returned_debit_window text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'case_additional_details'
      and column_name = 'returned_debit_window'
  ) then
    alter table public.case_additional_details
      drop constraint if exists case_additional_details_returned_debit_window_check;

    alter table public.case_additional_details
      add constraint case_additional_details_returned_debit_window_check
      check (
        returned_debit_window is null
        or returned_debit_window in ('none', '30_days', '60_days', '90_days')
      );
  end if;
end $$;
