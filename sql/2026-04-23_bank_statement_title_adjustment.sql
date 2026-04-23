update public.document_templates
set
  title = 'Kontoauszug vom Gehaltseingang',
  sort_order = 40,
  required = true
where case_type in ('baufi', 'konsum', 'schufa_frei')
  and lower(trim(title)) in (
    'kontoauszuege der letzten 3 monate vom gehaltskonto (gehaltseingang sichtbar)',
    'aktueller kontoauszug (gehaltseingang ersichtlich)',
    'letzte 3m. kontoauszuege (gehaltseingang ersichtlich)',
    'kontoauszug vom gehaltseingang'
  );

update public.document_requests dr
set title = 'Kontoauszug vom Gehaltseingang'
from public.cases c
where dr.case_id = c.id
  and c.case_type in ('baufi', 'konsum', 'schufa_frei')
  and lower(trim(dr.title)) in (
    'kontoauszuege der letzten 3 monate vom gehaltskonto (gehaltseingang sichtbar)',
    'aktueller kontoauszug (gehaltseingang ersichtlich)',
    'letzte 3m. kontoauszuege (gehaltseingang ersichtlich)',
    'kontoauszug vom gehaltseingang'
  );
