import { buildEmailHtml } from "@/lib/notifications/notify"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function getOnlinekreditDocumentPin(vorgangsnummer: string | null | undefined) {
  const normalized = trimOrNull(vorgangsnummer)
  if (!normalized) return null
  const baseValue = normalized.split("/")[0]?.trim() ?? ""
  return baseValue || null
}

export function buildOnlinekreditDocumentPinEmail(input: {
  firstName?: string | null
  pin: string
  confirmationUrl?: string | null
}) {
  const title = "Deine PIN für die Bankunterlagen"
  const intro = `${input.firstName ? `Hallo ${input.firstName},` : "Hallo,"} für geschützte Bankunterlagen deiner Bank verwendest du aktuell diese PIN.`
  const bodyHtml = `
    <div style="margin:18px 0 0 0; border:1px solid #bfdbfe; background:#eff6ff; border-radius:18px; padding:18px;">
      <div style="font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#1d4ed8;">
        Dokumenten-PIN
      </div>
      <div style="margin:12px 0 0 0; font-size:30px; line-height:36px; font-weight:800; letter-spacing:.18em; color:#0f172a;">
        ${escapeHtml(input.pin)}
      </div>
      <div style="margin:12px 0 0 0; font-size:13px; line-height:20px; color:#334155;">
        Nutze diese PIN immer dann, wenn die Bank beim Öffnen von Kreditvertrag oder Datenschutzhinweisen danach fragt.
        Die PIN entspricht deiner Vorgangsnummer ohne Zusatz wie <strong>/1</strong>.
      </div>
    </div>
  `

  return {
    subject: title,
    html: buildEmailHtml({
      title,
      intro,
      steps: [
        "Nutze diese PIN, wenn die Bank beim Öffnen eines Dokuments danach fragt.",
        "Die PIN entspricht deiner Vorgangsnummer ohne Zusatz wie /1.",
        "Auf deiner SEPANA-Bestätigungsseite findest du die Unterlagen zusätzlich zur Einsicht.",
      ],
      ctaLabel: input.confirmationUrl ? "Zu deinen Bankunterlagen" : undefined,
      ctaUrl: input.confirmationUrl ?? undefined,
      preheader: "Deine PIN für geschützte Bankunterlagen",
      eyebrow: "SEPANA | Dokumenten-PIN",
      bodyHtml,
      sideNote: "Sicherheitshinweis: Die PIN ist nur für deinen Vorgang gedacht.",
    }),
  }
}
