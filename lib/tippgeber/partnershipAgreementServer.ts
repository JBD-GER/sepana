import { createHash } from "node:crypto"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { normalizeTippgeberKind } from "./kinds"
import { buildPartnershipAgreement, type AgreementDocument, type AgreementStatus } from "./partnershipAgreement"
import type { TippgeberProfileRow } from "./service"

export const AGREEMENT_TABLE = "tippgeber_partnership_agreements"

export class AgreementError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function requireAgreementPartner() {
  const { user, role, passwordSetAt } = await getUserAndRole()
  if (!user) throw new AgreementError("Bitte melden Sie sich an.", 401)
  if (role !== "tipgeber" || !passwordSetAt) throw new AgreementError("Kein Zugriff auf den Partnerschaftsvertrag.", 403)
  const admin = supabaseAdmin()
  const { data, error } = await admin.from("tippgeber_profiles").select("*").eq("user_id", user.id).maybeSingle()
  if (error) throw new Error("Partnerprofil konnte nicht geladen werden.")
  const profile = data as TippgeberProfileRow | null
  if (!profile || profile.is_active === false || normalizeTippgeberKind(profile.tippgeber_kind) !== "classic") {
    throw new AgreementError("Der Vertrag ist nur für aktive Baufinanzierungspartner verfügbar.", 403)
  }
  return { admin, user, profile }
}

export function agreementForProfile(profile: TippgeberProfileRow, signerName: string, accountEmail: string): AgreementDocument {
  if (![profile.company_name, profile.address_street, profile.address_house_number, profile.address_zip, profile.address_city].every((value) => value?.trim())) {
    throw new AgreementError("Ihre Firmendaten sind unvollständig. Bitte lassen Sie Firma und Anschrift durch SEPANA ergänzen.", 409)
  }
  return buildPartnershipAgreement({
    userId: profile.user_id,
    companyName: profile.company_name.trim(),
    street: profile.address_street.trim(),
    houseNumber: profile.address_house_number.trim(),
    zip: profile.address_zip.trim(),
    city: profile.address_city.trim(),
    email: accountEmail,
    signerName,
  })
}

export function hashAgreement(document: AgreementDocument) {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex")
}

export async function getPartnershipAgreementStatus(userId: string): Promise<AgreementStatus> {
  const { data, error } = await supabaseAdmin().from(AGREEMENT_TABLE)
    .select("signed_at,signer_name,version").eq("user_id", userId).maybeSingle()
  if (error) return { state: "unavailable" }
  if (!data) return { state: "unsigned" }
  return { state: "signed", signedAt: data.signed_at, signerName: data.signer_name, version: data.version }
}

export function checkAgreementOrigin(req: Request) {
  const origin = req.headers.get("origin")
  const allowedOrigins = [new URL(req.url).origin]
  if (process.env.NEXT_PUBLIC_SITE_URL) allowedOrigins.push(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin)
  if (req.headers.get("sec-fetch-site") === "cross-site" || (origin && !allowedOrigins.includes(origin))) {
    throw new AgreementError("Anfrage nicht zulässig.", 403)
  }
}

export async function readAgreementBody(req: Request): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new AgreementError("Ungültiges Anfrageformat.", 415)
  // Limit the actual streamed body, not just the client-supplied content-length.
  const reader = req.body?.getReader()
  if (!reader) throw new AgreementError("Anfragedaten fehlen.", 400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 750_000) { await reader.cancel(); throw new AgreementError("Die Unterschrift ist zu groß. Bitte zeichnen Sie sie erneut.", 413) }
    chunks.push(value)
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error()
    return body as Record<string, unknown>
  } catch { throw new AgreementError("Ungültige Anfragedaten.", 400) }
}
