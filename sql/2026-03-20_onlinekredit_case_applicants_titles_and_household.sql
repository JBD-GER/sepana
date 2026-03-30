alter table if exists public.case_applicants
  add column if not exists title text[],
  add column if not exists shared_household_with_primary boolean,
  add column if not exists residence_since date,
  add column if not exists previous_address_street text,
  add column if not exists previous_address_house_no text,
  add column if not exists previous_address_zip text,
  add column if not exists previous_address_city text,
  add column if not exists previous_address_since date,
  add column if not exists household_persons integer,
  add column if not exists vehicle_count integer;
