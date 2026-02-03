function prettify(raw?: string | null) {
  const s = String(raw ?? "").trim().toLowerCase()
  if (!s) return "—"
  const pretty = s.replace(/[_-]+/g, " ").trim()
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
}

export function translateCaseStatus(raw?: string | null) {
  const s = String(raw ?? "").trim().toLowerCase()
  const map: Record<string, string> = {
    new: "Neu",
    draft: "Entwurf",
    open: "Offen",
    active: "Aktiv",
    submitted: "Eingereicht",
    received: "Eingegangen",
    in_review: "In Prüfung",
    under_review: "In Prüfung",
    processing: "In Bearbeitung",
    needs_docs: "Unterlagen fehlen",
    missing_docs: "Unterlagen fehlen",
    waiting_customer: "Warten auf Sie",
    waiting_advisor: "Warten auf Berater",
    matching: "Vergleich läuft",
    comparison_ready: "Vergleich bereit",
    offers_ready: "Angebote bereit",
    offer_created: "Angebot erstellt",
    offer_open: "Angebot offen",
    offer_sent: "Angebot verschickt",
    offer_accepted: "Angebot angenommen",
    offer_rejected: "Angebot abgelehnt",
    approved: "Zusage",
    rejected: "Abgelehnt",
    cancelled: "Abgebrochen",
    closed: "Abgeschlossen",
    completed: "Abgeschlossen",
  }
  return map[s] ?? prettify(s)
}

export function translateOfferStatus(raw?: string | null) {
  const s = String(raw ?? "").trim().toLowerCase()
  const map: Record<string, string> = {
    created: "Erstellt",
    open: "Offen",
    draft: "Erstellt",
    pending: "In Vorbereitung",
    in_review: "In Prüfung",
    prepared: "Erstellt",
    ready: "Bereit",
    sent: "Verschickt",
    offered: "Versendet",
    accepted: "Angenommen",
    rejected: "Abgelehnt",
    declined: "Abgelehnt",
    expired: "Abgelaufen",
    cancelled: "Storniert",
    void: "Ungültig",
  }
  return map[s] ?? prettify(s)
}

export function translateBankStatus(raw?: string | null) {
  const s = String(raw ?? "").trim().toLowerCase()
  const map: Record<string, string> = {
    submitted: "Eingereicht",
    approved: "Angenommen",
    accepted: "Angenommen",
    declined: "Abgelehnt",
    rejected: "Abgelehnt",
  }
  return map[s] ?? prettify(s)
}
