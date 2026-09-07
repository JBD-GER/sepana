export const PARTNERSHIP_AGREEMENT_VERSION = "2026-09-07.1"
export const PARTNERSHIP_AGREEMENT_TITLE = "Partnerschaftsvertrag Baufinanzierung"
export const PARTNERSHIP_ACCEPTANCE_TEXT =
  "Ich habe den vollständigen Partnerschaftsvertrag gelesen, bestätige die angegebenen Partnerdaten und meine Vertretungsberechtigung und nehme den Vertrag für den genannten Partner verbindlich an."

export type AgreementPartner = {
  userId: string
  companyName: string
  street: string
  houseNumber: string
  zip: string
  city: string
  email: string
  signerName: string
}

export type AgreementDocument = {
  version: string
  title: string
  provider: { name: string; street: string; city: string; email: string }
  partner: AgreementPartner
  sections: { title: string; paragraphs: string[] }[]
  acceptanceText: string
}

export type AgreementStatus =
  | { state: "unsigned" }
  | { state: "signed"; signedAt: string; signerName: string; version: string }
  | { state: "unavailable" }

export type SignatureStroke = { x: number; y: number }[]

export function normalizeSignerName(value: unknown) {
  return typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/g, " ") : ""
}

export function isValidSignerName(value: string) {
  return value.length >= 3 && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value) &&
    value.split(" ").filter((part) => /\p{L}/u.test(part)).length >= 2
}

// Coordinates are normalized to 0..1; the same strokes are shown in the UI and PDF.
export function validateSignature(value: unknown): value is SignatureStroke[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return false
  let points = 0
  let distance = 0
  for (const stroke of value) {
    if (!Array.isArray(stroke) || stroke.length < 2 || stroke.length > 2000) return false
    for (let index = 0; index < stroke.length; index++) {
      const point = stroke[index]
      if (!point || typeof point.x !== "number" || typeof point.y !== "number" ||
          !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
          point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return false
      if (index) distance += Math.hypot(point.x - stroke[index - 1].x, point.y - stroke[index - 1].y)
      points++
      if (points > 12000) return false
    }
  }
  return points >= 8 && distance >= 0.15
}

export function buildPartnershipAgreement(partner: AgreementPartner): AgreementDocument {
  return {
    version: PARTNERSHIP_AGREEMENT_VERSION,
    title: PARTNERSHIP_AGREEMENT_TITLE,
    provider: {
      name: "Flaaq Holding GmbH (SEPANA)",
      street: "Dammstr. 6G",
      city: "30890 Barsinghausen",
      email: "info@sepana.de",
    },
    partner,
    sections: [
      {
        title: "1. Vertragsparteien und Gegenstand",
        paragraphs: [
          "Die oben genannte Flaaq Holding GmbH, handelnd unter der Marke SEPANA (nachfolgend „SEPANA“), und der oben namentlich mit Firma und Geschäftsanschrift bezeichnete Partner (nachfolgend „Partner“) vereinbaren die Zusammenarbeit bei der Zuführung von Interessenten für Baufinanzierungen (Leads). Der Partner handelt im Rahmen seiner selbstständigen unternehmerischen Tätigkeit; die unterzeichnende Person handelt als Inhaber oder vertretungsberechtigte Person des Partners.",
          "Der Partner stellt mit Zustimmung der Interessenten den Kontakt zu SEPANA her. SEPANA übernimmt die Prüfung, Beratung und Vermittlung der Baufinanzierung selbst oder durch hierzu berechtigte Kooperationspartner. Eine bestimmte Anzahl von Leads, ein Finanzierungserfolg oder eine Mindestvergütung werden nicht zugesagt. Die Zusammenarbeit ist nicht exklusiv.",
        ],
      },
      {
        title: "2. Aufgaben und Zuordnung der Leads",
        paragraphs: [
          "Der Partner übermittelt richtige, nach bestem Wissen vollständige Kontaktdaten und die für die Kontaktanbahnung erforderlichen Informationen über das Partner-Dashboard oder einen gemeinsam vereinbarten Übermittlungsweg. Anfragen über seinen persönlichen Partner-Link werden ihm zugeordnet. SEPANA dokumentiert die Zuordnung zum Lead und zum daraus entstehenden Finanzierungsfall.",
          "Vergütet werden eindeutig dem Partner zugeordnete Leads, deren Zuführung für die erfolgreiche Zusammenarbeit ursächlich war. Bereits bekannte oder mehrfach eingereichte Anfragen werden anhand der dokumentierten Erstzuordnung und der tatsächlichen Mitwirkung geprüft; SEPANA teilt dem Partner begründete Zuordnungseinwände mit. Eine mehrfache Vergütung desselben Provisionszuflusses ist ausgeschlossen.",
          "Der Partner schuldet die Kontaktanbahnung. Dieser Vertrag erteilt ihm keine Vollmacht, SEPANA zu vertreten, Finanzierungszusagen abzugeben, Zahlungen von Interessenten entgegenzunehmen oder erlaubnispflichtige Beratungs- oder Vermittlungstätigkeiten auszuüben. Solche Tätigkeiten setzen eine eigene Berechtigung und eine gesonderte Vereinbarung voraus.",
        ],
      },
      {
        title: "3. Erfolgsvergütung: 25 % einschließlich Umsatzsteuer",
        paragraphs: [
          "Für jeden zugeordneten Lead, der im Rahmen dieser Zusammenarbeit zu einer ausgezahlten Baufinanzierung führt und für den SEPANA eine Provision tatsächlich erhält, erhält der Partner 25 % der SEPANA aus diesem Finanzierungsfall tatsächlich zugeflossenen Provision als Gesamtvergütung. Eine Bankzusage oder der Abschluss eines Darlehensvertrags allein begründet noch keinen Auszahlungsanspruch.",
          "Berechnungsgrundlage ist der tatsächliche Provisionszufluss bei SEPANA für den zugeordneten Finanzierungsfall, einschließlich einer darin gegebenenfalls enthaltenen Umsatzsteuer. Allgemeine Betriebs-, Personal- oder Marketingkosten von SEPANA mindern diese Grundlage nicht. Das Darlehensvolumen selbst ist keine Berechnungsgrundlage. Bei mehreren Provisionszahlungen wird jeder zugehörige Zufluss berücksichtigt; bei Teilzahlungen entsteht die Vergütung anteilig.",
          "Die Vergütung von 25 % ist ein Bruttobetrag. Eine auf die Leistung des Partners gesetzlich anfallende Umsatzsteuer ist darin enthalten und wird nicht zusätzlich aufgeschlagen. Beispiel: Erhält SEPANA 10.000,00 EUR Provision, beträgt die Gesamtvergütung des Partners 2.500,00 EUR. Bei 19 % Umsatzsteuer sind darin 2.100,84 EUR netto und 399,16 EUR Umsatzsteuer enthalten.",
          "Soweit die Leistung des Partners umsatzsteuerfrei ist oder die Kleinunternehmerregelung Anwendung findet, wird keine Umsatzsteuer ausgewiesen. Die Gesamtvergütung bleibt bei 25 % der genannten Grundlage. Der Partner teilt SEPANA seinen zutreffenden Steuerstatus, erforderliche Steuerangaben und Änderungen rechtzeitig mit.",
        ],
      },
      {
        title: "4. Abrechnung und Auszahlung",
        paragraphs: [
          "SEPANA erstellt nach Eingang der Provision eine nachvollziehbare Abrechnung mit Fallzuordnung, Berechnungsgrundlage, Beteiligungssatz, Gesamtvergütung und gegebenenfalls Umsatzsteuer. Die Parteien vereinbaren die Abrechnung durch Gutschrift, soweit die gesetzlichen Voraussetzungen vorliegen; andernfalls stellt der Partner eine ordnungsgemäße Rechnung. Das gesetzliche Recht, einer Gutschrift zu widersprechen, bleibt unberührt.",
          "Die Auszahlung erfolgt innerhalb von 14 Kalendertagen, nachdem die Finanzierung ausgezahlt wurde, die betreffende Provision bei SEPANA eingegangen ist und die für eine ordnungsgemäße Abrechnung und Überweisung erforderlichen Steuer- und Bankangaben vorliegen. SEPANA stellt die Abrechnung im Partnerbereich bereit. Im Dashboard vorgemerkte Provisionen sind bis zur Erfüllung dieser Voraussetzungen vorläufig.",
        ],
      },
      {
        title: "5. Nichtzustandekommen und Provisionsrückforderung",
        paragraphs: [
          "Kommt keine Auszahlung der Baufinanzierung zustande oder erhält SEPANA keine zugehörige Provision, entsteht keine Erfolgsvergütung. Muss SEPANA eine bereits erhaltene Provision aufgrund eines berechtigten Rückforderungsanspruchs ganz oder teilweise zurückzahlen, vermindert sich die Partnervergütung entsprechend. SEPANA weist Anlass und Umfang der Rückzahlung nachvollziehbar nach.",
          "Eine daraus folgende Überzahlung ist innerhalb von 30 Kalendertagen nach Zugang des Nachweises und einer korrigierten Abrechnung zurückzuzahlen. Eine Rückforderung entfällt, soweit SEPANA den Wegfall der Provision durch eine eigene schuldhafte Pflichtverletzung verursacht hat. Gesetzliche Einwendungen und Aufrechnungsrechte bleiben unberührt.",
        ],
      },
      {
        title: "6. Datenschutz und Vertraulichkeit",
        paragraphs: [
          "Der Partner übermittelt personenbezogene Daten nur auf einer tragfähigen Rechtsgrundlage. Vor Weitergabe informiert er die Interessenten über SEPANA als Empfänger, den Zweck der Baufinanzierungsanfrage und die beabsichtigte Kontaktaufnahme. Soweit eine Einwilligung erforderlich ist, holt er diese vorab ein, dokumentiert sie und weist sie auf berechtigte Anfrage nach. Es werden nur für die Anfrage erforderliche Daten übermittelt.",
          "Beide Parteien beachten die geltenden Datenschutzvorschriften, schützen die Daten vor unberechtigtem Zugriff und verwenden sie ausschließlich für die vereinbarten Zwecke. Die datenschutzrechtliche Rollenverteilung richtet sich nach der tatsächlichen Verarbeitung. Falls eine Auftragsverarbeitung oder gemeinsame Verantwortlichkeit vorliegt, treffen die Parteien vor Beginn die hierfür erforderliche gesonderte Vereinbarung.",
          "Nicht öffentliche Kunden-, Finanzierungs-, Provisions- und Geschäftsinformationen sind vertraulich zu behandeln, auch nach Vertragsende. Ausgenommen sind zulässige Offenlegungen zur Vertragserfüllung, gegenüber zur Verschwiegenheit verpflichteten Beratern oder aufgrund gesetzlicher Pflichten. Daten werden gelöscht, sobald sie nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten oder berechtigten Nachweiszwecke entgegenstehen.",
        ],
      },
      {
        title: "7. Laufzeit und Beendigung",
        paragraphs: [
          "Die Vereinbarung beginnt mit der elektronischen Annahme durch den Partner und läuft auf unbestimmte Zeit. Jede Partei kann sie mit einer Frist von 14 Kalendertagen in Textform, beispielsweise per E-Mail, kündigen. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt bestehen.",
          "Für vor Vertragsende zugeordnete Leads bleibt die vereinbarte Erfolgsvergütung bestehen, wenn die übrigen Voraussetzungen erst nach Vertragsende eintreten. Bereits bestehende individuelle Vergütungsvereinbarungen werden durch diesen Vertrag nicht rückwirkend geändert. Abrechnungs-, Rückzahlungs-, Datenschutz- und Vertraulichkeitspflichten gelten fort, soweit ihre Erfüllung noch erforderlich ist.",
        ],
      },
      {
        title: "8. Verantwortung und Schlussbestimmungen",
        paragraphs: [
          "Die Parteien haften nach den gesetzlichen Vorschriften für ihre eigenen Pflichtverletzungen. Der Partner bleibt rechtlich und wirtschaftlich selbstständig und ist für seine gewerbe- und steuerrechtlichen Pflichten verantwortlich. Die tatsächliche Ausgestaltung der Zusammenarbeit und zwingende gesetzliche Vorschriften bleiben maßgeblich.",
          "Es gilt deutsches Recht. Änderungen und Ergänzungen sollen zu Nachweiszwecken in Textform festgehalten werden; der Vorrang individueller Vereinbarungen bleibt unberührt. Sollte eine Bestimmung unwirksam sein, gelten an ihrer Stelle die gesetzlichen Vorschriften. Die übrigen Bestimmungen bleiben wirksam.",
        ],
      },
      {
        title: "9. Elektronischer Vertragsschluss und Vertragskopie",
        paragraphs: [
          "SEPANA stellt dem eingeladenen Partner diesen Vertrag als Angebot im geschützten Partnerbereich zur Verfügung. Der Partner nimmt das Angebot an, indem die namentlich genannte, vertretungsberechtigte Person nach Einsicht in das vollständige Dokument die Zustimmung bestätigt, ihre Unterschrift einzeichnet und „Verbindlich unterzeichnen“ auswählt. Eine zusätzliche Gegenzeichnung durch SEPANA ist für diesen vereinbarten Ablauf nicht vorgesehen.",
          "Die Parteien vereinbaren diesen elektronischen Abschluss. Vertragsfassung, Partnerdaten, Name der unterzeichnenden Person, Zustimmung, Unterschrift und Zeitpunkt der Annahme werden zusammen mit der Zuordnung zum angemeldeten Partnerkonto gespeichert. Die unterschriebene Vertragskopie steht anschließend unter Einstellungen zum PDF-Download bereit. Spätere Profiländerungen ändern diese Vertragskopie nicht.",
        ],
      },
    ],
    acceptanceText: PARTNERSHIP_ACCEPTANCE_TEXT,
  }
}
