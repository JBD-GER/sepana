alter table public.ratgeber_articles
  add column if not exists cta_page_href text;

alter table public.ratgeber_articles
  drop constraint if exists ratgeber_articles_cta_page_href_not_blank;

alter table public.ratgeber_articles
  add constraint ratgeber_articles_cta_page_href_not_blank
  check (cta_page_href is null or length(trim(cta_page_href)) > 0);

create index if not exists ratgeber_articles_cta_page_href_idx
  on public.ratgeber_articles (cta_page_href)
  where cta_page_href is not null;
