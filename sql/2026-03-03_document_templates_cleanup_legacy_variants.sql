begin;

-- 1) Legacy-Template-Saetze deaktivieren, damit neue Faelle keine doppelten Anforderungen erzeugen.
update public.document_templates
set is_active = false
where case_type in ('baufi', 'konsum')
  and template_key in ('standard_baufi', 'standard_konsum', 'konsum_standard_baufi');

-- 2) Gehaltsabrechnungen immer auf "letzte 3" normieren (Templates + bestehende Requests).
update public.document_templates
set
  title = 'Letzte 3 Gehaltsabrechnungen',
  sort_order = 30,
  required = true
where case_type in ('baufi', 'konsum')
  and lower(coalesce(title, '')) like 'letzte % gehaltsabrechnungen%'
  and lower(coalesce(title, '')) <> 'letzte 3 gehaltsabrechnungen';

update public.document_requests
set title = 'Letzte 3 Gehaltsabrechnungen'
where lower(coalesce(title, '')) like 'letzte % gehaltsabrechnungen%'
  and lower(coalesce(title, '')) <> 'letzte 3 gehaltsabrechnungen';

-- 3) Weitere bekannte Alt-Titel auf die neuen Standardtitel bringen.
update public.document_templates
set title = 'Personalausweis / Reisepass (Vorder- & Rueckseite)'
where case_type in ('baufi', 'konsum')
  and title in (
    'Personalausweis (Vorder- & Rueckseite)',
    'Personalausweis (Vorder- & Rückseite)'
  );

update public.document_requests
set title = 'Personalausweis / Reisepass (Vorder- & Rueckseite)'
where title in (
  'Personalausweis (Vorder- & Rueckseite)',
  'Personalausweis (Vorder- & Rückseite)'
);

update public.document_templates
set
  title = 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)',
  sort_order = 40,
  required = true
where case_type in ('baufi', 'konsum')
  and title in (
    'Aktueller Kontoauszug (Gehaltseingang ersichtlich)',
    'Letzte 3M. Kontoauszuege (Gehaltseingang ersichtlich)',
    'Letzte 3M. Kontoauszüge (Gehaltseingang ersichtlich)'
  );

update public.document_requests
set title = 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)'
where title in (
  'Aktueller Kontoauszug (Gehaltseingang ersichtlich)',
  'Letzte 3M. Kontoauszuege (Gehaltseingang ersichtlich)',
  'Letzte 3M. Kontoauszüge (Gehaltseingang ersichtlich)'
);

update public.document_templates
set
  title = 'Eigenkapital-Nachweis (aktueller Kontoauszug)',
  sort_order = 110,
  required = true
where case_type = 'baufi'
  and title = 'Nachweis Eigenkapital (z. B. Kontoauszug)';

update public.document_requests
set title = 'Eigenkapital-Nachweis (aktueller Kontoauszug)'
where title = 'Nachweis Eigenkapital (z. B. Kontoauszug)';

commit;
