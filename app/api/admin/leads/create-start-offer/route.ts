import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent } from "@/lib/notifications/notify"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const leadId = String(body?.leadId ?? "").trim()
    const providerId = String(body?.providerId ?? "").trim()

    if (!leadId || !providerId) {
      return NextResponse.json({ ok: false, error: "leadId und providerId sind erforderlich." }, { status: 400 })
    }

    const { data: lead } = await admin
      .from("webhook_leads")
      .select("id,linked_case_id,external_lead_id,product_name,product_price")
      .eq("id", leadId)
      .maybeSingle()
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead nicht gefunden." }, { status: 404 })
    }
    if (!lead.linked_case_id) {
      return NextResponse.json(
        { ok: false, error: "Lead ist noch keinem Fall zugeordnet. Bitte zuerst Berater zuweisen." },
        { status: 400 }
      )
    }

    const { data: caseRow } = await admin
      .from("cases")
      .select("id,case_type,status,case_ref")
      .eq("id", lead.linked_case_id)
      .maybeSingle()
    if (!caseRow) {
      return NextResponse.json({ ok: false, error: "Verknuepfter Fall nicht gefunden." }, { status: 404 })
    }
    if (caseRow.case_type !== "baufi") {
      return NextResponse.json(
        { ok: false, error: "Startschuss wird aktuell nur fuer Baufi-Faelle unterstuetzt." },
        { status: 400 }
      )
    }

    const { data: provider } = await admin
      .from("providers")
      .select("id,name,slug,logo_horizontal_path,logo_icon_path,preferred_logo_variant")
      .eq("id", providerId)
      .eq("is_active", true)
      .maybeSingle()
    if (!provider) {
      return NextResponse.json({ ok: false, error: "Anbieter nicht gefunden." }, { status: 404 })
    }

    const payload = {
      kind: "admin_lead_startschuss",
      source: "webhook_lead",
      lead: {
        id: lead.id,
        external_lead_id: lead.external_lead_id,
        product_name: lead.product_name ?? null,
        product_price: lead.product_price ?? null,
      },
      provider: {
        id: provider.id,
        slug: provider.slug ?? null,
        name: provider.name ?? null,
        logo: {
          horizontal: provider.logo_horizontal_path ?? null,
          icon: provider.logo_icon_path ?? null,
          preferred: provider.preferred_logo_variant ?? "horizontal",
        },
      },
      createdAt: new Date().toISOString(),
    }

    const { error: previewErr } = await admin
      .from("case_offer_previews")
      .upsert(
        {
          case_id: caseRow.id,
          provider_id: provider.id,
          product_type: "baufi",
          payload,
        },
        { onConflict: "case_id,provider_id,product_type" }
      )
    if (previewErr) throw previewErr

    if (caseRow.status === "draft") {
      await admin.from("cases").update({ status: "comparison_ready" }).eq("id", caseRow.id)
    }

    await logCaseEvent({
      caseId: caseRow.id,
      actorRole: "admin",
      type: "startschuss_created",
      title: "Startschuss-Angebot erstellt",
      body: `Startschuss fuer Anbieter ${provider.name ?? provider.id} wurde gesetzt.`,
    })

    return NextResponse.json({
      ok: true,
      caseId: caseRow.id,
      caseRef: caseRow.case_ref ?? null,
      providerName: provider.name ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
