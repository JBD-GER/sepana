create extension if not exists pgcrypto;

create table if not exists public.ratgeber_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  seo_title text not null,
  seo_description text not null,
  hero_title text not null,
  hero_text text not null,
  cta_href text not null,
  cta_label text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ratgeber_categories_slug_not_blank check (length(trim(slug)) > 0),
  constraint ratgeber_categories_name_not_blank check (length(trim(name)) > 0),
  constraint ratgeber_categories_description_not_blank check (length(trim(description)) > 0),
  constraint ratgeber_categories_seo_title_not_blank check (length(trim(seo_title)) > 0),
  constraint ratgeber_categories_seo_description_not_blank check (length(trim(seo_description)) > 0),
  constraint ratgeber_categories_hero_title_not_blank check (length(trim(hero_title)) > 0),
  constraint ratgeber_categories_hero_text_not_blank check (length(trim(hero_text)) > 0),
  constraint ratgeber_categories_cta_href_not_blank check (length(trim(cta_href)) > 0),
  constraint ratgeber_categories_cta_label_not_blank check (length(trim(cta_label)) > 0)
);

create table if not exists public.ratgeber_topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.ratgeber_categories(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null,
  hero_title text not null,
  hero_text text not null,
  seo_title text not null,
  seo_description text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  hero_image_path text,
  hero_image_alt text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ratgeber_topics_category_slug_unique unique (category_id, slug),
  constraint ratgeber_topics_slug_not_blank check (length(trim(slug)) > 0),
  constraint ratgeber_topics_name_not_blank check (length(trim(name)) > 0),
  constraint ratgeber_topics_description_not_blank check (length(trim(description)) > 0),
  constraint ratgeber_topics_hero_title_not_blank check (length(trim(hero_title)) > 0),
  constraint ratgeber_topics_hero_text_not_blank check (length(trim(hero_text)) > 0),
  constraint ratgeber_topics_seo_title_not_blank check (length(trim(seo_title)) > 0),
  constraint ratgeber_topics_seo_description_not_blank check (length(trim(seo_description)) > 0),
  constraint ratgeber_topics_hero_image_alt_not_blank check (hero_image_alt is null or length(trim(hero_image_alt)) > 0)
);

create table if not exists public.ratgeber_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.ratgeber_categories(id) on delete cascade,
  topic_id uuid not null references public.ratgeber_topics(id) on delete cascade,
  slug text not null,
  menu_title text not null,
  title text not null,
  excerpt text not null,
  seo_title text not null,
  seo_description text not null,
  focus_keyword text not null,
  reading_time_minutes integer not null default 4,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  hero_image_path text,
  hero_image_alt text,
  outline jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  content jsonb not null default '[]'::jsonb,
  constraint ratgeber_articles_topic_slug_unique unique (topic_id, slug),
  constraint ratgeber_articles_slug_not_blank check (length(trim(slug)) > 0),
  constraint ratgeber_articles_menu_title_not_blank check (length(trim(menu_title)) > 0),
  constraint ratgeber_articles_title_not_blank check (length(trim(title)) > 0),
  constraint ratgeber_articles_excerpt_not_blank check (length(trim(excerpt)) > 0),
  constraint ratgeber_articles_seo_title_not_blank check (length(trim(seo_title)) > 0),
  constraint ratgeber_articles_seo_description_not_blank check (length(trim(seo_description)) > 0),
  constraint ratgeber_articles_focus_keyword_not_blank check (length(trim(focus_keyword)) > 0),
  constraint ratgeber_articles_hero_image_alt_not_blank check (hero_image_alt is null or length(trim(hero_image_alt)) > 0),
  constraint ratgeber_articles_reading_time_positive check (reading_time_minutes > 0),
  constraint ratgeber_articles_outline_is_array check (jsonb_typeof(outline) = 'array'),
  constraint ratgeber_articles_highlights_is_array check (jsonb_typeof(highlights) = 'array'),
  constraint ratgeber_articles_faq_is_array check (jsonb_typeof(faq) = 'array'),
  constraint ratgeber_articles_content_is_array check (jsonb_typeof(content) = 'array')
);

alter table public.ratgeber_articles add column if not exists topic_id uuid;
alter table public.ratgeber_articles add column if not exists category_id uuid references public.ratgeber_categories(id) on delete cascade;
alter table public.ratgeber_articles add column if not exists menu_title text;
alter table public.ratgeber_articles add column if not exists title text;
alter table public.ratgeber_articles add column if not exists excerpt text;
alter table public.ratgeber_articles add column if not exists seo_title text;
alter table public.ratgeber_articles add column if not exists seo_description text;
alter table public.ratgeber_articles add column if not exists focus_keyword text;
alter table public.ratgeber_articles add column if not exists reading_time_minutes integer not null default 4;
alter table public.ratgeber_articles add column if not exists sort_order integer not null default 0;
alter table public.ratgeber_articles add column if not exists is_published boolean not null default true;
alter table public.ratgeber_articles add column if not exists hero_image_path text;
alter table public.ratgeber_articles add column if not exists hero_image_alt text;
alter table public.ratgeber_articles add column if not exists outline jsonb not null default '[]'::jsonb;
alter table public.ratgeber_articles add column if not exists highlights jsonb not null default '[]'::jsonb;
alter table public.ratgeber_articles add column if not exists faq jsonb not null default '[]'::jsonb;
alter table public.ratgeber_articles add column if not exists published_at timestamptz not null default timezone('utc', now());
alter table public.ratgeber_articles add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.ratgeber_articles add column if not exists content jsonb not null default '[]'::jsonb;

create index if not exists ratgeber_categories_sort_idx
  on public.ratgeber_categories (is_published, sort_order asc);

create index if not exists ratgeber_topics_category_sort_idx
  on public.ratgeber_topics (category_id, is_published, sort_order asc);

create index if not exists ratgeber_articles_topic_sort_idx
  on public.ratgeber_articles (topic_id, is_published, sort_order asc);

create index if not exists ratgeber_articles_published_idx
  on public.ratgeber_articles (is_published, published_at desc, updated_at desc);

create index if not exists ratgeber_articles_focus_keyword_idx
  on public.ratgeber_articles (focus_keyword);

create index if not exists ratgeber_articles_search_idx
  on public.ratgeber_articles
  using gin (
    to_tsvector(
      'german',
      coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(seo_description, '') || ' ' || coalesce(focus_keyword, '')
    )
  );

insert into storage.buckets (id, name, public)
select 'website_media', 'website_media', false
where not exists (select 1 from storage.buckets where id = 'website_media');

create or replace function public.touch_ratgeber_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists ratgeber_categories_touch_updated_at on public.ratgeber_categories;
create trigger ratgeber_categories_touch_updated_at
before update on public.ratgeber_categories
for each row
execute function public.touch_ratgeber_updated_at();

drop trigger if exists ratgeber_topics_touch_updated_at on public.ratgeber_topics;
create trigger ratgeber_topics_touch_updated_at
before update on public.ratgeber_topics
for each row
execute function public.touch_ratgeber_updated_at();

drop trigger if exists ratgeber_articles_touch_updated_at on public.ratgeber_articles;
create trigger ratgeber_articles_touch_updated_at
before update on public.ratgeber_articles
for each row
execute function public.touch_ratgeber_updated_at();

alter table public.ratgeber_categories enable row level security;
alter table public.ratgeber_topics enable row level security;
alter table public.ratgeber_articles enable row level security;

grant select on public.ratgeber_categories to anon, authenticated;
grant select on public.ratgeber_topics to anon, authenticated;
grant select on public.ratgeber_articles to anon, authenticated;

drop policy if exists ratgeber_categories_public_select on public.ratgeber_categories;
create policy ratgeber_categories_public_select
on public.ratgeber_categories
for select
to anon, authenticated
using (is_published = true);

drop policy if exists ratgeber_topics_public_select on public.ratgeber_topics;
create policy ratgeber_topics_public_select
on public.ratgeber_topics
for select
to anon, authenticated
using (
  is_published = true
  and exists (
    select 1
    from public.ratgeber_categories c
    where c.id = ratgeber_topics.category_id
      and c.is_published = true
  )
);

drop policy if exists ratgeber_articles_public_select on public.ratgeber_articles;
create policy ratgeber_articles_public_select
on public.ratgeber_articles
for select
to anon, authenticated
using (
  is_published = true
  and exists (
    select 1
    from public.ratgeber_topics t
    join public.ratgeber_categories c on c.id = t.category_id
    where t.id = ratgeber_articles.topic_id
      and t.is_published = true
      and c.is_published = true
  )
);

insert into public.ratgeber_categories (
  slug,
  name,
  description,
  seo_title,
  seo_description,
  hero_title,
  hero_text,
  cta_href,
  cta_label,
  sort_order,
  is_published
)
values
  (
    'baufinanzierung',
    'Baufinanzierung',
    'Ratgeber zur Baufinanzierung mit Fokus auf Hauskauf, Wohnungskauf, Anschlussfinanzierung, Eigenkapital und Nebenkosten.',
    'Ratgeber Baufinanzierung | Hauskauf, Wohnungskauf, Anschlussfinanzierung | SEPANA',
    'Der SEPANA Ratgeber zur Baufinanzierung erklaert Hauskauf, Wohnungskauf, Anschlussfinanzierung, Eigenkapital und Nebenkosten strukturiert und verstaendlich.',
    'Baufinanzierung verstehen und sauber vorbereiten.',
    'Wer eine Immobilie finanzieren will, braucht nicht nur einen Zinssatz, sondern Klarheit zu Budget, Eigenkapital, Nebenkosten und Timing. Genau dafuer ist dieser Bereich aufgebaut.',
    '/baufinanzierung',
    'Zur Baufinanzierung',
    1,
    true
  ),
  (
    'privatkredit',
    'Privatkredit',
    'Ratgeber zum Privatkredit mit Fokus auf Umschuldung, Bonitaet, Zinsen, Voraussetzungen und sinnvolle Verwendungszwecke.',
    'Ratgeber Privatkredit | Umschuldung, Bonitaet, Zinsen & Voraussetzungen | SEPANA',
    'Der SEPANA Ratgeber zum Privatkredit erklaert Umschuldung, Bonitaet, Zinsen, Voraussetzungen und Verwendungszwecke klar und suchmaschinenstark.',
    'Privatkredit klar einordnen, bevor du anfragst.',
    'Beim Privatkredit entscheiden Bonitaet, Verwendungszweck, Rate und Unterlagen ueber die Qualitaet des Ergebnisses. Die wichtigsten Grundlagen findest du hier an einem Ort.',
    '/privatkredit',
    'Zum Privatkredit',
    2,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  hero_title = excluded.hero_title,
  hero_text = excluded.hero_text,
  cta_href = excluded.cta_href,
  cta_label = excluded.cta_label,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published,
  updated_at = timezone('utc', now());

insert into public.ratgeber_topics (
  category_id,
  slug,
  name,
  description,
  hero_title,
  hero_text,
  seo_title,
  seo_description,
  sort_order,
  is_published,
  hero_image_path,
  hero_image_alt
)
values
  (
    (select id from public.ratgeber_categories where slug = 'baufinanzierung'),
    'hauskauf',
    'Hauskauf',
    'Alles rund um Finanzierung, Budget, Rate und Planung beim Hauskauf.',
    'Hauskauf sauber vorbereiten und Finanzierung realistisch planen.',
    'Diese Unterkategorie sammelt kuenftig alle Beitraege rund um Budget, Kaufpreis, Monatsrate und die typischen Entscheidungen vor dem Hauskauf.',
    'Hauskauf Ratgeber | Beitraege zu Finanzierung, Budget und Planung | SEPANA',
    'Unterkategorie Hauskauf im SEPANA Ratgeber mit eigenen Beitraegen zu Finanzierung, Budget, Unterlagen und typischen Fehlern.',
    1,
    true,
    '/familie_haus.jpg',
    'Hauskauf im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'baufinanzierung'),
    'wohnungskauf',
    'Wohnungskauf',
    'Beitraege zu Eigentumswohnung, Hausgeld, Ruecklagen und Finanzierung.',
    'Wohnungskauf besser einordnen und typische Sonderthemen verstehen.',
    'Hier liegen kuenftig alle Beitraege rund um Eigentumswohnungen, Hausgeld, Gemeinschaftseigentum und die richtige Finanzierungsstruktur.',
    'Wohnungskauf Ratgeber | Beitraege zu Finanzierung und Hausgeld | SEPANA',
    'Unterkategorie Wohnungskauf im SEPANA Ratgeber mit eigenen Beitraegen zu Finanzierung, Hausgeld, Ruecklagen und Objektpruefung.',
    2,
    true,
    '/familie_kueche.jpg',
    'Wohnungskauf im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'baufinanzierung'),
    'anschlussfinanzierung',
    'Anschlussfinanzierung',
    'Beitraege zu Restschuld, Timing, Forward-Darlehen und Zinsbindung.',
    'Anschlussfinanzierung frueh planen und Optionen sauber vergleichen.',
    'In dieser Unterkategorie entstehen kuenftig Beitraege zu Restschuld, Sollzinsbindung, Forward-Darlehen und dem richtigen Zeitpunkt fuer die Folgefinanzierung.',
    'Anschlussfinanzierung Ratgeber | Beitraege zu Restschuld und Timing | SEPANA',
    'Unterkategorie Anschlussfinanzierung im SEPANA Ratgeber mit eigenen Beitraegen zu Restschuld, Forward-Darlehen und Zinsstrategie.',
    3,
    true,
    '/familie_kueche.jpg',
    'Anschlussfinanzierung im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'baufinanzierung'),
    'eigenkapital',
    'Eigenkapital',
    'Beitraege zu Eigenmitteln, Reserve, Quote und Finanzierungsstruktur.',
    'Eigenkapital richtig einordnen statt Reserven falsch zu verbrauchen.',
    'Hier kommen kuenftig alle Beitraege rund um Eigenmittel, Reserveplanung, Kaufnebenkosten und die richtige Balance in der Baufinanzierung zusammen.',
    'Eigenkapital Ratgeber | Beitraege zu Reserve und Baufinanzierung | SEPANA',
    'Unterkategorie Eigenkapital im SEPANA Ratgeber mit eigenen Beitraegen zu Reserve, Nebenkosten und Finanzierungsspielraum.',
    4,
    true,
    '/familie_umzug.jpg',
    'Eigenkapital im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'baufinanzierung'),
    'nebenkosten',
    'Nebenkosten',
    'Beitraege zu Notar, Grundbuch, Grunderwerbsteuer und Startkosten.',
    'Nebenkosten transparent machen, bevor das Budget kippt.',
    'Diese Unterkategorie buendelt kuenftig alle Beitraege zu Kaufnebenkosten, Finanzierungsquote und den Kosten, die neben dem eigentlichen Kaufpreis anfallen.',
    'Nebenkosten Ratgeber | Beitraege zu Immobilienkauf und Budget | SEPANA',
    'Unterkategorie Nebenkosten im SEPANA Ratgeber mit eigenen Beitraegen zu Grunderwerbsteuer, Notar, Makler und Liquiditaetsplanung.',
    5,
    true,
    '/familie_haus.jpg',
    'Nebenkosten im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'privatkredit'),
    'umschuldung',
    'Umschuldung',
    'Beitraege zu Kreditbuendelung, Ablosung und neuer Ratenstruktur.',
    'Umschuldung strukturiert pruefen und Kreditlast neu ordnen.',
    'In dieser Unterkategorie entstehen kuenftig Beitraege zu Umschuldung, Kreditbuendelung, Restschuld und sinnvoller monatlicher Entlastung.',
    'Umschuldung Ratgeber | Beitraege zu Kreditwechsel und Rate | SEPANA',
    'Unterkategorie Umschuldung im SEPANA Ratgeber mit eigenen Beitraegen zu Kreditbuendelung, Restschuld und neuer Rate.',
    1,
    true,
    '/happy_family.jpg',
    'Umschuldung im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'privatkredit'),
    'bonitaet',
    'Bonitaet',
    'Beitraege zu Einkommen, Haushaltslage, SCHUFA und Kreditpruefung.',
    'Bonitaet besser verstehen und die Anfrage sauber vorbereiten.',
    'Hier sammeln sich kuenftig Beitraege zu SCHUFA, Haushaltsrechnung, Einkommen, laufenden Verpflichtungen und der Qualitaet einer Kreditanfrage.',
    'Bonitaet Ratgeber | Beitraege zu Kreditpruefung und SCHUFA | SEPANA',
    'Unterkategorie Bonitaet im SEPANA Ratgeber mit eigenen Beitraegen zu Einkommen, SCHUFA und besser vorbereiteten Kreditanfragen.',
    2,
    true,
    '/familie_umzug.jpg',
    'Bonitaet im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'privatkredit'),
    'zinsen',
    'Zinsen',
    'Beitraege zu Effektivzins, Laufzeit, Rate und Gesamtkosten.',
    'Zinsen richtig lesen und Angebote sinnvoll vergleichen.',
    'Diese Unterkategorie deckt kuenftig Beitraege zu Sollzins, Effektivzins, Laufzeit, Kreditbetrag und realer Monatsbelastung ab.',
    'Zinsen Ratgeber | Beitraege zu Effektivzins und Kreditrate | SEPANA',
    'Unterkategorie Zinsen im SEPANA Ratgeber mit eigenen Beitraegen zu Effektivzins, Rate, Laufzeit und Gesamtkosten.',
    3,
    true,
    '/happy_family.jpg',
    'Zinsen im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'privatkredit'),
    'voraussetzungen',
    'Voraussetzungen',
    'Beitraege zu Unterlagen, Einkommen, Tragfaehigkeit und Identitaet.',
    'Voraussetzungen fuer den Privatkredit klar und realistisch einordnen.',
    'Hier erscheinen kuenftig Beitraege zu Einkommensnachweisen, Haushaltsrechnung, Unterlagen und den typischen Anforderungen fuer einen Privatkredit.',
    'Voraussetzungen Ratgeber | Beitraege zu Privatkredit und Unterlagen | SEPANA',
    'Unterkategorie Voraussetzungen im SEPANA Ratgeber mit eigenen Beitraegen zu Einkommen, Unterlagen und Kreditpruefung.',
    4,
    true,
    '/familie_umzug.jpg',
    'Voraussetzungen im SEPANA Ratgeber'
  ),
  (
    (select id from public.ratgeber_categories where slug = 'privatkredit'),
    'verwendungszwecke',
    'Verwendungszwecke',
    'Beitraege zu freier Verwendung, Anschaffungen, Renovierung und Ordnung im Haushalt.',
    'Verwendungszwecke richtig einordnen und Kredite sinnvoll einsetzen.',
    'In dieser Unterkategorie landen kuenftig Beitraege zu sinnvoller Kreditnutzung, freier Verwendung, groesseren Anschaffungen und sauberer Haushaltsplanung.',
    'Verwendungszwecke Ratgeber | Beitraege zu sinnvoller Kreditnutzung | SEPANA',
    'Unterkategorie Verwendungszwecke im SEPANA Ratgeber mit eigenen Beitraegen zu Anschaffungen, Umschuldung und freier Verwendung.',
    5,
    true,
    '/happy_family.jpg',
    'Verwendungszwecke im SEPANA Ratgeber'
  )
on conflict (category_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  hero_title = excluded.hero_title,
  hero_text = excluded.hero_text,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published,
  hero_image_path = excluded.hero_image_path,
  hero_image_alt = excluded.hero_image_alt,
  updated_at = timezone('utc', now());

update public.ratgeber_articles a
set topic_id = t.id
from public.ratgeber_topics t
join public.ratgeber_categories c on c.id = t.category_id
where a.topic_id is null
  and a.category_id = c.id
  and a.slug = t.slug;

delete from public.ratgeber_articles
where published_at = '2026-03-10T08:00:00.000Z'::timestamptz
  and slug in (
    'hauskauf',
    'wohnungskauf',
    'anschlussfinanzierung',
    'eigenkapital',
    'nebenkosten',
    'umschuldung',
    'bonitaet',
    'zinsen',
    'voraussetzungen',
    'verwendungszwecke'
  );
