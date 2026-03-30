# Europace Privatkredit Integration

Stand: 2026-03-20

Dieses Dokument ist als Handoff fuer den naechsten Coding-Agent gedacht.
Es beschreibt:

- was bereits umgesetzt ist
- was fachlich fest entschieden ist
- welche Dateien heute relevant sind
- wo die naechste Arbeit beginnen sollte
- welche Dinge nicht versehentlich wieder kaputt refaktoriert werden duerfen

## Kurzfassung

SEPANA soll fuer `case_type = konsum` die Benutzeroberflaeche bleiben, waehrend Europace die fachliche Truth fuer Privatkredit wird:

- Vorgang
- Angebotsberechnung
- Angebotsannahme / Antrag
- Dokumente / Unterlagen
- Status

Wichtig:

- Fuer `konsum` soll keine manuelle SEPANA-Angebotslogik mehr die Primaerquelle sein.
- Europace ist nicht ein einzelner API-Host. Import, Vorgangs-Updates, Export, Angebote und Unterlagen laufen getrennt.
- Der aktuelle Repo-Stand ist ein funktionierendes Fundament mit echtem Sync, Angebots-Cache, Angebotsannahme und erstem Dokumentenspiegel.

## Was bereits umgesetzt ist

### Datenbank

Die SQL-Migration ist geschrieben und laut Benutzer bereits auf Supabase ausgefuehrt:

- `sql/2026-03-17_europace_privatkredit_foundation.sql`

Vorhandene Tabellen:

- `case_europace`
- `case_europace_applicants`
- `case_europace_offers`
- `case_europace_documents`
- `case_europace_sync_events`

Zusaetzliche Onlinekredit-Migrationen seitdem:

- `sql/2026-03-20_onlinekredit_term_months.sql`
- `sql/2026-03-20_case_additional_details_children_support.sql`
- `sql/2026-03-20_onlinekredit_case_applicants_extended_fields.sql`
- `sql/2026-03-20_onlinekredit_previous_address.sql`
- `sql/2026-03-20_onlinekredit_case_applicants_titles_and_household.sql`
- `sql/2026-03-20_onlinekredit_case_children_extended_fields.sql`
- `sql/2026-03-20_onlinekredit_case_liabilities.sql`
- `sql/2026-03-20_onlinekredit_case_real_estate_assets.sql`

### Europace Adapter

Unter `lib/europace/` existiert bereits die Basis:

- `config.ts`
- `auth.ts`
- `graphql.ts`
- `documents.ts`
- `types.ts`
- `case.ts`
- `mapper.ts`
- `import.ts`
- `update.ts`
- `export.ts`
- `offers.ts`
- `service.ts`
- `offerSync.ts`

Aktuell umgesetzt:

- OAuth Client Credentials mit Token-Cache
- optionales OAuth-Impersonation-Handling, wenn der registrierte Client-Partner von der fachlichen Privatkredit-Partner-ID abweicht
- REST-Import fuer neue Privatkredit-Vorgaenge
- GraphQL-Updates fuer:
  - `addAntragsteller`
  - `deleteAntragsteller`
  - `updatePersonendaten`
- `updateHerkunft`
- `updateWohnsituation`
- `updateBeschaeftigung`
- `updateKontoverbindung`
- `updateFinanzierungszweck`
- `updateFinanzierungswunsch`
- GraphQL-Export ueber `vorgang(vorgangsnummer: ...)`
- Angebotsabruf ueber `angebote(vorgangsnummer: ...)`
- Angebotsannahme ueber `angebotAnnehmen(...)`
- `annahmeJob(...)`-Abfrage mit Persistenz von Antrag und Jobstatus
- V2-Unterlagenupload als direkter Multipart-Datei-Upload ueber `POST /v2/dokumente`
- Remote-Delete fuer Europace-Dokumente
- manuelles Re-Assignment fuer Europace-Dokumentseiten
- Mapping lokaler Uploads nach `case_europace_documents`
- Sync-Event-Logging fuer Dokumentenuploads in `case_europace_sync_events`

### Bereits verdrahtete Produktpfade

#### Kunden-/Live-Draft

Datei:

- `app/api/live/case/route.ts`

Heute passiert dort bereits:

- lokale SEPANA-Daten werden gespeichert
- fuer `konsum` wird bei vorhandener Europace-Konfiguration automatisch ein Europace-Sync versucht
- falls noch kein `case_europace`-Mapping existiert, wird jetzt trotzdem synchronisiert, sobald Vor- und Nachname des Hauptantragstellers vorhanden sind
- der erste lokale Co-Antragsteller kann jetzt als `antragsteller2` in Europace angelegt, aktualisiert und wieder entfernt werden
- fuer `antragsteller2` werden jetzt nicht mehr nur Personendaten und Beschaeftigung, sondern auch Kontakt, Familienstand, Herkunft und Wohnsituation best-effort gespiegelt

Das bedeutet:

- der erste Europace-Import kann heute schon aus dem Live-/Kunden-Draft entstehen
- danach laufen Folgesyncs ueber denselben Weg

#### Advisor-Dashboard

Dateien:

- `app/(advisor)/advisor/faelle/[id]/page.tsx`
- `app/(advisor)/advisor/faelle/[id]/ui/EuropaceDocumentsCard.tsx`
- `app/(advisor)/advisor/faelle/[id]/ui/EuropaceSyncCard.tsx`
- `app/(advisor)/advisor/faelle/[id]/ui/EuropaceOffersCard.tsx`
- `app/api/advisor/privatkredit/europace/documents/route.ts`
- `app/api/advisor/privatkredit/europace/documents/assignment/route.ts`
- `app/api/advisor/privatkredit/europace/documents/delete/route.ts`
- `app/api/advisor/privatkredit/europace/documents/release/route.ts`
- `app/api/advisor/privatkredit/europace/status/route.ts`
- `app/api/advisor/privatkredit/europace/sync/route.ts`
- `app/api/advisor/privatkredit/europace/offers/route.ts`

Heute sichtbar:

- Europace-Sync-Karte fuer Vorgang / Antrag / letzten Fehler
- Europace-Status-Karte mit manuellem Refresh und clientseitigem Polling fuer laufende Antraege
- Europace-Angebots-Karte mit:
  - manuellem Refresh
  - Angebotsannahme
  - laufendem Jobstatus
- Europace-Unterlagen-Karte mit Live-Abruf der aktuell in Europace sichtbaren Dokumente
- in der Unterlagen-Karte sind jetzt auch Seiten, aktuelle Zuordnung und Freigabespuren sichtbar
- einzelne Europace-Dokumente koennen im Advisor-Dashboard jetzt manuell neu zugeordnet werden
- einzelne Europace-Dokumente koennen im Advisor-Dashboard jetzt direkt remote geloescht werden
- Europace-Unterlagen koennen nach Angebotsannahme direkt aus dem Advisor-Dashboard freigegeben werden
- manuelle SEPANA-Angebotserstellung ist im Advisor-Dashboard fuer `konsum` ausgeblendet

#### Kundenportal

Dateien:

- `app/(app)/app/page.tsx`
- `app/(app)/app/faelle/page.tsx`
- `app/(app)/app/faelle/[id]/page.tsx`
- `components/case/PrivatkreditJourneyPanel.tsx`
- `components/case/EuropaceCustomerOffersCard.tsx`
- `components/case/EuropaceStatusCard.tsx`
- `lib/europace/customerJourney.ts`
- `app/api/app/privatkredit/europace/offers/route.ts`
- `app/api/app/privatkredit/europace/offers/accept/route.ts`
- `app/api/app/privatkredit/europace/offers/job/route.ts`
- `app/api/app/privatkredit/europace/status/route.ts`

Heute sichtbar:

- Dashboard hat jetzt fuer den neuesten `konsum`-Fall einen klaren `Privatkredit fortsetzen`-CTA
- Fallliste verlinkt `konsum` direkt in den gefuehrten Journey-Flow statt nur in eine generische Detailansicht
- die Kunden-Fallseite fuer `konsum` ist jetzt in feste Abschnitte gegliedert:
  - Angaben
  - Live-Angebote
  - Unterlagen
  - Unterschrift
  - Status
- oberhalb der Fallseite gibt es jetzt ein echtes Journey-/CTA-Panel mit dem naechsten Schritt
- Kunden koennen live Europace-Angebote jetzt selbst aktiv neu berechnen
- Kunden sehen fuer `konsum` die gecachten Europace-Angebote direkt im Portal
- Kunden koennen ein vollstaendiges Europace-Angebot selbst annehmen
- online abschliessbare Angebote werden im Kundenportal direkt markiert
- der `annahmeJob` wird im Kundenportal gepollt
- bei Erfolg wird der erzeugte Antrag im Kundenportal sichtbar
- Kunden sehen den exportierten Europace-Antragsstatus direkt im Portal
- Kunden koennen den Europace-Status manuell aktualisieren; laufende Antraege pollen clientseitig
- `missing-summary` akzeptiert jetzt optional `caseId`, damit der Journey-Flow fuer einen konkreten Privatkredit-Fall berechnet werden kann

#### Oeffentlicher Einstieg

Dateien:

- `app/(website)/onlinekredit/page.tsx`
- `app/(website)/onlinekredit/antrag/page.tsx`
- `app/(website)/privatkredit/anfrage/page.tsx`
- `app/(website)/privatkredit/page.tsx`
- `components/onlinekredit/OnlinekreditAccessCard.tsx`
- `app/api/onlinekredit/europace/offers/route.ts`
- `app/api/onlinekredit/europace/offers/accept/route.ts`
- `app/api/onlinekredit/europace/offers/job/route.ts`
- `lib/onlinekredit/publicAccess.ts`
- `lib/onlinekredit/caseAccess.ts`
- `app/(website)/components/Header.tsx`
- `app/(website)/components/Footer.tsx`
- `app/sitemap.ts`

Heute gilt:

- die allgemeine `Kreditanfrage` unter `/kreditanfrage` bleibt bewusst der generische Website-Einstieg
- der produktive oeffentliche Privatkredit-Einstieg liegt jetzt unter `/onlinekredit`
- der alte Pfad `/privatkredit/anfrage` leitet auf `/onlinekredit` weiter
- produktbezogene Privatkredit-CTAs zeigen jetzt auf `/onlinekredit`, nicht mehr auf die generische `Kreditanfrage`
- `/onlinekredit` zeigt jetzt direkt den grossen gefuehrten Privatkredit-Wizard; ein vorgeschaltetes Mini-Formular gibt es dort nicht mehr
- der oeffentliche Vollantrag ist als eigener `OnlinekreditWizard` aufgebaut; das rohe `LiveCasePanel` wird dort bewusst nicht mehr direkt angezeigt
- der Wizard orientiert sich am gefuehrten `Kreditanfrage`-Prinzip, bleibt aber strikt privatkreditspezifisch und speichert direkt in denselben `konsum`-Fall
- dazu gehoeren auch Haushaltsdaten, Beschaeftigung und optional ein zweiter Kreditnehmer; Rueckruf-/Nachrichtenfelder sind aus dieser Strecke bewusst raus
- die Laufzeit (`term_months`) ist jetzt Pflichtbestandteil des oeffentlichen Privatkredit-Wizards und wird nach Europace als Teil des Finanzierungswunschs gemappt
- wenn `Wohnhaft seit` weniger als 3 Jahre zurueckliegt, blendet der Wizard jetzt automatisch eine Pflicht-`Voranschrift` ein und mappt sie auf `wohnsituation.voranschrift`
- Personendaten unterstuetzen jetzt auch `titel` (`DOKTOR` / `PROFESSOR`) fuer Haupt- und Zweitantragsteller
- fuer Antragsteller 2 wird jetzt abgefragt, ob die Wohnsituation mit Antragsteller 1 identisch ist; bei `nein` werden eigene Anschrift-, Haushalts- und Voranschrift-Felder gespeichert und auf `gemeinsamerHaushalt = false` gemappt
- Kinder im `Onlinekredit`-Wizard sind jetzt auf den KreditSmart-Shape vereinfacht: `Name`, `Kindergeld ja/nein`, `Unterhaltseinnahmen ja/nein` und bei zwei Antragstellern die Zuordnung `1 / 2 / Beide`; die Kinder werden als Europace-`Kind`-Positionen gespiegelt
- bestehende Verbindlichkeiten koennen jetzt im `Onlinekredit`-Wizard als echte KreditSmart-Haushaltspositionen erfasst werden:
  - `Ratenkredit`
  - `Dispositionskredit`
  - `Kreditkarte`
  - `Privates Leasing`
  - `Sonstige Verbindlichkeit`
- die Verbindlichkeiten werden lokal in `case_liabilities` gespeichert und im Europace-Sync best-effort als eigene Haushaltspositionen gespiegelt; der Sync arbeitet hier bewusst per `delete + add` pro Typ auf Basis des letzten Export-Snapshots
- eigenes Immobilienvermoegen kann jetzt ebenfalls im `Onlinekredit`-Wizard erfasst werden:
  - Immobilienart
  - Bezeichnung
  - Wert
  - Wohnflaeche
  - Nutzungsart
  - Antragsteller-Zuordnung
  - optionale Darlehen je Immobilie
- vermietete Immobilien blenden zusaetzliche Miet-/Flaechenfelder ein; lokal liegen diese Daten in `case_real_estate_assets` und `case_real_estate_loans`
- der Europace-Sync spiegelt Immobilien aktuell ebenfalls per `delete + add` auf `haushalt.immobilien`
- der initiale Start auf `/onlinekredit` legt beim ersten echten Speichern einen `konsum`-Fall an und arbeitet ab dann nur noch auf diesem einen Fall weiter
- der oeffentliche Antragslink ist signiert und nutzt `caseId + caseRef + access`, damit der Kunde denselben Fall vor dem Login weiterbearbeiten kann
- `/onlinekredit/antrag` bleibt als Alias/Deep-Link erhalten, rendert aber dieselbe oeffentliche Antragsansicht wie `/onlinekredit?caseId=...`
- der oeffentliche Flow ist jetzt in drei Seiten getrennt:
  - `/onlinekredit` -> Angaben/Wizard
  - `/onlinekredit/angebote` -> Live-Angebote mit Ruecksprung auf die Angaben
  - `/onlinekredit/abschluss` -> ausgewaehltes Angebot + finale Anfrage
- die oeffentliche Strecke hat eigene Europace-Offer-Endpunkte fuer:
  - Angebotsabruf
  - Angebotsannahme
  - `annahmeJob`-Polling
- fuer den oeffentlichen `Onlinekredit`-Flow wird der Kundenaccount jetzt beim ersten echten Speichern bereits angelegt, der Passwort-/Invite-Versand aber bewusst bis zur erfolgreichen finalen Angebotsannahme zurueckgehalten
- auf der Angebotsseite werden nur vollstaendige / waehlbare Angebote zur finalen Auswahl zugelassen
- wenn keine Angebote vorliegen, zeigt die Angebotsseite explizit, dass unter der aktuellen Konstellation kein Angebot moeglich ist; der Kunde kann dann direkt zum Formular zurueck
- nach finaler Angebotsannahme fuehrt die oeffentliche Strecke explizit in den Portalzugang:
  - bestehendes Konto -> Login
  - neues Konto -> Einladungslink / Invite-Resend
- `Onlinekredit` ist damit nicht mehr nur Marketing + Leadcapture, sondern der echte oeffentliche Start des Privatkredit-Self-Service

#### Dokumentenstrecke

Dateien:

- `lib/europace/documents.ts`
- `app/api/app/documents/upload/direct/route.ts`
- `app/api/app/documents/upload/route.ts`
- `app/api/app/documents/delete/route.ts`
- `components/case/DocumentPanel.tsx`
- `app/(advisor)/advisor/faelle/[id]/page.tsx`
- `app/(app)/app/faelle/[id]/page.tsx`
- `app/(admin)/admin/faelle/[id]/page.tsx`

Heute passiert dort bereits:

- lokale Uploads bleiben die Primaeraktion in SEPANA
- fuer `konsum` kommen die Upload-Ziele jetzt primaer aus Europace-`moeglichezuordnungen`
- nach lokal erfolgreichem Upload wird fuer `konsum` ein best-effort Europace-Upload versucht
- der Upload nutzt eine oeffentlich erreichbare URL ueber `/api/baufi/logo?...&raw=1`
- beim Upload werden, wenn vorhanden, Europace-`category` und `assignmentId` mitgegeben
- der lokale Upload wird nicht blockiert, wenn Europace den Dokumentensync ablehnt
- der Sync-Zustand pro Datei wird in `case_europace_documents` gespeichert
- Advisor-, Kunden- und Admin-Fallseiten zeigen fuer `konsum` den Europace-Status pro Datei an
- manuelle lokale Dokumentanforderungen sind fuer `konsum` serverseitig gesperrt
- lokale Dokument-Loeschungen versuchen fuer `konsum` jetzt zuerst einen echten Europace-Remote-Delete
- wenn kein Remote-Delete moeglich ist, werden bestehende Europace-Mappings weiterhin lokal als `local_deleted` markiert

#### Fall-Read-API

Datei:

- `app/api/app/cases/get/route.ts`

Heute liefert diese Route bereits:

- `europace`
- `europace_applications`
- `europace_offers`
- `europace_documents`
- `europace_upload_targets`

#### Serverseitiger Worker

Dateien:

- `lib/europace/worker.ts`
- `app/api/system/europace/sync/route.ts`
- `vercel.json`

Heute vorhanden:

- batchweises serverseitiges Polling fuer Europace-Privatkredit-Faelle
- laufende `annahmeJob`s werden serverseitig gepollt
- bestehende Antraege koennen serverseitig per Export-Refresh nachgezogen werden
- optional werden dabei auch Dokumentstatus und Freigaben serverseitig mit aktualisiert
- die Route ist ueber `Authorization: Bearer <CRON_SECRET>` oder `x-cron-secret` geschuetzt
- fuer Vercel ist eine sichere Daily-Cron-Verdrahtung als Default hinterlegt

### Build-Status

Zuletzt verifiziert:

- `npm run build` ist gruen

Nicht verifiziert:

- kein echter Live-Call gegen Europace
- keine End-to-End-Pruefung gegen Produktiv- oder Testtenant

## Fachliche Entscheidungen, die als gesetzt gelten

Diese Punkte bitte nicht versehentlich rueckgaengig machen:

### 1. Europace ist die Lending-Truth fuer Privatkredit

Fuer `konsum` sollen langfristig nicht lokal gepflegt werden:

- finale Angebote
- Angebotsstatus
- Dokumentpflichten
- fachliche Antragsstatus

Lokale Tabellen sind nur Cache / Mapping / UI-Unterstuetzung.

### 2. Import ist REST, nicht GraphQL

`import.ts` ist absichtlich ein REST-Call.
Nicht wieder auf einen generischen GraphQL-Host zurueckdrehen.

### 3. Es gibt mehrere Europace-Endpunkte

Aktuell erwartete Env-Variablen:

- `EUROPACE_TOKEN_URL`
- `EUROPACE_CLIENT_ID`
- `EUROPACE_CLIENT_SECRET`
- optional bei OAuth-Impersonation: `EUROPACE_CLIENT_PARTNER_ID`
- `EUROPACE_IMPORT_URL`
- optional: `EUROPACE_DATENKONTEXT`
- optional: `EUROPACE_IMPORT_ENVIRONMENT`
- `EUROPACE_VORGAENGE_API_URL`
- `EUROPACE_EXPORT_API_URL`
- `EUROPACE_ANGEBOTE_API_URL`
- `EUROPACE_UNTERLAGEN_API_URL`
- `EUROPACE_PRIVATKREDIT_PARTNER_ID`
- `EUROPACE_PRIVATKREDIT_BEARBEITER_PARTNER_ID`
- `EUROPACE_PRIVATKREDIT_LEADQUELLE`
- optional fuer serverseitigen Worker: `CRON_SECRET` oder `SYSTEM_CRON_SECRET`

Hinweis:

- `EUROPACE_UNTERLAGEN_API_URL` kann auf `https://api.europace2.de` zeigen; `config.ts` faellt aktuell auch auf diesen Default zurueck.
- der KEX-Import nutzt fuer Testfaelle weiterhin `EUROPACE_IMPORT_URL` ohne Zusatzparameter; fuer Echtgeschaeft wird jetzt automatisch `?environment=PRODUCTION` angehaengt
- der Datenkontext kann explizit ueber `EUROPACE_DATENKONTEXT=ECHTGESCHAEFT|TESTUMGEBUNG` oder `EUROPACE_IMPORT_ENVIRONMENT=PRODUCTION|TEST` gesetzt werden
- ohne expliziten Override gilt: `VERCEL_ENV=production` -> `ECHTGESCHAEFT`, alles andere -> `TESTUMGEBUNG`
- wenn der OAuth-Client auf einer Organisationsplakette liegt, aber Vorgaenge fachlich unter einer anderen Partner-ID angelegt werden sollen, kann `EUROPACE_CLIENT_PARTNER_ID` als Actor-Partner gesetzt werden; die Auth zieht dann automatisch ein impersoniertes Token fuer `EUROPACE_PRIVATKREDIT_BEARBEITER_PARTNER_ID` bzw. `EUROPACE_PRIVATKREDIT_PARTNER_ID`
- der Sync korrigiert vor `updatePersonendaten` jetzt serverseitig den `Bearbeiter` des Vorgangs auf `EUROPACE_PRIVATKREDIT_BEARBEITER_PARTNER_ID` (Fallback: `EUROPACE_PRIVATKREDIT_PARTNER_ID`); das ist wichtig fuer bereits bestehende Test-Vorgaenge, die frueher ohne passenden Bearbeiter importiert wurden
- wenn trotz dieses Auto-Healings weiter `Insufficient permissions to update vorgang` kommt, ist die naechste Pruefung nicht mehr das Mapping, sondern OAuth-Impersonation: `EUROPACE_CLIENT_PARTNER_ID` muss den Client-Actor tragen und der Subject-Partner muss in Europace wirklich updateberechtigt sein

### 4. `vorgangsnummer` ist die externe Master-ID

Der gesamte Sync haengt an:

- `case_europace.vorgangsnummer`
- Applicant-Mapping in `case_europace_applicants`

Diese Daten duerfen nicht verloren gehen.

### 5. Advisor-UI fuer `konsum` soll nicht wie Baufi weiterleben

Im Advisor-Dashboard fuer Privatkredit ist die Richtung:

- Europace-Sync anzeigen
- Europace-Angebote anzeigen
- spaeter Europace-Annahme / Unterlagen / Status anzeigen

Nicht die Richtung:

- lokale Privatkredit-Angebote manuell erzeugen

## Technische Wahrheiten aus der Doku, die im Code bereits beruecksichtigt sind

Der naechste Agent sollte diese Annahmen nicht mehr neu erfinden:

- Import ist separater REST-Endpoint
- Vorgangs-Updates nutzen `vorgangsnummer`
- Export laeuft ueber `vorgang(vorgangsnummer: ...)`
- Export liefert direkte `antragsteller1` / `antragsteller2`
- Angebotsabfrage laeuft ueber `angebote(vorgangsnummer: ...)`
- Angebotsannahme laeuft ueber `angebotAnnehmen(vorgangsnummer, angebotId)`
- Annahme ist async und braucht `annahmeJob(jobId)`
- Dokumentenupload laeuft fuer den aktuellen Stand ueber die Unterlagen-API V2 als Multipart-Datei-Upload (`POST /v2/dokumente` mit `file`, `caseId`, optional `displayName`, `category`, `assignmentId`)
- Dokumentliste kann ueber die Unterlagen-API V1 gelesen werden (`GET /v1/dokumente?vorgangsNummer=...`)
- moegliche Upload-Zuordnungen kommen ueber `GET /v1/dokumente/moeglichezuordnungen`
- Seiten mit aktueller Zuordnung / Freigabe kommen ueber `GET /v1/dokumente/seiten`
- manuelle Dokument-Loeschung laeuft ueber `DELETE /v1/dokumente/{dokumentId}`
- manuelles Re-Assignment laeuft ueber `PUT /v1/dokumente/zuordnung/{kategorie}`
- Dokumentfreigabe fuer einen Antrag laeuft ueber `POST /v1/dokumente/freigabe`

Wichtige Einschraenkung aus dem Swagger:

- `GET /v1/dokumente/anforderungen` und `GET /v1/dokumente/antrag/anforderungen` sind dort als BaufiSmart-only dokumentiert.
- Fuer Privatkredit verwenden wir deshalb aktuell `moeglichezuordnungen` als pragmatische Upload-Ziele. Das ist eine Implementierungsentscheidung auf Basis der Swagger-Spezifikation, keine bestaetigte KreditSmart-spezifische Fachzusage.

Offizielle Quellen:

- `https://docs.api.europace.de/privatkredit/`
- `https://docs.api.europace.de/privatkredit/vorgaenge/kex-vorgang-import-api/`
- `https://docs.api.europace.de/privatkredit/vorgaenge/kex-vorgang-update-api/`
- `https://docs.api.europace.de/privatkredit/vorgaenge/kex-vorgang-export-api/`
- `https://docs.api.europace.de/privatkredit/angebote/kex-angebote-api/`
- `https://docs.api.europace.de/privatkredit/unterlagen/unterlagen-api/`

## Was aktuell noch fehlt

### Fachlich offen

- echte KreditSmart-Unterlagenanforderungen, falls der Tenant mehr als `moeglichezuordnungen` bereitstellt
- Feinschliff fuer Assignment- und Freigabelogik auf Basis realer Tenant-Daten
- Vollstaendige Self-Service-Strecke bis zur finalen Bankbearbeitung:
  - verifizieren, wie weit `sofortkredit` / Online-Abschluss im echten Tenant fachlich belastbar ist
  - Vertrags-/Signaturlogik mit realen Bankdokumenten im Produktivablauf pruefen
  - ggf. Europace-UI-Deep-Link oder Silent-Sign-In fuer Sonderfaelle ergaenzen
  - pruefen, ob der Einladungszeitpunkt fachlich wirklich nach Angebotswahl liegen soll oder ob der heute fruehere Account-Create beibehalten wird

### Technisch offen

- KEX Push fehlt weiterhin; fuer Vercel gibt es jetzt eine sichere Daily-Cron, hoehere Frequenz oder andere Scheduler muessen noch projektspezifisch verdrahtet werden
- kein automatischer Re-Upload / Recovery-Pfad, wenn ein remote geloeschtes Dokument spaeter erneut in Europace landen soll
- die oeffentliche `/onlinekredit/antrag`-Strecke endet aktuell bewusst vor Dokumenten- und Signaturschritten; diese laufen nach Login im Portal

## Der naechste sinnvolle Implementierungsschritt

Wenn du als naechster Agent weiterarbeitest, beginne hier:

### Ziel

Den jetzt fertigen oeffentlichen `Onlinekredit`-Flow gegen reale Tenant-Daten absichern und die verbleibenden End-to-End-Luecken schliessen.

### Warum genau das als Naechstes

Der aktuelle Stand kann bereits:

- Fall importieren
- Draft nach Europace spiegeln
- Europace-Angebote abrufen und cachen
- Europace-Angebote annehmen
- `annahmeJob` pollen und `antragsnummer` persistieren
- lokale Dokumente nach Europace hochladen und den Sync-Status anzeigen
- Upload-Ziele fuer `konsum` aus Europace-Zuordnungen ableiten
- Dokumente nach Angebotsannahme aus dem Advisor-Dashboard freigeben
- Angebotsannahme jetzt auch direkt im Kundenportal ausfuehren
- Europace-Antragsstatus im Advisor- und Kundenportal anzeigen und manuell aktualisieren
- den ersten lokalen Co-Antragsteller als `antragsteller2` in Europace spiegeln
- serverseitig batchweise Europace-Status und laufende Annahmejobs pollen
- lokale Dokument-Loeschungen Europace-seitig wenigstens sauber als `local_deleted` markieren
- den oeffentlichen `Onlinekredit`-Start jetzt direkt in einen echten Privatkredit-Fall ueberfuehren
- den Fall vor dem Login ueber `/onlinekredit/antrag` weiterbearbeiten
- oeffentlich live Europace-Angebote abrufen, annehmen und bis zum `annahmeJob` verfolgen
- nach Angebotswahl sauber in Einladung/Login und danach in den bestehenden Portal-Flow uebergeben

Der groesste fehlende Mehrwert ist jetzt:

- reale KreditSmart-Anforderungen gegen Tenant-Daten pruefen
- KEX Push anbinden oder den Scheduler mit projektspezifisch passender Frequenz verdichten
- die neue Kunden-Journey gegen echte Tenant-Daten end-to-end durchtesten
- verbleibende Co-Antragsteller- und Mapping-Luecken schliessen
- Recovery-Pfade fuer remote geloeschte oder manuell umgehaengte Dokumente festziehen

Die Strecke ist jetzt fachlich deutlich naeher an end-to-end, aber noch nicht vollstaendig automatisiert.

### Dateien, die dafuer als Erstes relevant sind

- `app/api/app/documents/upload/direct/route.ts`
- `components/case/DocumentPanel.tsx`
- `app/api/app/documents/requests/route.ts`
- `lib/europace/documents.ts`
- `components/case/EuropaceCustomerOffersCard.tsx`
- `components/onlinekredit/OnlinekreditAccessCard.tsx`
- `app/(website)/onlinekredit/antrag/page.tsx`
- `app/api/onlinekredit/europace/offers/route.ts`
- `app/api/onlinekredit/europace/offers/accept/route.ts`
- `app/api/onlinekredit/europace/offers/job/route.ts`
- `app/api/app/privatkredit/europace/offers/accept/route.ts`
- `app/api/app/privatkredit/europace/offers/job/route.ts`
- `app/api/app/privatkredit/europace/status/route.ts`
- `app/api/system/europace/sync/route.ts`
- `app/api/app/cases/get/route.ts`
- `lib/europace/status.ts`
- `lib/europace/worker.ts`
- `lib/onlinekredit/publicAccess.ts`
- `lib/onlinekredit/caseAccess.ts`
- `sql/2026-03-17_europace_privatkredit_foundation.sql`

### Erwartete Umsetzung

1. Gegen echte Tenant-Daten den neuen `Onlinekredit`-Flow end-to-end durchtesten: Antrag -> Live-Angebote -> Angebotswahl -> Login -> Unterlagen -> Status.
2. Gegen echte Tenant-Daten pruefen, ob `moeglichezuordnungen` fuer Privatkredit die richtige Quelle bleibt.
3. Falls verfuegbar, KreditSmart-spezifische Unterlagenanforderungen sauber einbinden.
4. KEX Push oder Polling fuer Status / Dokumentaenderungen bauen.
5. KEX Push oder eine dichtere produktive Polling-Frequenz projektspezifisch verdrahten.
6. Co-Antragsteller-Daten vervollstaendigen.

### Definition of Done fuer diesen naechsten Schritt

- Europace-Upload-Ziele sind im Fall sichtbar
- SEPANA-Uploads koennen einem Europace-Assignment oder einer Kategorie zugeordnet werden
- Freigabestatus ist pro Dokument nachvollziehbar
- fuer `konsum` kommt die Dokumentanforderung nicht mehr primaer aus lokalen Freitext-Requests
- der oeffentliche `Onlinekredit`-Flow endet nach Angebotswahl nachvollziehbar im Portal-/Invite-Prozess
- `npm run build` bleibt gruen

## Danach empfohlene Reihenfolge

### Schritt 2

Kundenportal weiter vertiefen:

- Unterlagenstatus fuer Kunden
- Kundenfreundliche Darstellung von Antrag / Status / Freigaben
- ggf. weitere Self-Service-Schritte nach realem Tenant-Verhalten

### Schritt 3

Statussync:

- clientseitiges Polling ist umgesetzt
- serverseitiger Polling-Endpoint ist umgesetzt
- Vercel-Daily-Cron ist als sichere Default-Verdrahtung umgesetzt
- als Naechstes hoehere Frequenz oder separater Push-Worker fuer KEX Push

## Bekannte Limitierungen im aktuellen Mapping

Diese Punkte sind aktuell bewusst vereinfacht:

- es wird nur der Hauptantragsteller sauber nach Europace gespiegelt
- aktuell wird hoechstens der erste lokale Co-Antragsteller als `antragsteller2` gespiegelt; weitere Co-Row-Eintraege bleiben lokal
- einige Enum-Mappings in `mapper.ts` sind Best-Effort und muessen spaeter gegen reale Tenant-Daten geprueft werden
- `bank_account_holder` wird aktuell noch nicht explizit nach Europace gemappt
- fuer Co-Antragsteller werden aktuell nur der erste lokale `co`-Datensatz und die heute bereits in SEPANA erfassten Felder gespiegelt; mehrere Co-Applicant-Konstellationen bleiben weiterhin lokal
- Dokumente werden aktuell zwar an Kategorien / Assignments gekoppelt und koennen freigegeben werden, aber das Verhalten ist noch nicht gegen echte Tenant-Daten ausoptimiert
- die Quelle fuer Privatkredit-Unterlagenanforderungen ist aktuell `moeglichezuordnungen`, weil die Swagger-`anforderungen` als Baufi-only markiert sind
- lokale Dokument-Loeschungen versuchen jetzt best-effort einen echten Europace-Remote-Delete; wenn das nicht klappt, faellt der Pfad auf `local_deleted` zurueck
- fuer remote geloeschte Dokumente gibt es aktuell noch keinen automatischen Re-Upload-Pfad
- Statusrefresh ist nicht mehr nur UI-getrieben; der serverseitige Polling-Endpoint und eine sichere Vercel-Daily-Cron existieren, aber KEX Push und projektspezifische Feintaktung fehlen noch

## Verhaltensregeln fuer kuenftige Refactorings

Bitte diese Dinge nicht unabsichtlich zurueckbauen:

- fuer `konsum` nicht wieder lokale manuelle Angebotsbearbeitung im Advisor-Dashboard zur Primaerlogik machen
- Import nicht wieder als GraphQL modellieren
- Endpoints nicht wieder auf eine einzige `EUROPACE_API_URL` reduzieren
- optionales Impersonation-Handling nicht wieder entfernen, solange der Client auf einer anderen Partner-ID als der fachliche Privatkredit-Partner liegt
- `case_europace_sync_events` nicht entfernen; das Log ist fuer Debugging wichtig
- fehlende Europace-Tabellen weiterhin tolerant behandeln, damit alte Environments nicht hart crashen

## Schnelltest fuer den naechsten Agenten

Wenn du weiterarbeitest, pruefe mindestens:

1. `npm run build`
2. Advisor-Fall eines `konsum`-Cases oeffnen
3. Live-/Kunden-Draft speichern
4. pruefen, ob `case_europace` geschrieben wird
5. Advisor-Sync manuell triggern
6. Angebote abrufen
7. Angebot im Kundenportal annehmen
8. `annahmeJob` im Kundenportal pruefen
9. Testdokument in einem `konsum`-Fall hochladen
10. pruefen, ob `case_europace_documents` geschrieben wird und der Status im `DocumentPanel` sichtbar ist
11. Advisor-Unterlagenkarte oeffnen und Live-Dokumente aus Europace abrufen
12. Unterlagen im Advisor-Dashboard neu zuordnen oder remote loeschen
13. Unterlagen im Advisor-Dashboard freigeben

Wenn Europace-Livezugriff moeglich ist, erst dann:

14. Angebotsannahme testen
15. `annahmeJob` pollen
16. `antragsnummer` pruefen

## Repo-Dateien mit der hoechsten Relevanz

### Kernlogik

- `lib/europace/service.ts`
- `lib/europace/offerSync.ts`
- `lib/europace/offers.ts`
- `lib/europace/documents.ts`
- `lib/europace/status.ts`
- `lib/europace/import.ts`
- `lib/europace/export.ts`
- `lib/europace/update.ts`
- `lib/europace/mapper.ts`
- `lib/europace/case.ts`

### Advisor

- `app/(advisor)/advisor/faelle/[id]/page.tsx`
- `app/(advisor)/advisor/faelle/[id]/ui/EuropaceDocumentsCard.tsx`
- `app/(advisor)/advisor/faelle/[id]/ui/EuropaceSyncCard.tsx`
- `app/(advisor)/advisor/faelle/[id]/ui/EuropaceOffersCard.tsx`
- `app/api/advisor/privatkredit/europace/documents/route.ts`
- `app/api/advisor/privatkredit/europace/documents/assignment/route.ts`
- `app/api/advisor/privatkredit/europace/documents/delete/route.ts`
- `app/api/advisor/privatkredit/europace/sync/route.ts`
- `app/api/advisor/privatkredit/europace/offers/route.ts`

### Kunde / Live

- `app/api/live/case/route.ts`
- `components/live/LiveCasePanel.tsx`
- `components/onlinekredit/OnlinekreditWizard.tsx`

### Read API

- `app/api/app/cases/get/route.ts`

### Dokumente

- `app/api/app/documents/upload/direct/route.ts`
- `app/api/app/documents/upload/route.ts`
- `components/case/DocumentPanel.tsx`

## Abschluss

Der aktuelle Stand ist kein Konzept mehr, sondern ein implementiertes Fundament.
Der Dokumentenblock ist begonnen, aber noch nicht fachlich fertig.
Status-Refresh, serverseitiger Polling-Endpoint, sichere Vercel-Daily-Cron und erster Co-Antragsteller-Sync sind jetzt umgesetzt.
Der wichtigste naechste Schritt ist jetzt Tenant-Verifikation bei Unterlagen sowie KEX Push oder eine projektspezifisch dichtere Scheduler-Frequenz fuer den serverseitigen Statusabgleich. Ab diesem Punkt bringt eine echte Europace-Testumgebung deutlich mehr als weiterer Blindbau.
