begin;

create table if not exists public.website_reviews (
  id uuid primary key default gen_random_uuid(),
  seed_key text unique,
  category text not null,
  rating smallint not null,
  quote text not null,
  reviewer_initials text not null,
  reviewer_city text not null,
  reviewed_on date not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint website_reviews_category_check check (category in ('baufi', 'privatkredit')),
  constraint website_reviews_rating_check check (rating between 1 and 5),
  constraint website_reviews_quote_not_blank check (length(trim(quote)) > 0),
  constraint website_reviews_reviewer_initials_not_blank check (length(trim(reviewer_initials)) > 0),
  constraint website_reviews_reviewer_city_not_blank check (length(trim(reviewer_city)) > 0)
);

create index if not exists website_reviews_category_reviewed_on_idx
  on public.website_reviews (category, reviewed_on desc, created_at desc);

create index if not exists website_reviews_published_reviewed_on_idx
  on public.website_reviews (is_published, reviewed_on desc, created_at desc);

alter table public.website_reviews enable row level security;

grant select on public.website_reviews to anon, authenticated;

drop policy if exists website_reviews_public_select on public.website_reviews;
create policy website_reviews_public_select
on public.website_reviews
for select
to anon, authenticated
using (is_published = true);

insert into public.website_reviews (
  seed_key,
  category,
  rating,
  quote,
  reviewer_initials,
  reviewer_city,
  reviewed_on,
  is_published
)
values
  ('baufi_001', 'baufi', 5, 'Alleine hätte ich es sicherlich gar nicht durch die Dokumente geschafft. Frau Müller war eine riesige Hilfe und hat alles strukturiert.', 'B. H.', 'Hamburg', '2026-02-11', true),
  ('baufi_002', 'baufi', 5, 'Herr Pfad hat uns sehr schnell Rückmeldung gegeben und klar erklärt, was als Nächstes passiert. Digitale Signierung war super praktisch.', 'D. K.', 'Grenzach-Wyhlen', '2026-02-06', true),
  ('baufi_003', 'baufi', 5, 'Sehr angenehme Beratung. Besonders die Online-Ablage hat geholfen, weil wir alle Dokumente sauber an einem Ort hatten.', 'J. Q.', 'Hamburg', '2026-01-27', true),
  ('baufi_004', 'baufi', 5, 'Wir haben uns gut aufgehoben gefühlt. Frau Müller hat unsere Fragen verständlich beantwortet und den Ablauf sehr transparent gemacht.', 'F. M.', 'Bremen', '2026-01-19', true),
  ('baufi_005', 'baufi', 5, 'Alles prima: schnelle Bearbeitung, klare To-dos, und im Portal sieht man immer den aktuellen Stand.', 'F. S.', 'Schwülper', '2026-01-12', true),
  ('baufi_006', 'baufi', 5, 'Herr Wagner war sehr kompetent und hat uns verschiedene Optionen gegenübergestellt (Zinsbindung, Rate, Sondertilgung).', 'M. H.', 'München', '2025-12-22', true),
  ('baufi_007', 'baufi', 5, 'Die digitale Unterschrift war wirklich easy. Kein Drucken, kein Hin- und Herfahren – hat uns Zeit gespart.', 'C. B.', 'Lauenburg', '2025-12-09', true),
  ('baufi_008', 'baufi', 5, 'Herr Pfad arbeitet sehr effizient. Wir mochten die klare Kommunikation und dass alles ohne unnötige Termine geklappt hat.', 'W. S.', 'Münster', '2025-12-03', true),
  ('baufi_009', 'baufi', 5, 'Frau Müller hat uns bei der Anschlussfinanzierung begleitet. Sehr ruhig, sehr strukturiert – hat sich richtig gut angefühlt.', 'R. T.', 'Düsseldorf', '2025-11-18', true),
  ('baufi_010', 'baufi', 5, 'Sehr professionell. Die Online-Ablage ist übersichtlich und man findet alles sofort wieder.', 'A. H.', 'Potsdam', '2025-11-04', true),
  ('baufi_011', 'baufi', 4, 'Gute Beratung und schnelle Umsetzung. Für uns wäre ein kurzes Zwischenupdate zwischendurch noch das i-Tüpfelchen gewesen, ansonsten top.', 'U. P.', 'Wuppertal', '2025-10-21', true),
  ('baufi_012', 'baufi', 5, 'Herr Wagner hat alles realistisch eingeordnet und dabei sehr lösungsorientiert gearbeitet. Kann ich empfehlen.', 'K. F.', 'Ulm', '2025-10-02', true),
  ('baufi_013', 'baufi', 5, 'Herr Pfad hat uns super durch den Prozess geführt. Besonders hilfreich war, dass die Unterlagen vorab geprüft wurden.', 'S. D.', 'Heilbronn', '2025-09-17', true),
  ('baufi_014', 'baufi', 5, 'Frau Müller war jederzeit freundlich und hat uns wirklich Sicherheit gegeben. Die digitale Signierung war für uns neu, aber hat perfekt funktioniert.', 'R. L.', 'Bochum', '2025-08-29', true),
  ('baufi_015', 'baufi', 4, 'Sehr gut organisiert. Am Handy war der Upload bei uns etwas „kleiner“, am Laptop dafür total entspannt. Insgesamt sehr zufrieden.', 'C. D.', 'Mainz', '2025-08-14', true),
  ('baufi_016', 'baufi', 5, 'Herr Wagner hat den Zeitplan bis zum Notartermin sauber im Blick behalten. Das war für uns Gold wert.', 'P. H.', 'Essen', '2025-07-31', true),
  ('baufi_017', 'baufi', 5, 'Herr Pfad war super erreichbar und hat schnell reagiert, wenn die Bank Rückfragen hatte.', 'V. S.', 'Saarbrücken', '2025-07-09', true),
  ('baufi_018', 'baufi', 5, 'Frau Müller hat uns eine klare Checkliste gegeben, dadurch war alles viel einfacher als gedacht.', 'D. M.', 'Kassel', '2025-06-27', true),
  ('baufi_019', 'baufi', 4, 'Sehr kompetent. Bei KfW hätten wir gerne noch 1–2 Zusatzinfos gehabt, aber insgesamt war alles sehr gut erklärt und umgesetzt.', 'L. B.', 'Aachen', '2025-06-11', true),
  ('baufi_020', 'baufi', 5, 'Herr Wagner hat uns geholfen, die Finanzierung vorausschauend zu planen (Puffer, Nebenkosten, Sondertilgung).', 'E. W.', 'Paderborn', '2025-05-30', true),
  ('baufi_021', 'baufi', 5, 'Herr Pfad hat sofort Struktur reingebracht. Wir hatten das Gefühl: da ist jemand, der den Prozess wirklich im Griff hat.', 'A. M.', 'Hamburg', '2025-05-21', true),
  ('baufi_022', 'baufi', 4, 'Alles lief sehr sauber. Einmal hätte ich mir noch eine kurze Info gewünscht, aber sonst wirklich reibungslos.', 'P. W.', 'Darmstadt', '2025-05-07', true),
  ('baufi_023', 'baufi', 5, 'Online-Ablage + digitale Signatur = einfach modern. Hat bei uns ohne Probleme funktioniert.', 'F. P.', 'Flensburg', '2025-04-24', true),
  ('baufi_024', 'baufi', 5, 'Herr Wagner hat mehrere Banken verglichen und die Unterschiede verständlich erklärt. Gute Entscheidungshilfe.', 'G. N.', 'Bonn', '2025-04-09', true),
  ('baufi_025', 'baufi', 5, 'Frau Müller war super geduldig und hat alles so erklärt, dass wir es wirklich verstanden haben.', 'I. K.', 'Lübeck', '2025-03-18', true),
  ('baufi_026', 'baufi', 5, 'Herr Pfad war klar und direkt, ohne Druck. Genau so wollten wir das.', 'S. K.', 'Hannover', '2025-02-27', true),
  ('baufi_027', 'baufi', 4, 'Sehr gute Begleitung. Für uns wäre ein kurzer Start-Call mit allen Schritten auf einmal noch hilfreich gewesen – ansonsten top.', 'J. S.', 'Osnabrück', '2025-02-12', true),
  ('baufi_028', 'baufi', 5, 'Herr Wagner war gut erreichbar und hat sich Zeit genommen. Wir sind sehr zufrieden mit dem Ergebnis.', 'H. M.', 'Koblenz', '2025-01-29', true),
  ('baufi_029', 'baufi', 5, 'Sehr seriös, transparent und angenehm. Kein Verkaufsgefühl, sondern echte Beratung.', 'M. R.', 'Bonn', '2025-01-15', true),
  ('baufi_030', 'baufi', 5, 'Frau Müller hat uns beim ersten Finanzierungsvorhaben begleitet. Ohne Stress, klarer Ablauf, hat richtig gut funktioniert.', 'T. H.', 'Trier', '2025-01-09', true),
  ('baufi_031', 'baufi', 5, 'Herr Pfad hat uns bei einer etwas komplexeren Situation sehr gut durchgeleitet. Portal war übersichtlich und die Uploads waren schnell erledigt.', 'N. S.', 'Magdeburg', '2025-11-06', true),
  ('baufi_032', 'baufi', 4, 'Frau Müller war sehr freundlich und verbindlich. Ein kurzes Zwischenfeedback zwischendurch wäre nett gewesen, aber insgesamt absolut empfehlenswert.', 'O. R.', 'Augsburg', '2025-09-23', true),
  ('baufi_033', 'baufi', 5, 'Herr Wagner hat wirklich gute Konditionen rausgeholt und hat alles transparent erklärt.', 'F. B.', 'Frankfurt am Main', '2025-08-05', true),
  ('baufi_034', 'baufi', 5, 'Im Portal sieht man genau, was fehlt. Das hat uns sehr geholfen, weil wir nichts “vergessen” haben.', 'J. N.', 'Ingolstadt', '2025-07-02', true),
  ('baufi_035', 'baufi', 5, 'Herr Pfad hat uns sehr geholfen, die Unterlagen sauber aufzubereiten. Danach ging es bei der Bank deutlich schneller.', 'H. B.', 'Hildesheim', '2025-06-16', true),
  ('baufi_036', 'baufi', 4, 'Frau Müller hat uns super begleitet und war immer nett. Wir hätten nur gern ein kleines Update öfter gehabt, sonst alles klasse.', 'C. H.', 'Bamberg', '2025-05-08', true),
  ('baufi_037', 'baufi', 5, 'Herr Wagner hat auch den Zeitplan mit dem Verkäufer/Notar gut im Blick gehabt. Das war für uns echt hilfreich.', 'L. T.', 'Lünen', '2025-04-26', true),
  ('baufi_038', 'baufi', 5, 'Herr Pfad hat richtig schnell gearbeitet, das hat uns sehr geholfen weil wir wenig Zeit hatten.', 'E. A.', 'Rostock', '2025-03-13', true),
  ('baufi_039', 'baufi', 5, 'Frau Müller hat das alles gut erklärt und wir konnten die dokumente einfach hochladen. War viel einfacher als gedacht.', 'N. G.', 'Nürnberg', '2025-02-20', true),
  ('baufi_040', 'baufi', 5, 'Herr Wagner hat uns verschiedene Zinsbindungen gezeigt und nichts “aufgedrängt”. Sehr angenehme Zusammenarbeit.', 'K. L.', 'Stuttgart', '2025-02-04', true),
  ('baufi_041', 'baufi', 5, 'Digitale Signatur hat bei uns erst kurz gehakt (lag an mir), aber danach lief alles super. Danke nochmal!', 'F. F.', 'Falkensee', '2025-01-22', true),
  ('privatkredit_001', 'privatkredit', 5, 'Wir brauchten schnell einen Privatkredit für eine dringende Ausgabe. Frau Müller hat den Prozess super strukturiert und alles verständlich erklärt.', 'B. H.', 'Hamburg', '2026-02-11', true),
  ('privatkredit_002', 'privatkredit', 5, 'Herr Pfad hat uns bei der Umschuldung beraten. Ging schneller als gedacht und die Rate ist jetzt deutlich besser.', 'D. K.', 'Grenzach-Wyhlen', '2026-02-06', true),
  ('privatkredit_003', 'privatkredit', 5, 'Sehr angenehm. Für uns war wichtig, dass alles digital geht – Upload und digitale Signatur liefen problemlos.', 'J. Q.', 'Hamburg', '2026-01-27', true),
  ('privatkredit_004', 'privatkredit', 4, 'Gute Beratung und schnelle Rückmeldung. Ein kurzes Zwischenupdate mehr wäre schön gewesen, aber insgesamt top.', 'F. M.', 'Bremen', '2026-01-19', true),
  ('privatkredit_005', 'privatkredit', 5, 'Wir haben einen Kredit für Renovierung/Modernisierung gebraucht. Herr Wagner hat uns sauber durch die Optionen geführt.', 'M. H.', 'München', '2025-12-22', true),
  ('privatkredit_006', 'privatkredit', 5, 'Sehr transparent. Keine “komischen” Extras, sondern klare Konditionen und klare Schritte.', 'C. B.', 'Lauenburg', '2025-12-09', true),
  ('privatkredit_007', 'privatkredit', 5, 'Herr Pfad war schnell, direkt und hat uns geholfen, die Unterlagen passend aufzubereiten.', 'W. S.', 'Münster', '2025-12-03', true),
  ('privatkredit_008', 'privatkredit', 5, 'Frau Müller hat uns bei einem kleineren Ratenkredit unterstützt. Besonders gut: die Online-Ablage, alles an einem Ort.', 'R. T.', 'Düsseldorf', '2025-11-18', true),
  ('privatkredit_009', 'privatkredit', 5, 'Sehr professionell und freundlich. Digitale Unterschrift war für uns neu, aber echt easy.', 'A. H.', 'Potsdam', '2025-11-04', true),
  ('privatkredit_010', 'privatkredit', 4, 'Schnell und unkompliziert. Für uns wäre eine kurze Übersicht “so läuft’s” am Anfang noch hilfreich gewesen – ansonsten super.', 'U. P.', 'Wuppertal', '2025-10-21', true),
  ('privatkredit_011', 'privatkredit', 5, 'Herr Wagner hat uns bei der Umschuldung geholfen. Am Ende zahlen wir weniger und haben alles in einem Kredit gebündelt.', 'K. F.', 'Ulm', '2025-10-02', true),
  ('privatkredit_012', 'privatkredit', 5, 'Herr Pfad hat sehr effizient gearbeitet und war bei Rückfragen schnell da.', 'S. D.', 'Heilbronn', '2025-09-17', true),
  ('privatkredit_013', 'privatkredit', 5, 'Frau Müller hat alles verständlich erklärt, ohne Fachchinesisch. Sehr angenehm.', 'R. L.', 'Bochum', '2025-08-29', true),
  ('privatkredit_014', 'privatkredit', 5, 'Online-Ablage und Status im Prozess waren super. Ich wusste immer, wo wir gerade stehen.', 'C. D.', 'Mainz', '2025-08-14', true),
  ('privatkredit_015', 'privatkredit', 5, 'Herr Wagner hat uns mehrere Laufzeiten gezeigt und erklärt, was das für Rate/Gesamtkosten bedeutet.', 'P. H.', 'Essen', '2025-07-31', true),
  ('privatkredit_016', 'privatkredit', 5, 'Herr Pfad war gut erreichbar und hat schnell reagiert. Das hat uns sehr geholfen, weil es eilig war.', 'V. S.', 'Saarbrücken', '2025-07-09', true),
  ('privatkredit_017', 'privatkredit', 5, 'Frau Müller hat eine klare Checkliste gemacht. Dadurch war der ganze Prozess wirklich entspannt.', 'D. M.', 'Kassel', '2025-06-27', true),
  ('privatkredit_018', 'privatkredit', 4, 'Sehr gut erklärt. Wir hätten nur gern noch 1–2 Tipps zur optimalen Laufzeit gehabt, aber insgesamt sehr zufrieden.', 'L. B.', 'Aachen', '2025-06-11', true),
  ('privatkredit_019', 'privatkredit', 5, 'Herr Wagner hat uns geholfen, eine Rate zu finden, die gut passt. Nicht zu knapp gerechnet, sondern mit Puffer.', 'E. W.', 'Paderborn', '2025-05-30', true),
  ('privatkredit_020', 'privatkredit', 5, 'Herr Pfad hat sofort Struktur reingebracht und den Kredit zügig auf den Weg gebracht.', 'A. M.', 'Hamburg', '2025-05-21', true),
  ('privatkredit_021', 'privatkredit', 4, 'Alles lief reibungslos. Ein kurzes Update zwischendurch wäre nett gewesen, aber insgesamt sehr gut.', 'P. W.', 'Darmstadt', '2025-05-07', true),
  ('privatkredit_022', 'privatkredit', 5, 'Komplett digital und unkompliziert. Digitale Signatur hat bei uns perfekt funktioniert.', 'F. P.', 'Flensburg', '2025-04-24', true),
  ('privatkredit_023', 'privatkredit', 5, 'Herr Wagner hat uns bei einem Autokredit beraten und verschiedene Optionen verglichen. Sehr solide.', 'G. N.', 'Bonn', '2025-04-09', true),
  ('privatkredit_024', 'privatkredit', 5, 'Frau Müller war super geduldig, auch wenn wir viele Nachfragen hatten.', 'I. K.', 'Lübeck', '2025-03-18', true),
  ('privatkredit_025', 'privatkredit', 5, 'Herr Pfad war klar und direkt, ohne Druck. Genau so wollten wir’s.', 'S. K.', 'Hannover', '2025-02-27', true),
  ('privatkredit_026', 'privatkredit', 4, 'Sehr gute Begleitung. Für uns wäre ein kurzer Start-Call zur Orientierung noch das i-Tüpfelchen gewesen – sonst top.', 'J. S.', 'Osnabrück', '2025-02-12', true),
  ('privatkredit_027', 'privatkredit', 5, 'Herr Wagner war gut erreichbar und hat sich Zeit genommen. Ergebnis war genau passend für uns.', 'H. M.', 'Koblenz', '2025-01-29', true),
  ('privatkredit_028', 'privatkredit', 5, 'Sehr seriös und transparent. Wir hatten von Anfang an ein gutes Gefühl.', 'M. R.', 'Bonn', '2025-01-15', true),
  ('privatkredit_029', 'privatkredit', 5, 'Frau Müller hat uns beim ersten Ratenkredit begleitet. Verständlich erklärt und sauber umgesetzt.', 'T. H.', 'Trier', '2025-01-09', true),
  ('privatkredit_030', 'privatkredit', 5, 'Herr Pfad hat uns bei einer Umschuldung geholfen. Alles gebündelt, bessere Übersicht und die Rate passt.', 'N. S.', 'Magdeburg', '2025-11-06', true),
  ('privatkredit_031', 'privatkredit', 4, 'Frau Müller war sehr freundlich und verbindlich. Ein kleines Zwischenfeedback mehr wäre schön, aber insgesamt super.', 'O. R.', 'Augsburg', '2025-09-23', true),
  ('privatkredit_032', 'privatkredit', 5, 'Herr Wagner hat wirklich klare Vergleiche gemacht und nichts “aufgeschwatzt”. Sehr angenehm.', 'F. B.', 'Frankfurt am Main', '2025-08-05', true),
  ('privatkredit_033', 'privatkredit', 5, 'Im Portal sieht man gut, was noch fehlt. Das macht es viel einfacher als E-Mail Pingpong.', 'J. N.', 'Ingolstadt', '2025-07-02', true),
  ('privatkredit_034', 'privatkredit', 5, 'Herr Pfad hat uns sehr geholfen, die Unterlagen sauber aufzubereiten. Danach ging es schnell durch.', 'H. B.', 'Hildesheim', '2025-06-16', true),
  ('privatkredit_035', 'privatkredit', 5, 'Frau Müller hat uns gut begleitet und war immer nett. Für mich war das das erste mal, und es war echt easy.', 'C. H.', 'Bamberg', '2025-05-08', true),
  ('privatkredit_036', 'privatkredit', 5, 'Herr Wagner hat auch erklärt, wie wir Laufzeit und Rate sinnvoll wählen. Das war für uns wichtig.', 'L. T.', 'Lünen', '2025-04-26', true),
  ('privatkredit_037', 'privatkredit', 5, 'Herr Pfad hat richtig schnell gearbeitet, das hat uns geholfen weil es zeitkritisch war.', 'E. A.', 'Rostock', '2025-03-13', true),
  ('privatkredit_038', 'privatkredit', 5, 'Frau Müller hat das alles gut erklärt und wir konnten die dokumente einfach hochladen. Sehr angenehm.', 'N. G.', 'Nürnberg', '2025-02-20', true),
  ('privatkredit_039', 'privatkredit', 5, 'Herr Wagner hat verschiedene Laufzeiten gezeigt und nix aufgedrängt. Top Beratung.', 'K. L.', 'Stuttgart', '2025-02-04', true),
  ('privatkredit_040', 'privatkredit', 4, 'Digitale Signatur hat bei uns erst kurz gehakt (lag an meinem Handy), aber dann lief alles.', 'F. F.', 'Falkensee', '2025-01-22', true)
on conflict (seed_key) do update
set
  category = excluded.category,
  rating = excluded.rating,
  quote = excluded.quote,
  reviewer_initials = excluded.reviewer_initials,
  reviewer_city = excluded.reviewer_city,
  reviewed_on = excluded.reviewed_on,
  is_published = excluded.is_published,
  updated_at = now();

commit;
