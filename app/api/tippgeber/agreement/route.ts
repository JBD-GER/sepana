import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { isValidSignerName, normalizeSignerName, validateSignature } from "@/lib/tippgeber/partnershipAgreement"
import {
  AGREEMENT_TABLE, AgreementError, agreementForProfile, checkAgreementOrigin,
  getPartnershipAgreementStatus, hashAgreement, readAgreementBody, requireAgreementPartner,
} from "@/lib/tippgeber/partnershipAgreementServer"
import { renderPartnershipAgreementPdf } from "@/lib/tippgeber/partnershipAgreementPdf"

export const runtime = "nodejs"
const headers = { "Cache-Control": "private, no-store" }

function failure(error: unknown) {
  if (error instanceof AgreementError) return NextResponse.json({ error: error.message }, { status: error.status, headers })
  console.error("partnership_agreement_failed", error)
  return NextResponse.json({ error: "Der Vertrag konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut." }, { status: 500, headers })
}

export async function GET() {
  try {
    const { user } = await requireAgreementPartner()
    const status = await getPartnershipAgreementStatus(user.id)
    return NextResponse.json(status, { status: status.state === "unavailable" ? 503 : 200, headers })
  } catch (error) { return failure(error) }
}

export async function POST(req: Request) {
  try {
    checkAgreementOrigin(req)
    const { admin, user, profile } = await requireAgreementPartner()
    const body = await readAgreementBody(req)
    if (body.action !== "preview" && body.action !== "sign") throw new AgreementError("Ungültige Aktion.", 400)
    const existing = await getPartnershipAgreementStatus(user.id)
    if (existing.state === "unavailable") throw new AgreementError("Der Vertragsstatus ist gerade nicht verfügbar. Bitte versuchen Sie es erneut.", 503)
    if (existing.state === "signed") return NextResponse.json({ status: existing }, { headers })

    const signerName = normalizeSignerName(body.signerName)
    if (!isValidSignerName(signerName)) throw new AgreementError("Bitte geben Sie Ihren vollständigen Vor- und Nachnamen an (maximal 120 Zeichen).", 400)
    const document = agreementForProfile(profile, signerName, user.email ?? profile.email ?? "")
    const documentHash = hashAgreement(document)

    if (body.action === "preview") return NextResponse.json({ document, documentHash }, { headers })
    if (body.accepted !== true) throw new AgreementError("Bitte bestätigen Sie die Vertragsannahme.", 400)
    if (body.documentHash !== documentHash) {
      throw new AgreementError("Der Vertrag oder Ihre Partnerdaten wurden geändert. Bitte öffnen und prüfen Sie den Vertrag erneut.", 409)
    }
    if (!validateSignature(body.signature)) throw new AgreementError("Bitte zeichnen Sie Ihre vollständige Unterschrift ein.", 400)

    const signedAt = new Date().toISOString()
    const pdf = await renderPartnershipAgreementPdf({ document, signedAt, documentHash, signature: body.signature })
    // Store document, signature, timestamp and exact PDF together in one insert.
    // The unique user_id makes concurrent submissions and retries idempotent.
    const { error } = await admin.from(AGREEMENT_TABLE).insert({
      user_id: user.id,
      version: document.version,
      signer_name: signerName,
      signed_at: signedAt,
      document_snapshot: document,
      document_sha256: documentHash,
      signature_strokes: body.signature,
      acceptance_text: document.acceptanceText,
      signed_pdf_base64: Buffer.from(pdf).toString("base64"),
      signed_pdf_sha256: createHash("sha256").update(pdf).digest("hex"),
    })
    if (error && error.code !== "23505") throw error
    const saved = await getPartnershipAgreementStatus(user.id)
    if (saved.state !== "signed") throw new AgreementError("Die Speicherung konnte nicht bestätigt werden. Bitte laden Sie den Vertragsstatus erneut.", 503)
    revalidatePath("/tippgeber")
    revalidatePath("/tippgeber/einstellungen")
    return NextResponse.json({ status: saved }, { headers })
  } catch (error) { return failure(error) }
}
