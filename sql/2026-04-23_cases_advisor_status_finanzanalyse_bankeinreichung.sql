begin;

alter table public.cases
  drop constraint if exists cases_advisor_status_check;

alter table public.cases
  add constraint cases_advisor_status_check
  check (
    advisor_status is null
    or advisor_status in (
      'neu',
      'kontaktaufnahme',
      'terminiert',
      'angebot',
      'nachfrage',
      'finanzanalyse',
      'bankeinreichung',
      'abgelehnt',
      'abgeschlossen'
    )
  );

commit;
