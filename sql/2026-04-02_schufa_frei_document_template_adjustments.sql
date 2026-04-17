update public.document_templates
set required = false
where case_type = 'schufa_frei'
  and lower(trim(title)) = 'meldebescheinigung';

update public.document_templates
set title = 'IBAN-Nachweis (Foto von der Karte)'
where case_type = 'schufa_frei'
  and lower(trim(title)) in ('iban-nachweis / ec-karte', 'iban-nachweis oder ec-karte');

update public.document_requests dr
set required = false
from public.cases c
where dr.case_id = c.id
  and c.case_type = 'schufa_frei'
  and lower(trim(dr.title)) = 'meldebescheinigung';

update public.document_requests dr
set title = 'IBAN-Nachweis (Foto von der Karte)'
from public.cases c
where dr.case_id = c.id
  and c.case_type = 'schufa_frei'
  and lower(trim(dr.title)) in ('iban-nachweis / ec-karte', 'iban-nachweis oder ec-karte');
