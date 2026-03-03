begin;

do $$
declare
  has_template_key boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_templates'
      and column_name = 'template_key'
  )
  into has_template_key;

  if has_template_key then
    with desired(template_key, case_type, title, required, sort_order, is_active) as (
      values
        ('std_general_id_passport', 'baufi', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('std_general_registration_certificate', 'baufi', 'Meldebescheinigung', true, 20, true),
        ('std_general_salary_slips_3', 'baufi', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('std_general_bank_statements_salary_3m', 'baufi', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true),
        ('std_object_equity_proof', 'baufi', 'Eigenkapital-Nachweis (aktueller Kontoauszug)', true, 110, true),
        ('std_object_expose', 'baufi', 'Expose / Objektbeschreibung', true, 120, true),
        ('std_object_draft_purchase_contract', 'baufi', 'Kaufvertragsentwurf (sobald vorhanden)', true, 130, true),
        ('std_object_land_register', 'baufi', 'Grundbuchauszug (aktuell)', true, 140, true),
        ('std_object_site_plan', 'baufi', 'Flurkarte / Lageplan', true, 150, true),
        ('std_general_id_passport', 'konsum', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('std_general_registration_certificate', 'konsum', 'Meldebescheinigung', true, 20, true),
        ('std_general_salary_slips_3', 'konsum', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('std_general_bank_statements_salary_3m', 'konsum', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true)
    )
    update public.document_templates t
    set
      title = d.title,
      required = d.required,
      sort_order = d.sort_order,
      is_active = d.is_active
    from desired d
    where t.case_type = d.case_type
      and t.template_key = d.template_key;

    with desired(template_key, case_type, title, required, sort_order, is_active) as (
      values
        ('std_general_id_passport', 'baufi', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('std_general_registration_certificate', 'baufi', 'Meldebescheinigung', true, 20, true),
        ('std_general_salary_slips_3', 'baufi', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('std_general_bank_statements_salary_3m', 'baufi', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true),
        ('std_object_equity_proof', 'baufi', 'Eigenkapital-Nachweis (aktueller Kontoauszug)', true, 110, true),
        ('std_object_expose', 'baufi', 'Expose / Objektbeschreibung', true, 120, true),
        ('std_object_draft_purchase_contract', 'baufi', 'Kaufvertragsentwurf (sobald vorhanden)', true, 130, true),
        ('std_object_land_register', 'baufi', 'Grundbuchauszug (aktuell)', true, 140, true),
        ('std_object_site_plan', 'baufi', 'Flurkarte / Lageplan', true, 150, true),
        ('std_general_id_passport', 'konsum', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('std_general_registration_certificate', 'konsum', 'Meldebescheinigung', true, 20, true),
        ('std_general_salary_slips_3', 'konsum', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('std_general_bank_statements_salary_3m', 'konsum', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true)
    )
    insert into public.document_templates (template_key, case_type, title, required, sort_order, is_active)
    select d.template_key, d.case_type, d.title, d.required, d.sort_order, d.is_active
    from desired d
    where not exists (
      select 1
      from public.document_templates t
      where t.case_type = d.case_type
        and t.template_key = d.template_key
    );
  else
    with desired(case_type, title, required, sort_order, is_active) as (
      values
        ('baufi', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('baufi', 'Meldebescheinigung', true, 20, true),
        ('baufi', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('baufi', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true),
        ('baufi', 'Eigenkapital-Nachweis (aktueller Kontoauszug)', true, 110, true),
        ('baufi', 'Expose / Objektbeschreibung', true, 120, true),
        ('baufi', 'Kaufvertragsentwurf (sobald vorhanden)', true, 130, true),
        ('baufi', 'Grundbuchauszug (aktuell)', true, 140, true),
        ('baufi', 'Flurkarte / Lageplan', true, 150, true),
        ('konsum', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('konsum', 'Meldebescheinigung', true, 20, true),
        ('konsum', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('konsum', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true)
    )
    update public.document_templates t
    set
      required = d.required,
      sort_order = d.sort_order,
      is_active = d.is_active
    from desired d
    where t.case_type = d.case_type
      and t.title = d.title;

    with desired(case_type, title, required, sort_order, is_active) as (
      values
        ('baufi', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('baufi', 'Meldebescheinigung', true, 20, true),
        ('baufi', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('baufi', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true),
        ('baufi', 'Eigenkapital-Nachweis (aktueller Kontoauszug)', true, 110, true),
        ('baufi', 'Expose / Objektbeschreibung', true, 120, true),
        ('baufi', 'Kaufvertragsentwurf (sobald vorhanden)', true, 130, true),
        ('baufi', 'Grundbuchauszug (aktuell)', true, 140, true),
        ('baufi', 'Flurkarte / Lageplan', true, 150, true),
        ('konsum', 'Personalausweis / Reisepass (Vorder- & Rueckseite)', true, 10, true),
        ('konsum', 'Meldebescheinigung', true, 20, true),
        ('konsum', 'Letzte 3 Gehaltsabrechnungen', true, 30, true),
        ('konsum', 'Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)', true, 40, true)
    )
    insert into public.document_templates (case_type, title, required, sort_order, is_active)
    select d.case_type, d.title, d.required, d.sort_order, d.is_active
    from desired d
    where not exists (
      select 1
      from public.document_templates t
      where t.case_type = d.case_type
        and t.title = d.title
    );
  end if;
end $$;

commit;
