begin;

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
  ('baufi_042', 'baufi', 5, 'Sehr strukturierte Beratung. Herr Pfad hat unsere Unterlagen vorab geprüft, dadurch ging es bei der Bank deutlich schneller.', 'L. K.', 'Hannover', '2025-12-28', true),
  ('baufi_043', 'baufi', 5, 'Frau Müller hat uns ruhig und verständlich durch die Baufinanzierung geführt. Besonders das Portal war sehr übersichtlich.', 'A. B.', 'Bremen', '2025-12-17', true),
  ('baufi_044', 'baufi', 5, 'Herr Wagner hat verschiedene Finanzierungsmodelle erklärt und nichts aufgedrängt. Das war uns wichtig.', 'S. T.', 'Köln', '2025-12-09', true),
  ('baufi_045', 'baufi', 5, 'Sehr gute Begleitung vom Erstgespräch bis zur Zusage. Kommunikation war klar und transparent.', 'N. R.', 'Dortmund', '2025-12-01', true),
  ('baufi_046', 'baufi', 5, 'Die digitale Ablage hat uns sehr geholfen, weil wir alle Dokumente gesammelt hochladen konnten.', 'F. H.', 'Hamburg', '2025-11-24', true),
  ('baufi_047', 'baufi', 5, 'Herr Pfad war sehr effizient und lösungsorientiert. Wir hatten jederzeit das Gefühl, gut betreut zu sein.', 'T. S.', 'Osnabrück', '2025-11-13', true),
  ('baufi_048', 'baufi', 5, 'Frau Müller hat alles verständlich erklärt, auch für uns als Erstkäufer.', 'J. M.', 'Kiel', '2025-11-04', true),
  ('baufi_049', 'baufi', 4, 'Sehr gute Beratung. Ein kleines Zwischenupdate mehr wäre schön gewesen, aber insgesamt wirklich top.', 'D. W.', 'Essen', '2025-10-29', true),
  ('baufi_050', 'baufi', 5, 'Herr Wagner hat den Zeitplan bis zum Notartermin sehr gut im Blick gehabt. Das hat uns viel Stress erspart.', 'P. F.', 'Stuttgart', '2025-10-21', true),
  ('baufi_051', 'baufi', 5, 'Von Anfang an sehr professionell. Besonders die ehrliche Einschätzung zur Tragbarkeit war hilfreich.', 'C. L.', 'Leipzig', '2025-10-08', true),
  ('baufi_052', 'baufi', 5, 'Herr Pfad hat unsere Finanzierung sauber strukturiert und verschiedene Zinsbindungen verglichen.', 'R. K.', 'Kassel', '2025-09-30', true),
  ('baufi_053', 'baufi', 5, 'Frau Müller war jederzeit freundlich und sehr geduldig bei Rückfragen.', 'E. S.', 'Mainz', '2025-09-18', true),
  ('baufi_054', 'baufi', 5, 'Sehr angenehme Zusammenarbeit. Alles digital und ohne unnötigen Papierkram.', 'M. D.', 'Augsburg', '2025-09-06', true),
  ('baufi_055', 'baufi', 5, 'Herr Wagner hat uns mehrere Banken gegenübergestellt und verständlich erklärt, wo die Unterschiede liegen.', 'B. G.', 'Ulm', '2025-08-26', true),
  ('baufi_056', 'baufi', 5, 'Die Online-Ablage und digitale Signatur haben den Prozess deutlich vereinfacht.', 'H. N.', 'Lübeck', '2025-08-14', true),
  ('baufi_057', 'baufi', 5, 'Sehr kompetente Beratung und schnelle Rückmeldungen per Mail.', 'K. A.', 'Bonn', '2025-08-02', true),
  ('baufi_058', 'baufi', 5, 'Herr Pfad hat auch kurzfristig auf Bankrückfragen reagiert. Das hat den Ablauf sehr beschleunigt.', 'S. E.', 'Frankfurt am Main', '2025-07-23', true),
  ('baufi_059', 'baufi', 5, 'Frau Müller hat uns realistisch beraten und keine zu optimistischen Versprechen gemacht. Sehr seriös.', 'L. W.', 'Bielefeld', '2025-07-11', true),
  ('baufi_060', 'baufi', 5, 'Sehr gute Begleitung bei der Finanzierung unseres Neubaus.', 'G. P.', 'Nürnberg', '2025-06-30', true),
  ('baufi_061', 'baufi', 5, 'Alles lief strukturiert und nachvollziehbar. Wir wussten immer, welcher Schritt als Nächstes kommt.', 'U. H.', 'Freiburg', '2025-06-19', true),
  ('baufi_062', 'baufi', 5, 'Herr Wagner war gut erreichbar und hat sich Zeit für unsere Fragen genommen.', 'T. B.', 'Hannover', '2025-06-05', true),
  ('baufi_063', 'baufi', 5, 'Sehr moderne Abwicklung. Upload der Unterlagen war unkompliziert und sicher.', 'J. R.', 'Düsseldorf', '2025-05-27', true),
  ('baufi_064', 'baufi', 5, 'Die Beratung war sehr klar und strukturiert, besonders bei der Einschätzung der monatlichen Rate.', 'M. S.', 'Chemnitz', '2025-05-15', true),
  ('baufi_065', 'baufi', 5, 'Herr Pfad hat uns geholfen, die Finanzierung optimal auf unsere Situation anzupassen.', 'F. L.', 'Rostock', '2025-05-03', true),
  ('baufi_066', 'baufi', 5, 'Sehr gute Kommunikation und transparente Schritte im gesamten Prozess.', 'N. T.', 'Potsdam', '2025-04-22', true),
  ('baufi_067', 'baufi', 5, 'Frau Müller hat uns sehr sicher durch die gesamte Baufinanzierung begleitet.', 'A. K.', 'Hamburg', '2025-04-09', true),
  ('baufi_068', 'baufi', 4, 'Gute Beratung und angenehme Zusammenarbeit. Ein kurzer Überblick zu Beginn wäre noch hilfreich gewesen.', 'D. L.', 'Wiesbaden', '2025-03-26', true),
  ('baufi_069', 'baufi', 5, 'Herr Wagner hat die Finanzierung vorausschauend geplant (Puffer, Nebenkosten etc.).', 'P. M.', 'Regensburg', '2025-03-12', true),
  ('baufi_070', 'baufi', 5, 'Sehr professionelle Abwicklung und schnelle Bearbeitung der Unterlagen.', 'C. F.', 'Aachen', '2025-02-25', true),
  ('baufi_071', 'baufi', 5, 'Wir fühlten uns jederzeit gut beraten und informiert. Klare Empfehlung.', 'S. N.', 'Münster', '2025-01-08', true)
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
