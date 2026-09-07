-- Transactional verification. Synthetic users and contract fixtures are rolled back.
begin;

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000091', 'agreement-test-owner@example.invalid'),
  ('10000000-0000-4000-8000-000000000092', 'agreement-test-other@example.invalid');

insert into public.tippgeber_partnership_agreements (
  user_id, version, signer_name, signed_at, document_snapshot, document_sha256,
  signature_strokes, acceptance_text, signed_pdf_base64, signed_pdf_sha256
) select
  '10000000-0000-4000-8000-000000000091', 'test', 'Test Partner', now(),
  '{"partner":{"userId":"10000000-0000-4000-8000-000000000091","signerName":"Test Partner"},"version":"test","acceptanceText":"Test acceptance for database verification only."}'::jsonb,
  repeat('a', 64), '[[{"x":0.1,"y":0.2},{"x":0.2,"y":0.3}]]'::jsonb,
  'Test acceptance for database verification only.',
  encode(convert_to(repeat('synthetic-pdf-test-data', 10), 'UTF8'), 'base64'),
  encode(sha256(convert_to(repeat('synthetic-pdf-test-data', 10), 'UTF8')), 'hex');

do $$
declare blocked boolean := false;
begin
  if has_table_privilege('anon', 'public.tippgeber_partnership_agreements', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Anonymous access must not be granted';
  end if;
  if has_table_privilege('authenticated', 'public.tippgeber_partnership_agreements', 'INSERT,UPDATE,DELETE') then
    raise exception 'Browser writes must not be granted';
  end if;
  if has_table_privilege('service_role', 'public.tippgeber_partnership_agreements', 'UPDATE,DELETE') then
    raise exception 'Service role must not overwrite signed agreements';
  end if;
  if not has_table_privilege('service_role', 'public.tippgeber_partnership_agreements', 'INSERT') then
    raise exception 'Server must be able to record the signature';
  end if;
  begin
    update public.tippgeber_partnership_agreements set signer_name = 'Changed Name'
    where user_id = '10000000-0000-4000-8000-000000000091';
  exception when raise_exception then blocked := true;
  end;
  if not blocked then raise exception 'Immutable trigger did not prevent update'; end if;
  blocked := false;
  begin
    insert into public.tippgeber_partnership_agreements
    select * from public.tippgeber_partnership_agreements where user_id = '10000000-0000-4000-8000-000000000091';
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'Duplicate signature was accepted'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000091', true);
do $$
begin
  if (select count(*) from public.tippgeber_partnership_agreements) <> 1 then
    raise exception 'Partner must see exactly their own agreement';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000092', true);
do $$
begin
  if exists (select 1 from public.tippgeber_partnership_agreements) then
    raise exception 'Another partner must not see the signed agreement';
  end if;
end;
$$;
reset role;
rollback;
select 'Agreement ownership, grants, immutable snapshot and duplicate protection verified; fixtures rolled back.' as result;
