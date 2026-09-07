begin;

-- A signed agreement is an immutable snapshot, independent of editable profiles.
-- PDF and signature are committed atomically; no separate storage upload can fail.
create table public.tippgeber_partnership_agreements (
  user_id uuid primary key references auth.users(id),
  version text not null check (length(version) between 1 and 80),
  signer_name text not null check (length(btrim(signer_name)) between 3 and 120),
  signed_at timestamptz not null,
  document_snapshot jsonb not null check (jsonb_typeof(document_snapshot) = 'object'),
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  signature_strokes jsonb not null check (jsonb_typeof(signature_strokes) = 'array' and jsonb_array_length(signature_strokes) between 1 and 100),
  acceptance_text text not null check (length(acceptance_text) > 20),
  signed_pdf_base64 text not null check (length(signed_pdf_base64) between 100 and 3000000),
  signed_pdf_sha256 text not null check (signed_pdf_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  constraint agreement_partner_matches check ((document_snapshot -> 'partner' ->> 'userId') is not null and document_snapshot -> 'partner' ->> 'userId' = user_id::text),
  constraint agreement_signer_matches check ((document_snapshot -> 'partner' ->> 'signerName') is not null and document_snapshot -> 'partner' ->> 'signerName' = signer_name),
  constraint agreement_version_matches check ((document_snapshot ->> 'version') is not null and document_snapshot ->> 'version' = version),
  constraint agreement_acceptance_matches check ((document_snapshot ->> 'acceptanceText') is not null and document_snapshot ->> 'acceptanceText' = acceptance_text),
  constraint agreement_pdf_checksum check (encode(sha256(decode(signed_pdf_base64, 'base64')), 'hex') = signed_pdf_sha256)
);

alter table public.tippgeber_partnership_agreements enable row level security;
revoke all on public.tippgeber_partnership_agreements from public, anon, authenticated, service_role;
grant select on public.tippgeber_partnership_agreements to authenticated;
grant select, insert on public.tippgeber_partnership_agreements to service_role;

create policy tippgeber_partnership_agreements_read_own
  on public.tippgeber_partnership_agreements for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.prevent_partnership_agreement_changes()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Signed partnership agreements cannot be overwritten or deleted.';
end;
$$;
revoke all on function public.prevent_partnership_agreement_changes() from public, anon, authenticated;

create trigger tippgeber_partnership_agreements_immutable
  before update or delete on public.tippgeber_partnership_agreements
  for each row execute function public.prevent_partnership_agreement_changes();

comment on table public.tippgeber_partnership_agreements is
  'Signed Baufinanzierung partner agreements. Server-authorized insert only; original contract, consent, strokes and exact PDF retained together. No browser writes.';

commit;
