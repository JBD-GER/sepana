import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { loadEuropaceCaseDraft } from "@/lib/europace/case"
import { selectVisibleEuropaceOffers } from "@/lib/europace/offerVisibility"
import { refreshEuropaceOffers } from "@/lib/europace/offerSync"
import { syncEuropaceCase } from "@/lib/europace/service"
import { isRejectedEuropaceStatus, normalizeEuropaceApplications } from "@/lib/europace/status"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => null)
    const caseId = String(body?.caseId ?? "").trim()
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "caseId fehlt." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: caseRow, error: caseError } = await admin
      .from("cases")
      .select("id,customer_id,assigned_advisor_id,case_type")
      .eq("id", caseId)
      .maybeSingle()

    if (caseError) throw caseError
    if (!caseRow) return NextResponse.json({ ok: false, error: "Fall nicht gefunden." }, { status: 404 })
    if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "konsum") {
      return NextResponse.json({ ok: false, error: "Europace-Angebote sind nur fuer Privatkredit vorgesehen." }, { status: 409 })
    }
    if (role === "customer" && caseRow.customer_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }
    if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }
    if (role !== "customer" && role !== "advisor" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const draft = await loadEuropaceCaseDraft(admin, caseId)
    if (!draft.financing.loanAmountRequested || !draft.financing.termMonths) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bitte Kreditsumme und Laufzeit im Antrag vervollstaendigen, bevor Live-Angebote berechnet werden.",
        },
        { status: 400 }
      )
    }

    await syncEuropaceCase(admin, caseId)
    const result = await refreshEuropaceOffers(admin, caseId)
    const [{ data: offersRows, error: offersError }, { data: europaceMeta, error: europaceError }] = await Promise.all([
      admin
        .from("case_europace_offers")
        .select(
          "angebot_id,angebot_snapshot,machbarkeit_status,vollstaendigkeit_status,calculated_at,accepted_at,superseded_at,created_at"
        )
        .eq("case_id", caseId)
        .order("accepted_at", { ascending: false, nullsFirst: false })
        .order("calculated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("case_europace")
        .select("last_export_snapshot")
        .eq("case_id", caseId)
        .maybeSingle(),
    ])
    if (offersError) throw offersError
    if (europaceError) throw europaceError

    const hasRejectedApplication = normalizeEuropaceApplications(
      ((europaceMeta as { last_export_snapshot?: unknown } | null)?.last_export_snapshot ?? null) as {
        antraege?: Array<{
          antragstellerstatus?: string | { status?: string | null } | null
          produktanbieterstatus?: string | { status?: string | null } | null
        }> | null
      } | null
    ).some(
      (application) =>
        isRejectedEuropaceStatus(application.antragstellerstatus) ||
        isRejectedEuropaceStatus(application.produktanbieterstatus)
    )

    return NextResponse.json({
      ok: true,
      vorgangsnummer: result.vorgangsnummer,
      offers: selectVisibleEuropaceOffers(offersRows ?? [], { hasRejectedApplication }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Angebote konnten nicht geladen werden."
    const normalizedMessage = /kreditbetrag.*laufzeit|laufzeit.*kreditbetrag/i.test(message)
      ? "Bitte Kreditsumme und Laufzeit im Antrag vervollstaendigen und erneut speichern, bevor Live-Angebote berechnet werden."
      : message
    return NextResponse.json({ ok: false, error: normalizedMessage }, { status: 500 })
  }
}
