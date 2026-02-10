import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, logCaseEvent, sendAdvisorAssignedEmail, sendEmail } from "@/lib/notifications/notify"
import {
  createCaseFromLead,
  ensureCustomerAccount,
  inferCaseTypeFromProduct,
  isEmail,
  LeadRow,
} from "@/lib/admin/leads"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const leadId = String(body?.leadId ?? "").trim()
    const advisorIdRaw = String(body?.advisorId ?? "").trim()
    const advisorId = advisorIdRaw || null

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId fehlt" }, { status: 400 })
    }

    const { data: existingLead } = await admin
      .from("webhook_leads")
      .select(
        "id,linked_case_id,external_lead_id,assigned_advisor_id,first_name,last_name,email,phone,phone_mobile,phone_work,birth_date,marital_status,employment_status,employment_type,net_income_monthly,address_street,address_zip,address_city,product_name,product_price,loan_purpose,loan_amount_total,property_zip,property_city,property_type,property_purchase_price,notes"
      )
      .eq("id", leadId)
      .maybeSingle()
    if (!existingLead) {
      return NextResponse.json({ ok: false, error: "Lead nicht gefunden" }, { status: 404 })
    }
    const lead = existingLead as LeadRow

    if (advisorId) {
      const { data: advisorProfile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", advisorId)
        .eq("role", "advisor")
        .maybeSingle()

      if (!advisorProfile) {
        return NextResponse.json({ ok: false, error: "Berater nicht gefunden" }, { status: 400 })
      }
    }

    let caseId = lead.linked_case_id
    const previousAdvisorId = lead.assigned_advisor_id ?? null
    const isAdvisorChanged = previousAdvisorId !== advisorId

    let caseCreated = false
    let invited = false
    let existingAccount = false
    let passwordInviteSent = false
    let nextStepsMailSent = false
    let advisorMailSent = false

    if (advisorId && !caseId) {
      const caseType = inferCaseTypeFromProduct(lead.product_name)
      if (!caseType) {
        await admin
          .from("webhook_leads")
          .update({
            assigned_advisor_id: advisorId,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", leadId)

        return NextResponse.json({
          ok: true,
          caseCreated: false,
          message:
            "Berater wurde zugewiesen, aber kein Fall erstellt: Produkt passt aktuell nicht zum Baufi-Flow.",
        })
      }

      if (!lead.email || !isEmail(lead.email)) {
        return NextResponse.json(
          { ok: false, error: "Lead hat keine gueltige E-Mail. Konto/Einladung nicht moeglich." },
          { status: 400 }
        )
      }

      const customer = await ensureCustomerAccount({
        admin,
        req,
        email: lead.email,
        firstName: lead.first_name,
        lastName: lead.last_name,
      })
      invited = customer.invited
      existingAccount = customer.existingAccount
      passwordInviteSent = customer.passwordInviteSent

      const created = await createCaseFromLead({
        admin,
        lead,
        customerId: customer.userId,
        advisorId,
        caseType,
      })
      caseId = created.caseId
      caseCreated = true

      const nextStepsHtml = buildEmailHtml({
        title: "Naechste Schritte zu Ihrer Baufinanzierung",
        intro: "Vielen Dank. Ihre Anfrage wurde uebernommen und wir starten jetzt mit der Bearbeitung.",
        steps: [
          "Ihr Berater meldet sich zeitnah bei Ihnen.",
          "Sie koennen Unterlagen direkt im Kundenportal hochladen.",
          "Bei Rueckfragen erreichen Sie uns jederzeit per E-Mail oder Telefon.",
        ],
      })
      const nextStepsMail = await sendEmail({
        to: customer.email,
        subject: "Naechste Schritte zur Baufinanzierung",
        html: nextStepsHtml,
      })
      nextStepsMailSent = !!nextStepsMail.ok
    }

    if (caseId) {
      const { data: caseRow } = await admin
        .from("cases")
        .select("id,assigned_advisor_id")
        .eq("id", caseId)
        .maybeSingle()

      if (caseRow) {
        const caseAdvisorId = caseRow.assigned_advisor_id ?? null
        if (caseAdvisorId !== advisorId) {
          const { error: caseUpdateError } = await admin
            .from("cases")
            .update({ assigned_advisor_id: advisorId })
            .eq("id", caseId)
          if (caseUpdateError) throw caseUpdateError
        }
      }
    }

    const { error } = await admin
      .from("webhook_leads")
      .update({
        assigned_advisor_id: advisorId,
        assigned_at: advisorId ? new Date().toISOString() : null,
        linked_case_id: caseId ?? null,
      })
      .eq("id", leadId)

    if (error) throw error

    if (caseId && advisorId && isAdvisorChanged) {
      await logCaseEvent({
        caseId,
        actorRole: "admin",
        type: "advisor_assigned",
        title: "Ansprechpartner aktualisiert",
        body: "Ihr Ansprechpartner wurde aktualisiert.",
      })
      const advisorMail = await sendAdvisorAssignedEmail({ caseId })
      advisorMailSent = !!advisorMail.ok
    }

    return NextResponse.json({
      ok: true,
      leadId,
      caseId: caseId ?? null,
      caseCreated,
      invited,
      existingAccount,
      passwordInviteSent,
      nextStepsMailSent,
      advisorMailSent,
      message: caseCreated
        ? "Berater zugewiesen, Konto/Fall angelegt und Mails versendet."
        : "Beraterzuweisung gespeichert.",
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
