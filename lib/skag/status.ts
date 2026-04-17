export type SkagStatusMeta = {
  alias: string
  title: string
  caseStatus: string
  tone: "neutral" | "success" | "warning" | "danger"
  customerMessage: string
  advisorMessage: string
}

const STATUS_MAP: Record<string, Omit<SkagStatusMeta, "alias">> = {
  submitted: {
    title: "An SEPANA übermittelt",
    caseStatus: "submitted",
    tone: "neutral",
    customerMessage: "Ihr Antrag wurde an SEPANA übermittelt.",
    advisorMessage: "Der Antrag wurde an SEPANA übermittelt.",
  },
  fast_request_successful: {
    title: "Vorlaeufig geeignet",
    caseStatus: "prequalified",
    tone: "success",
    customerMessage: "Die Vorpruefung ist positiv. Ihr Antrag kann jetzt final geprueft werden.",
    advisorMessage: "Die SEPANA-Vorpruefung ist positiv. Der Fall kann in die finale Pruefung gehen.",
  },
  contract_create_possible: {
    title: "Vertrag moeglich",
    caseStatus: "approved",
    tone: "success",
    customerMessage: "Die Bank kann fuer diesen Fall einen Vertrag erstellen.",
    advisorMessage: "Die Bank meldet, dass ein Vertrag erstellt werden kann.",
  },
  fast_request_yellow_manual_check: {
    title: "Manuelle Pruefung",
    caseStatus: "in_review",
    tone: "warning",
    customerMessage: "Der Antrag wird manuell geprueft. Wir informieren, sobald es weitergeht.",
    advisorMessage: "Der Antrag ist in manueller Pruefung.",
  },
  bank_additional_documents: {
    title: "Weitere Unterlagen benoetigt",
    caseStatus: "needs_docs",
    tone: "warning",
    customerMessage: "Es werden weitere Unterlagen fuer die Bankpruefung benoetigt.",
    advisorMessage: "Die Bank fordert weitere Unterlagen an.",
  },
  skag_additional_documents: {
    title: "Weitere Unterlagen fuer SEPANA",
    caseStatus: "needs_docs",
    tone: "warning",
    customerMessage: "Es werden weitere Unterlagen fuer die finale Pruefung benoetigt.",
    advisorMessage: "SEPANA fordert weitere Unterlagen fuer die finale Pruefung an.",
  },
  correction_required: {
    title: "Korrektur erforderlich",
    caseStatus: "waiting_customer",
    tone: "warning",
    customerMessage: "Es werden Korrekturen oder ergaenzende Angaben benoetigt.",
    advisorMessage: "Fuer den Fall sind Korrekturen oder ergaenzende Angaben noetig.",
  },
  fast_request_rejected: {
    title: "Vorpruefung abgelehnt",
    caseStatus: "rejected",
    tone: "danger",
    customerMessage: "Die Vorpruefung wurde abgelehnt.",
    advisorMessage: "Die Vorpruefung wurde abgelehnt.",
  },
  order_rejected_from_skag: {
    title: "Von SEPANA abgelehnt",
    caseStatus: "rejected",
    tone: "danger",
    customerMessage: "Der Antrag wurde von SEPANA abgelehnt.",
    advisorMessage: "Der Antrag wurde von SEPANA abgelehnt.",
  },
  bank_rejected_credit: {
    title: "Von der Bank abgelehnt",
    caseStatus: "rejected",
    tone: "danger",
    customerMessage: "Die Bank hat den Kreditantrag abgelehnt.",
    advisorMessage: "Die Bank hat den Kreditantrag abgelehnt.",
  },
  bank_received_contract: {
    title: "Vertrag bei der Bank",
    caseStatus: "submitted",
    tone: "neutral",
    customerMessage: "Der Vertrag ist bei der Bank eingegangen.",
    advisorMessage: "Der Vertrag ist bei der Bank eingegangen.",
  },
  contract_sent_bank: {
    title: "Vertrag an Bank gesendet",
    caseStatus: "submitted",
    tone: "neutral",
    customerMessage: "Der Vertrag wurde an die Bank gesendet.",
    advisorMessage: "Der Vertrag wurde an die Bank gesendet.",
  },
  skag_received_contract: {
    title: "Vertrag bei SEPANA",
    caseStatus: "processing",
    tone: "neutral",
    customerMessage: "Der Vertrag ist bei SEPANA eingegangen.",
    advisorMessage: "Der Vertrag ist bei SEPANA eingegangen.",
  },
  skag_sent_documents_to_bank: {
    title: "Unterlagen an Bank uebermittelt",
    caseStatus: "processing",
    tone: "neutral",
    customerMessage: "Die Unterlagen wurden an die Bank uebermittelt.",
    advisorMessage: "Die Unterlagen wurden an die Bank uebermittelt.",
  },
  assigment_received: {
    title: "Abtretung eingegangen",
    caseStatus: "processing",
    tone: "neutral",
    customerMessage: "Die Abtretung ist eingegangen.",
    advisorMessage: "Die Abtretung ist eingegangen.",
  },
  credit_payout: {
    title: "Auszahlung erfolgt",
    caseStatus: "completed",
    tone: "success",
    customerMessage: "Die Auszahlung wurde bestaetigt.",
    advisorMessage: "Die Auszahlung wurde bestaetigt.",
  },
  postident_successfully_completed: {
    title: "Postident abgeschlossen",
    caseStatus: "processing",
    tone: "success",
    customerMessage: "Die Legitimation wurde erfolgreich abgeschlossen.",
    advisorMessage: "Die Legitimation wurde erfolgreich abgeschlossen.",
  },
  storno: {
    title: "Vorgang storniert",
    caseStatus: "cancelled",
    tone: "danger",
    customerMessage: "Der Vorgang wurde storniert.",
    advisorMessage: "Der Vorgang wurde storniert.",
  },
}

export function getSkagStatusMeta(alias: string | null | undefined, description?: string | null): SkagStatusMeta {
  const normalized = String(alias ?? "").trim().toLowerCase()
  const mapped = STATUS_MAP[normalized]
  if (mapped) {
    return { alias: normalized, ...mapped }
  }

  const fallbackDescription = String(description ?? "").trim() || "Es liegt ein neues Statusupdate von SEPANA vor."
  return {
    alias: normalized || "unknown",
    title: normalized ? normalized.replace(/[_-]+/g, " ") : "Statusupdate",
    caseStatus: "processing",
    tone: "neutral",
    customerMessage: fallbackDescription,
    advisorMessage: fallbackDescription,
  }
}

export function translateSkagAlias(alias: string | null | undefined, description?: string | null) {
  const normalized = String(alias ?? "").trim().toLowerCase()
  if (!normalized) return "-"
  return getSkagStatusMeta(normalized, description).title
}
