begin;

alter table public.website_reviews
  drop constraint if exists website_reviews_category_check;

alter table public.website_reviews
  add constraint website_reviews_category_check
  check (category in ('baufi', 'privatkredit', 'schufa_frei'));

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
  ('schufa_frei_001', 'schufa_frei', 5, 'Nach negativer Schufa war das die erste Strecke, die überhaupt nachvollziehbar wirkte. Der Einstieg ohne Einkommensangabe hat uns sehr geholfen.', 'M. K.', 'Hamburg', '2026-04-14', true),
  ('schufa_frei_002', 'schufa_frei', 4, 'Gut gelöst, weil zuerst nur die wichtigsten Eckdaten gefragt wurden. Das hat die Hürde deutlich kleiner gemacht.', 'S. B.', 'Bremen', '2026-04-10', true),
  ('schufa_frei_003', 'schufa_frei', 5, 'Herr Pfad hat den Ablauf klar erklärt und nichts beschönigt. Genau das wollten wir.', 'L. R.', 'Hannover', '2026-04-06', true),
  ('schufa_frei_004', 'schufa_frei', 5, 'Die Vorprüfung war schnell da und wir wussten sofort, wie es weitergeht.', 'T. H.', 'Kiel', '2026-04-02', true),
  ('schufa_frei_005', 'schufa_frei', 5, 'Besonders gut fand ich, dass keine IBAN direkt am Anfang nötig war.', 'J. F.', 'Lübeck', '2026-03-29', true),
  ('schufa_frei_006', 'schufa_frei', 5, 'Frau Müller hat meine Rückfragen zur Serviceprovision ruhig erklärt. Dadurch war das für mich transparent.', 'N. W.', 'Rostock', '2026-03-25', true),
  ('schufa_frei_007', 'schufa_frei', 5, 'Trotz negativer Schufa hatte ich endlich das Gefühl, dass mein Fall sauber eingeordnet wird.', 'D. S.', 'Berlin', '2026-03-21', true),
  ('schufa_frei_008', 'schufa_frei', 5, 'Die Strecke war deutlich diskreter als die üblichen Portale. Das war für mich der wichtigste Punkt.', 'C. L.', 'Potsdam', '2026-03-17', true),
  ('schufa_frei_009', 'schufa_frei', 5, 'Herr Wagner hat realistisch erklärt, welche Variante passen kann und wo die Grenzen sind.', 'P. G.', 'Leipzig', '2026-03-13', true),
  ('schufa_frei_010', 'schufa_frei', 4, 'Kein unnötiges Standardformular am Anfang. Erst prüfen, dann die sensiblen Daten.', 'A. M.', 'Dresden', '2026-03-09', true),
  ('schufa_frei_011', 'schufa_frei', 5, 'Ich fand gut, dass Einkommen und Unterlagen erst später gebraucht wurden.', 'K. T.', 'Erfurt', '2026-03-05', true),
  ('schufa_frei_012', 'schufa_frei', 5, 'Die Kommunikation war klar und sachlich. Keine leeren Versprechen, sondern saubere Schritte.', 'F. B.', 'Magdeburg', '2026-03-01', true),
  ('schufa_frei_013', 'schufa_frei', 5, 'Die erste Einschätzung kam schnell und der weitere Antrag war logisch aufgebaut.', 'R. H.', 'Braunschweig', '2026-02-25', true),
  ('schufa_frei_014', 'schufa_frei', 5, 'Sehr angenehm, weil ich nicht direkt alle sensiblen Daten abgeben musste.', 'E. K.', 'Osnabrück', '2026-02-21', true),
  ('schufa_frei_015', 'schufa_frei', 4, 'Die Beratung war strukturiert und gerade bei negativer Schufa sehr respektvoll.', 'H. P.', 'Münster', '2026-02-17', true),
  ('schufa_frei_016', 'schufa_frei', 5, 'Herr Pfad hat mir genau erklärt, warum zuerst nur die Vorprüfung läuft. Das war nachvollziehbar.', 'I. S.', 'Dortmund', '2026-02-13', true),
  ('schufa_frei_017', 'schufa_frei', 5, 'Frau Müller war gut erreichbar und hat alles verständlich erklärt.', 'G. N.', 'Bochum', '2026-02-09', true),
  ('schufa_frei_018', 'schufa_frei', 5, 'Online abschließbar und trotzdem persönlich begleitet. Das hat für mich gut zusammengepasst.', 'O. D.', 'Essen', '2026-02-05', true),
  ('schufa_frei_019', 'schufa_frei', 5, 'Die Strecke war für meinen Fall viel passender als ein normaler Kreditvergleich.', 'V. J.', 'Düsseldorf', '2026-02-01', true),
  ('schufa_frei_020', 'schufa_frei', 5, 'Gut fand ich die klare Trennung zwischen Vorprüfung und vollständigem Antrag.', 'U. R.', 'Köln', '2026-01-28', true),
  ('schufa_frei_021', 'schufa_frei', 4, 'Auch bei Rückfragen zur Laufzeit bekam ich schnell eine klare Antwort.', 'B. Z.', 'Bonn', '2026-01-24', true),
  ('schufa_frei_022', 'schufa_frei', 5, 'Die Hinweise zu Serviceprovision und Ablauf waren transparent dargestellt.', 'W. E.', 'Aachen', '2026-01-20', true),
  ('schufa_frei_023', 'schufa_frei', 5, 'Ich hatte Sorge wegen negativer Schufa, wurde aber von Anfang an fair behandelt.', 'M. L.', 'Mainz', '2026-01-16', true),
  ('schufa_frei_024', 'schufa_frei', 5, 'Sehr diskrete Anfrage ohne unnötigen Druck. Genau so sollte es sein.', 'S. T.', 'Wiesbaden', '2026-01-12', true),
  ('schufa_frei_025', 'schufa_frei', 5, 'Die Vorprüfung war unkompliziert und die nächsten Schritte waren direkt verständlich.', 'L. A.', 'Frankfurt am Main', '2026-01-08', true),
  ('schufa_frei_026', 'schufa_frei', 5, 'Herr Wagner hat nichts aufgedrängt und sauber erklärt, welche Strecke für mich Sinn ergibt.', 'D. F.', 'Kassel', '2026-01-04', true),
  ('schufa_frei_027', 'schufa_frei', 4, 'Dass keine IBAN sofort nötig war, hat mir ein besseres Gefühl gegeben.', 'P. W.', 'Stuttgart', '2025-12-31', true),
  ('schufa_frei_028', 'schufa_frei', 5, 'Die gesamte Strecke wirkte deutlich aufgeräumter als bei anderen Anbietern.', 'J. R.', 'Nürnberg', '2025-12-27', true),
  ('schufa_frei_029', 'schufa_frei', 5, 'Frau Müller hat den Prozess ruhig begleitet und Fragen schnell beantwortet.', 'M. K.', 'Hamburg', '2025-12-23', true),
  ('schufa_frei_030', 'schufa_frei', 5, 'Für einen sensiblen Fall war das genau die richtige Ansprache: klar, diskret und digital.', 'S. B.', 'Bremen', '2025-12-19', true),
  ('schufa_frei_031', 'schufa_frei', 5, 'Ich konnte erst prüfen lassen, ob es grundsätzlich passt. Das war für mich entscheidend.', 'L. R.', 'Hannover', '2025-12-15', true),
  ('schufa_frei_032', 'schufa_frei', 4, 'Die Kombination aus Vorprüfung und späterem Vollantrag fand ich sehr sinnvoll.', 'T. H.', 'Kiel', '2025-12-11', true),
  ('schufa_frei_033', 'schufa_frei', 5, 'Herr Pfad hat mir direkt die Hürde genommen, weil nicht sofort alle Unterlagen verlangt wurden.', 'J. F.', 'Lübeck', '2025-12-07', true),
  ('schufa_frei_034', 'schufa_frei', 5, 'Sehr gute Begleitung trotz komplizierter Ausgangslage.', 'N. W.', 'Rostock', '2025-12-03', true),
  ('schufa_frei_035', 'schufa_frei', 5, 'Die Strecke war sauber aufgebaut und die Rückmeldung kam schneller als erwartet.', 'D. S.', 'Berlin', '2025-11-29', true),
  ('schufa_frei_036', 'schufa_frei', 5, 'Man merkt, dass das kein normales Vergleichsformular ist. Für meinen Fall war das besser.', 'C. L.', 'Potsdam', '2025-11-25', true),
  ('schufa_frei_037', 'schufa_frei', 5, 'Positiv fand ich die sachliche Kommunikation ohne Druck.', 'P. G.', 'Leipzig', '2025-11-21', true),
  ('schufa_frei_038', 'schufa_frei', 4, 'Die Vorprüfung ohne Einkommensangabe war für mich der Hauptgrund, hier anzufragen.', 'A. M.', 'Dresden', '2025-11-17', true),
  ('schufa_frei_039', 'schufa_frei', 5, 'Herr Wagner hat meine Fragen zur Rate und Laufzeit verständlich beantwortet.', 'K. T.', 'Erfurt', '2025-11-13', true),
  ('schufa_frei_040', 'schufa_frei', 5, 'Die digitale Strecke war einfach bedienbar und trotzdem persönlich genug.', 'F. B.', 'Magdeburg', '2025-11-09', true),
  ('schufa_frei_041', 'schufa_frei', 5, 'Trotz negativer Schufa hatte ich endlich einen klaren Ablauf vor Augen.', 'R. H.', 'Braunschweig', '2025-11-05', true),
  ('schufa_frei_042', 'schufa_frei', 5, 'Frau Müller hat mir die nächsten Schritte sauber erklärt. Dadurch war der Prozess entspannt.', 'E. K.', 'Osnabrück', '2025-11-01', true),
  ('schufa_frei_043', 'schufa_frei', 4, 'Die Serviceprovision wurde offen erklärt. Das war wichtig, weil ich dazu erst Bedenken hatte.', 'H. P.', 'Münster', '2025-10-28', true),
  ('schufa_frei_044', 'schufa_frei', 5, 'Die Strecke wirkte diskret und professionell. Genau das habe ich gesucht.', 'I. S.', 'Dortmund', '2025-10-24', true),
  ('schufa_frei_045', 'schufa_frei', 5, 'Nicht gleich alles hochladen zu müssen, war für mich ein großer Pluspunkt.', 'G. N.', 'Bochum', '2025-10-20', true),
  ('schufa_frei_046', 'schufa_frei', 5, 'Herr Pfad hat realistisch eingeordnet, was möglich ist und was nicht. Sehr seriös.', 'O. D.', 'Essen', '2025-10-16', true),
  ('schufa_frei_047', 'schufa_frei', 5, 'Ich fand die Vorprüfung deutlich angenehmer als die üblichen Kreditanfragen.', 'V. J.', 'Düsseldorf', '2025-10-12', true),
  ('schufa_frei_048', 'schufa_frei', 5, 'Gut aufgebaut, schnell verständlich und ohne unnötige Hürden.', 'U. R.', 'Köln', '2025-10-08', true),
  ('schufa_frei_049', 'schufa_frei', 4, 'Herr Wagner war freundlich und klar in der Einschätzung.', 'B. Z.', 'Bonn', '2025-10-04', true),
  ('schufa_frei_050', 'schufa_frei', 5, 'Für Kredit trotz negativer Schufa war das bisher die beste Strecke, die ich gesehen habe.', 'W. E.', 'Aachen', '2025-09-30', true),
  ('schufa_frei_051', 'schufa_frei', 5, 'Die ersten Schritte waren schnell erledigt und trotzdem nicht oberflächlich.', 'M. L.', 'Mainz', '2025-09-26', true),
  ('schufa_frei_052', 'schufa_frei', 5, 'Frau Müller hat mir sofort das Gefühl gegeben, dass mein Fall ernst genommen wird.', 'S. T.', 'Wiesbaden', '2025-09-22', true),
  ('schufa_frei_053', 'schufa_frei', 5, 'Die Online-Strecke war sauber aufgebaut und die Rückfragen wurden schnell geklärt.', 'L. A.', 'Frankfurt am Main', '2025-09-18', true),
  ('schufa_frei_054', 'schufa_frei', 4, 'Ich mochte besonders, dass erst nach positiver Vorprüfung mehr Daten nötig waren.', 'D. F.', 'Kassel', '2025-09-14', true),
  ('schufa_frei_055', 'schufa_frei', 5, 'Diskreter Einstieg, klare Rückmeldung und nachvollziehbarer Ablauf.', 'P. W.', 'Stuttgart', '2025-09-10', true),
  ('schufa_frei_056', 'schufa_frei', 5, 'Für Kredit ohne Schufa war die Strecke überraschend klar und professionell.', 'J. R.', 'Nürnberg', '2025-09-06', true)
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
