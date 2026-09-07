import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { AGREEMENT_TABLE, AgreementError, requireAgreementPartner } from "@/lib/tippgeber/partnershipAgreementServer"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
  try {
    const { admin, user } = await requireAgreementPartner()
    const { data, error } = await admin.from(AGREEMENT_TABLE)
      .select("signed_pdf_base64,signed_pdf_sha256").eq("user_id", user.id).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: "Es liegt noch kein unterzeichneter Vertrag vor." }, { status: 404, headers })
    const pdf = Buffer.from(data.signed_pdf_base64, "base64")
    if (createHash("sha256").update(pdf).digest("hex") !== data.signed_pdf_sha256) throw new Error("agreement_pdf_integrity_failed")
    const disposition = new URL(req.url).searchParams.get("download") === "1" ? "attachment" : "inline"
    return new NextResponse(pdf, {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="SEPANA-Partnerschaftsvertrag-Baufinanzierung.pdf"`,
      },
    })
  } catch (error) {
    if (error instanceof AgreementError) return NextResponse.json({ error: error.message }, { status: error.status, headers })
    console.error("partnership_agreement_pdf_failed", error)
    return NextResponse.json({ error: "Der Vertragsdownload ist gerade nicht verfügbar. Bitte versuchen Sie es erneut." }, { status: 500, headers })
  }
}
