# Partnerschaftsvertrag für Baufinanzierungspartner

Das Dashboard `/tippgeber` erinnert aktive Baufinanzierungspartner (`classic`, einschließlich bisheriger Null-Werte) ohne unterzeichneten Vertrag mit einem Dialog. „Später“ schließt nur das aktuelle Fenster. Privatkreditpartner und die Adminansicht erhalten diese Erinnerung nicht. Der Abschluss wird serverseitig gespeichert und gilt über Browser und Anmeldungen hinweg.

Unter `/tippgeber/einstellungen` stehen Partnerdaten und der unterschriebene Vertrag bereit. Name der unterschreibenden Person, Firma, Anschrift, Kontozuordnung, Vertragsfassung, Zustimmung, Unterschriftslinien und der Zeitpunkt gehören zur gespeicherten Fassung. Der PDF-Download liefert die ursprünglichen Bytes; Profiländerungen oder spätere Änderungen an der Vertragsvorlage wirken sich nicht auf bereits unterzeichnete Exemplare aus.

## Vereinbarte Bedingungen

- Der Partner erhält 25 % des tatsächlichen Provisionszuflusses bei SEPANA für seine zugeordneten, ausgezahlten Baufinanzierungen. Eventuelle Umsatzsteuer der Partnerleistung ist in den 25 % enthalten.
- Die Vorlage enthält ein Beispiel mit 10.000 EUR Provisionszufluss und 2.500 EUR Gesamtvergütung sowie eine Regelung für steuerfreie Leistungen/Kleinunternehmer.
- Ergänzte Standardbedingungen: Zahlung binnen 14 Kalendertagen nach Erfüllung der Voraussetzungen; Kündigungsfrist 14 Kalendertage; nachgewiesene Rückforderungen mit 30 Kalendertagen Zahlungsfrist; Fortbestand von Ansprüchen für vor Vertragsende zugeordnete Leads.
- Der Vertragstext ist ein Entwurf für die unternehmerische Tippgeber-Zusammenarbeit und sollte vor produktivem Einsatz juristisch und steuerlich geprüft werden. Er ändert die bestehende Provisionsberechnung und manuelle Auszahlungsfreigabe nicht.

Bei der Formulierung berücksichtigt: [vereinbarte elektronische Form, § 127 BGB](https://www.gesetze-im-internet.de/bgb/__127.html), [Kleinunternehmerregelung, § 19 UStG](https://www.gesetze-im-internet.de/ustg_1980/__19.html) und [Erlaubnispflicht für Immobiliardarlehensvermittlung/-beratung, § 34i GewO](https://www.gesetze-im-internet.de/gewo/__34i.html). Die gezeichnete Unterschrift wird als einfache elektronische Annahme dokumentiert; es wird keine qualifizierte elektronische Signatur behauptet.

## Speicherung und Betrieb

Migration: `supabase/migrations/20260907053936_tippgeber_partnership_agreements.sql`. Am 7. September 2026 auf dem verbundenen SEPANA-Projekt angewendet. Die Anwendung benötigt diese Migration vor der Bereitstellung des Vertragsablaufs.

Die Tabelle `tippgeber_partnership_agreements` speichert Dokument, Signatur und PDF in einem atomaren Insert. `user_id` ist eindeutig. Bereits abgeschlossene Vorgänge werden bei Wiederholungen zurückgegeben. Die PDF-Erstellung erfolgt vor dem Insert; bei einem Fehler entsteht kein unterschriebener Status ohne PDF. Ein SHA-256-Abgleich stellt sicher, dass zwischen Vorschau und Unterzeichnung keine Vertrags- oder Partnerdaten ausgetauscht werden. PDF-Prüfsummen werden zusätzlich beim Insert in der Datenbank und beim Download geprüft.

Anonyme Rollen erhalten keinen Tabellenzugriff; angemeldete Nutzer dürfen nur ihren eigenen Datensatz lesen. Browser können keine Unterschriften schreiben oder ändern. Nur der Server darf nach Rollen-, Aktivitäts- und Kontoprüfung einfügen. Ein Trigger verhindert Updates und Löschungen. Eine spätere Umsetzung von Aufbewahrungsfristen und berechtigten Löschungen benötigt einen gesonderten administrativen Ablauf.

Die Noto-Sans-Schriften samt OFL-Lizenz liegen in `lib/tippgeber/fonts` und werden über `outputFileTracingIncludes` in das Deployment aufgenommen. Die PDFs werden lokal mit `pdf-lib` und `@pdf-lib/fontkit` erzeugt.

## Verifikation

Automatisierte Tests: `npx --yes tsx --test lib/tippgeber/partnershipAgreement.test.ts`.

Alle fünf Tests, TypeScript und ESLint für die geänderten Komponenten/Module sind erfolgreich. Der vollständige Produktionsbuild lief mit lokalen Test-Verbindungsdaten durch. Die beiden Vertragsfonts sind im erzeugten Deployment-Trace enthalten. Der Build meldet weiterhin einen Hinweis zur bereits bestehenden `pdfjs-dist`-Worker-Konfiguration in `components/case`; die neue PDF-Erzeugung nutzt diesen Worker nicht.

Der SQL-Test `supabase/tests/tippgeber_partnership_agreements.sql` prüft in einer zurückgerollten Transaktion die Eigentümerzuordnung, fehlende Schreibrechte, den Änderungsschutz und die Eindeutigkeit. Er wurde erfolgreich auf dem SEPANA-Projekt ausgeführt; anschließend wurden null verbleibende Testnutzer und null unterzeichnete Verträge bestätigt. Der Supabase-Advisor meldet keine Hinweise zu den neuen Vertragsobjekten; andere vorhandene Hinweise im Projekt gehören nicht zu dieser Änderung.

Der lokale Browser-Test verwendet das echte Dashboard, die Einstellungsseite und die API-Routen mit einem lokalen Supabase-Transport und synthetischen Partnerdaten. Geprüft wurden mobile Darstellung (390 × 844), vollständige Vorschau, gezeichnete Unterschrift, Speicherung, erneut geladenes Dashboard ohne Popup, PDF-Download, wiederholte Unterzeichnung und verweigerter Zugriff ohne Anmeldung. Die heruntergeladene PDF stimmt bytegenau mit der gespeicherten Datei überein. Alle Absätze und neun Vertragsabschnitte wurden aus der vierseitigen PDF extrahiert und alle Seiten visuell geprüft.
