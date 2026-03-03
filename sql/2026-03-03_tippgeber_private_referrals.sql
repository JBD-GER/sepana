begin;

alter table public.tippgeber_profiles
  add column if not exists tippgeber_kind text;

update public.tippgeber_profiles
set tippgeber_kind = 'classic'
where coalesce(trim(tippgeber_kind), '') = '';

alter table public.tippgeber_profiles
  alter column tippgeber_kind set default 'classic';

alter table public.tippgeber_profiles
  alter column tippgeber_kind set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tippgeber_profiles_tippgeber_kind_check'
      and conrelid = 'public.tippgeber_profiles'::regclass
  ) then
    alter table public.tippgeber_profiles
      add constraint tippgeber_profiles_tippgeber_kind_check
      check (tippgeber_kind in ('classic', 'private_credit'));
  end if;
end $$;

alter table public.tippgeber_referrals
  add column if not exists referral_kind text;

update public.tippgeber_referrals
set referral_kind = 'classic'
where coalesce(trim(referral_kind), '') = '';

alter table public.tippgeber_referrals
  alter column referral_kind set default 'classic';

alter table public.tippgeber_referrals
  alter column referral_kind set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tippgeber_referrals_referral_kind_check'
      and conrelid = 'public.tippgeber_referrals'::regclass
  ) then
    alter table public.tippgeber_referrals
      add constraint tippgeber_referrals_referral_kind_check
      check (referral_kind in ('classic', 'private_credit'));
  end if;
end $$;

alter table public.tippgeber_referrals
  add column if not exists private_credit_volume numeric(14,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tippgeber_referrals_private_credit_volume_required_check'
      and conrelid = 'public.tippgeber_referrals'::regclass
  ) then
    alter table public.tippgeber_referrals
      add constraint tippgeber_referrals_private_credit_volume_required_check
      check (
        referral_kind <> 'private_credit'
        or (private_credit_volume is not null and private_credit_volume > 0)
      );
  end if;
end $$;

create index if not exists tippgeber_referrals_referral_kind_idx
  on public.tippgeber_referrals (referral_kind);

commit;
