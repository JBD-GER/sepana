export const runtime = "nodejs"

import path from "node:path"
import { PDFDocument } from "pdf-lib"
import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import {
  SEPARATE_MANDATE_TITLE,
  detectSchufaFreeContractVariant,
  getSchufaFreeContractPackageItems,
  isSchufaFreeContractPackageTitle,
  type SchufaFreeContractPackageItem,
} from "@/lib/schufa-frei/contractPackage"
import { fillSchufaFreeServiceProvisionSlipPdf } from "@/lib/schufa-frei/signatureDocuments"
import { getSchufaFreeProvisionInvoiceNumber } from "@/lib/schufa-frei/provisionInvoice"
import {
  getSchufaFreeSignatureInvoiceGateMessage,
  loadSchufaFreeSignatureInvoiceGate,
} from "@/lib/schufa-frei/signatureInvoiceGate"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 160)
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function resolveSiteUrl() {
  const fallback = "https://www.sepana.de"
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (!raw) return fallback
  try {
    return new URL(raw).origin
  } catch {
    return fallback
  }
}

async function canAccessSchufaFreeCase(admin: ReturnType<typeof supabaseAdmin>, caseId: string, userId: string, role: string | null) {
  const { data: caseRow } = await admin
    .from("cases")
    .select("id,case_ref,case_type,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (!caseRow) return { allowed: false as const, caseRow: null }
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return { allowed: false as const, caseRow }
  }
  if (role === "admin") return { allowed: true as const, caseRow }
  if (role === "advisor" && caseRow.assigned_advisor_id === userId) return { allowed: true as const, caseRow }
  return { allowed: false as const, caseRow }
}

async function resolveSigmaProviderId(admin: ReturnType<typeof supabaseAdmin>) {
  const { data: providers } = await admin
    .from("providers")
    .select("id,name")
    .ilike("name", "%sigma%")
    .limit(10)

  return providers?.find((provider) => String(provider.name ?? "").toLowerCase().includes("sigma"))?.id ?? null
}

async function splitPdfPackage(pdfBytes: Uint8Array, items: SchufaFreeContractPackageItem[]) {
  const source = await PDFDocument.load(pdfBytes)
  const pageCount = source.getPageCount()
  const variant = detectSchufaFreeContractVariant(pageCount)
  if (!variant) {
    throw new Error(`Das PDF hat ${pageCount} Seiten. Erwartet werden 17 Seiten ohne Abtretung oder 19 Seiten mit Abtretung.`)
  }

  const outputs: Array<SchufaFreeContractPackageItem & { bytes: Uint8Array }> = []
  for (const item of items) {
    const next = await PDFDocument.create()
    const pageIndexes = Array.from({ length: item.pageTo - item.pageFrom + 1 }, (_, index) => item.pageFrom - 1 + index)
    const copiedPages = await next.copyPages(source, pageIndexes)
    copiedPages.forEach((page) => next.addPage(page))
    outputs.push({
      ...item,
      bytes: await next.save(),
    })
  }

  return { outputs, pageCount, variant }
}

async function removeExistingPackageRequests(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const { data: requestRows } = await admin
    .from("case_signature_requests")
    .select("id,title")
    .eq("case_id", caseId)

  const requestIds = (requestRows ?? [])
    .filter((row) => isSchufaFreeContractPackageTitle(row.title))
    .map((row) => String(row.id))
    .filter(Boolean)

  if (!requestIds.length) return

  const { data: docs } = await admin
    .from("documents")
    .select("id,file_path")
    .in("signature_request_id", requestIds)

  const documentIds = (docs ?? []).map((row) => trimOrNull(row.id)).filter((value): value is string => Boolean(value))
  const filePaths = Array.from(
    new Set((docs ?? []).map((row) => trimOrNull(row.file_path)).filter((value): value is string => Boolean(value)))
  )

  if (filePaths.length) {
    try {
      await admin.storage.from("case_documents").remove(filePaths)
    } catch {
      // ignore cleanup failure for replaced packages
    }
  }
  if (documentIds.length) {
    try {
      await admin.from("case_skag_documents").delete().in("local_document_id", documentIds)
    } catch {
      // ignore cleanup failure for replaced packages
    }
  }

  try {
    await admin.from("case_signature_field_values").delete().in("request_id", requestIds)
  } catch {}
  try {
    await admin.from("case_signature_events").delete().in("request_id", requestIds)
  } catch {}
  try {
    await admin.from("documents").delete().in("signature_request_id", requestIds)
  } catch {}
  try {
    await admin.from("case_signature_requests").delete().in("id", requestIds)
  } catch {}
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const form = await req.formData().catch(() => null)
  const caseId = trimOrNull(form?.get("caseId"))
  const file = form?.get("file")

  if (!caseId || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "caseId oder Datei fehlt" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const access = await canAccessSchufaFreeCase(admin, caseId, user.id, role)
  if (!access.caseRow) return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  if (!access.allowed) {
    const isWrongCaseType = String(access.caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei"
    return NextResponse.json(
      { ok: false, error: isWrongCaseType ? "case_type_not_supported" : "Forbidden" },
      { status: isWrongCaseType ? 409 : 403 }
    )
  }

  let invoiceGate
  try {
    invoiceGate = await loadSchufaFreeSignatureInvoiceGate(admin, caseId)
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Rechnung konnte nicht geladen werden.",
      },
      { status: 400 }
    )
  }
  const serviceFeeInvoice = invoiceGate.invoice
  if (!invoiceGate.ready || !serviceFeeInvoice?.id) {
    return NextResponse.json(
      {
        ok: false,
        error: getSchufaFreeSignatureInvoiceGateMessage(invoiceGate.reason),
      },
      { status: 409 }
    )
  }

  const originalBytes = new Uint8Array(await file.arrayBuffer())
  let pageCount = 0
  let variant = detectSchufaFreeContractVariant(0)

  try {
    const probe = await PDFDocument.load(originalBytes)
    pageCount = probe.getPageCount()
    variant = detectSchufaFreeContractVariant(pageCount)
    if (!variant) {
      return NextResponse.json(
        {
          ok: false,
          error: `Das hochgeladene Dokument hat ${pageCount} Seiten. Unterstützt werden 17 Seiten ohne Abtretung und 19 Seiten mit Abtretung.`,
        },
        { status: 409 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "PDF konnte nicht verarbeitet werden.",
      },
      { status: 400 }
    )
  }

  const packageItems = getSchufaFreeContractPackageItems(variant)
  const providerId = await resolveSigmaProviderId(admin)
  const fileBaseName = path.parse(file.name || "vertragspaket.pdf").name || "vertragspaket"
  const createdRequestIds: string[] = []
  const createdFilePaths: string[] = []
  const createdDocumentIds: string[] = []
  const now = new Date().toISOString()

  try {
    const { outputs } = await splitPdfPackage(originalBytes, packageItems)

    await removeExistingPackageRequests(admin, caseId)

    for (const item of outputs) {
      const initialStatus = item.requiresWetSignature || item.fields.length ? "pending" : "completed"
      const { data: requestRow, error: requestError } = await admin
        .from("case_signature_requests")
        .insert({
          case_id: caseId,
          title: item.title,
          provider_id: providerId,
          requires_wet_signature: item.requiresWetSignature,
          fields: item.fields,
          created_by: user.id,
          status: initialStatus,
          customer_notified_at: now,
        })
        .select("id")
        .single()

      if (requestError || !requestRow?.id) {
        throw new Error(requestError?.message ?? `Dokument ${item.title} konnte nicht angelegt werden.`)
      }

      createdRequestIds.push(requestRow.id)

      const fileName = `${safeFileName(fileBaseName)}_${safeFileName(item.title)}.pdf`
      const storagePath = `${caseId}/signature/${requestRow.id}/${Date.now()}_${fileName}`
      const documentBytes =
        item.key === "service_fee"
          ? await fillSchufaFreeServiceProvisionSlipPdf({
              originalBytes: item.bytes,
              amountTotal: Number(serviceFeeInvoice.amount_total ?? 0),
              invoiceNumber: getSchufaFreeProvisionInvoiceNumber(serviceFeeInvoice.invoice_number),
              caseRef: trimOrNull(access.caseRow.case_ref) ?? caseId,
            })
          : item.bytes
      const uploadResult = await admin.storage
        .from("case_documents")
        .upload(storagePath, documentBytes, { upsert: true, contentType: "application/pdf" })
      if (uploadResult.error) throw uploadResult.error

      createdFilePaths.push(storagePath)

      const { data: documentRow, error: documentError } = await admin
        .from("documents")
        .insert({
          case_id: caseId,
          signature_request_id: requestRow.id,
          document_kind: "signature_original",
          uploaded_by: user.id,
          file_path: storagePath,
          file_name: fileName,
          mime_type: "application/pdf",
          size_bytes: documentBytes.length,
        })
        .select("id")
        .single()

      if (documentError || !documentRow?.id) {
        throw new Error(documentError?.message ?? `Dokument ${item.title} konnte nicht gespeichert werden.`)
      }

      createdDocumentIds.push(documentRow.id)
    }

    const caseMeta = await getCaseMeta(caseId)
    const ctaUrl = new URL(`/app/faelle/${encodeURIComponent(caseId)}#schufa-signatur`, resolveSiteUrl()).toString()
    if (caseMeta?.customer_email) {
      const steps = [
        `${SEPARATE_MANDATE_TITLE}: bitte zuerst prüfen und digital unterschreiben.`,
        ...packageItems.map((item) => {
        if (item.key === "insurance_optional") return `${item.title}: nur unterschreiben, wenn der Ratenschutz gewünscht ist.`
        if (item.key === "assignment") return `${item.title}: im Original unterschreiben, scannen und wieder hochladen.`
        if (!item.fields.length) return `${item.title}: ansehen oder herunterladen, keine Unterschrift erforderlich.`
        return `${item.title}: im Portal prüfen und unterschreiben.`
        }),
      ]

      const html = buildEmailHtml({
        title: "Ihre Vertragsunterlagen sind bereit",
        intro: "Ihr Schufa-frei-Kreditvertrag wurde in einzelne Schritte aufgeteilt und steht jetzt im Portal bereit.",
        steps,
        ctaLabel: "Unterlagen öffnen",
        ctaUrl,
        preheader: "Bitte prüfen Sie Ihre Vertragsunterlagen jetzt Schritt für Schritt im Portal.",
        eyebrow: "Vertrag & Signatur",
      })

      await sendEmail({
        to: caseMeta.customer_email,
        subject: "Ihre Vertragsunterlagen sind bereit",
        html,
      }).catch(() => null)
    }

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role ?? "advisor",
      type: "signature_requested",
      title: "Schufa-frei-Vertragspaket bereitgestellt",
      body: `Das Vertragspaket wurde automatisch in ${outputs.length} Dokumente aufgeteilt und zur Unterschrift bereitgestellt.`,
      meta: {
        variant,
        page_count: pageCount,
        documents: outputs.map((item) => item.title),
      },
      notifyAdvisor: false,
    }).catch(() => null)

    return NextResponse.json({
      ok: true,
      variant,
      pageCount,
      createdCount: outputs.length,
      message: `Das Vertragspaket wurde automatisch in ${outputs.length} Dokumente aufgeteilt.`,
    })
  } catch (error) {
    if (createdFilePaths.length) {
      try {
        await admin.storage.from("case_documents").remove(createdFilePaths)
      } catch {}
    }
    if (createdDocumentIds.length) {
      try {
        await admin.from("case_skag_documents").delete().in("local_document_id", createdDocumentIds)
      } catch {}
    }
    if (createdRequestIds.length) {
      try {
        await admin.from("case_signature_field_values").delete().in("request_id", createdRequestIds)
      } catch {}
      try {
        await admin.from("case_signature_events").delete().in("request_id", createdRequestIds)
      } catch {}
      try {
        await admin.from("documents").delete().in("signature_request_id", createdRequestIds)
      } catch {}
      try {
        await admin.from("case_signature_requests").delete().in("id", createdRequestIds)
      } catch {}
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Vertragspaket konnte nicht importiert werden.",
      },
      { status: 500 }
    )
  }
}
