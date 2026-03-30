alter table if exists public.case_additional_details
  add column if not exists previous_address_street text,
  add column if not exists previous_address_house_no text,
  add column if not exists previous_address_zip text,
  add column if not exists previous_address_city text,
  add column if not exists previous_address_since date;
