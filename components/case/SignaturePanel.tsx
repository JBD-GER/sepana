"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useRouter } from "next/navigation"
import {
  getSchufaFreeSignatureRequestMeta,
  isSignatureRequestComplete,
  isSchufaSignatureRequestLockedUntilInvoice,
  shouldSyncSchufaSignatureRequestToSkag,
} from "@/lib/schufa-frei/contractPackage"

type ProviderItem = {
  provider: { id: string; name: string }
}

type SignatureField = {
  id: string
  owner: "advisor" | "customer"
  type: "signature" | "checkbox" | "text"
  label: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

type SignatureDoc = {
  id: string
  file_name: string
  file_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  document_kind: "signature_original" | "signature_signed"
}

type SkagDocumentStatus = {
  local_document_id?: string | null
  upload_status?: string | null
  last_error?: string | null
}

type SignatureRequest = {
  id: string
  case_id: string
  title: string
  provider_id: string | null
  provider_name?: string | null
  requires_wet_signature: boolean
  fields: SignatureField[]
  my_values?: Record<string, any> | null
  values_by_role?: {
    advisor?: Record<string, any> | null
    customer?: Record<string, any> | null
  } | null
  advisor_signed_at: string | null
  customer_signed_at: string | null
  status: string
  created_at?: string | null
  documents: SignatureDoc[]
}

type SaveFieldsOptions = {
  reopenCustomerSignature?: boolean
}

function fileUrl(
  path: string,
  rawOrOpts: boolean | { raw?: boolean; download?: boolean; filename?: string } = false
) {
  const opts = typeof rawOrOpts === "boolean" ? { raw: rawOrOpts } : rawOrOpts
  const rawParam = opts.raw ? "&raw=1" : ""
  const downloadParam = opts.download ? "&download=1" : ""
  const filenameParam = opts.filename ? `&filename=${encodeURIComponent(opts.filename)}` : ""
  return `/api/baufi/logo?bucket=case_documents&path=${encodeURIComponent(path)}${rawParam}${downloadParam}${filenameParam}`
}

function formatBytes(n: number | null | undefined) {
  if (!n || Number.isNaN(n)) return "--"
  const units = ["B", "KB", "MB", "GB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function shortIso(ts?: string | null) {
  if (!ts) return "--"
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(new Date(ts))
  } catch {
    return ts
  }
}

function getCustomerRequestStatus(input: {
  isComplete: boolean
  lockedUntilInvoice: boolean
  downloadOnly: boolean
  requiresWetSignature: boolean
  optional: boolean
}) {
  if (input.lockedUntilInvoice) {
    return {
      label: "Wartet auf Freigabe",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    }
  }
  if (input.isComplete) {
    return {
      label: "Erledigt",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    }
  }
  if (input.downloadOnly) {
    return {
      label: "Nur zur Info",
      className: "border-slate-200 bg-white text-slate-600",
    }
  }
  if (input.requiresWetSignature) {
    return {
      label: "Original nötig",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    }
  }
  if (input.optional) {
    return {
      label: "Optional",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    }
  }
  return {
    label: "Jetzt offen",
    className: "border-slate-900 bg-slate-900 text-white",
  }
}

function normalizeProviderName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function providerMatchesName(candidate?: string | null, expected?: string | null) {
  const normalizedCandidate = normalizeProviderName(candidate)
  const normalizedExpected = normalizeProviderName(expected)
  if (!normalizedCandidate || !normalizedExpected) return false
  return (
    normalizedCandidate === normalizedExpected ||
    normalizedCandidate.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedCandidate)
  )
}

function uuidLike() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

type PdfError = "password_required" | "load_failed" | null

let pdfWorkerConfigured = false
function ensurePdfWorker(pdfjs: any) {
  if (pdfWorkerConfigured) return
  try {
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString()
      pdfWorkerConfigured = true
    }
  } catch {
    // fallback to public worker
    try {
      if (pdfjs?.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        pdfWorkerConfigured = true
      }
    } catch {
      // noop
    }
  }
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ width: el.clientWidth || 0, height: el.clientHeight || 0 })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

function AutoFitText({
  text,
  baseSize = 11,
  minSize = 7,
  className = "",
}: {
  text: string
  baseSize?: number
  minSize?: number
  className?: string
}) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const measureRef = useRef<HTMLSpanElement | null>(null)
  const [fontSize, setFontSize] = useState(baseSize)

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const measure = measureRef.current
    if (!wrapper || !measure) return
    let frame = 0
    const compute = () => {
      frame = 0
      const style = window.getComputedStyle(wrapper)
      const paddingX =
        (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)
      const available = wrapper.clientWidth - paddingX
      if (!available || available <= 0) return
      const fullWidth = measure.scrollWidth || 0
      if (!fullWidth) {
        setFontSize(baseSize)
        return
      }
      const ratio = Math.min(1, available / fullWidth)
      const next = Math.max(minSize, Math.floor(baseSize * ratio))
      setFontSize((prev) => (Math.abs(prev - next) > 0.5 ? next : prev))
    }

    compute()
    const ro = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(compute)
    })
    ro.observe(wrapper)
    return () => {
      ro.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [text, baseSize, minSize])

  return (
    <span
      ref={wrapperRef}
      className={`relative block w-full whitespace-nowrap ${className}`}
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.15 }}
    >
      <span
        ref={measureRef}
        className="absolute left-0 top-0 invisible whitespace-nowrap"
        style={{ fontSize: `${baseSize}px` }}
        aria-hidden="true"
      >
        {text}
      </span>
      {text}
    </span>
  )
}

function normalizeField(input: SignatureField): SignatureField {
  return {
    ...input,
    owner: (input as any).owner === "customer" ? "customer" : "advisor",
    page: Number(input.page || 1),
    width: Number(input.width || 18),
    height: Number((input as any).height || 6),
    x: Number((input as any).x || 10),
    y: Number((input as any).y || 10),
  }
}

function hasAdvisorFields(fields: SignatureField[] | null | undefined) {
  if (!Array.isArray(fields) || fields.length === 0) return false
  return fields.some((f) => {
    const owner = String((f as any)?.owner || "").toLowerCase()
    return owner !== "customer"
  })
}

function hasCustomerFields(fields: SignatureField[] | null | undefined) {
  if (!Array.isArray(fields) || fields.length === 0) return false
  return fields.some((f) => {
    const owner = String((f as any)?.owner || "").toLowerCase()
    return owner === "customer"
  })
}

function signatureFieldTypeLabel(type: SignatureField["type"]) {
  if (type === "signature") return "Unterschrift"
  if (type === "checkbox") return "Checkbox"
  return "Eingabe"
}

function signatureFieldStepLabel(index: number, total: number) {
  return `Schritt ${index} von ${total}`
}

function remainingFieldLabel(count: number) {
  if (count === 1) return "1 offene Stelle"
  return `${count} offene Stellen`
}

function isFieldFilled(field: SignatureField, value: unknown) {
  if (field.type === "checkbox") return value === true
  if (field.type === "signature") return typeof value === "string" && value.trim().length > 0
  return String(value ?? "").trim().length > 0
}

function compareSignatureRequests(a: SignatureRequest, b: SignatureRequest) {
  const metaA = getSchufaFreeSignatureRequestMeta({
    title: a.title,
    requiresWetSignature: a.requires_wet_signature,
    fields: a.fields,
  })
  const metaB = getSchufaFreeSignatureRequestMeta({
    title: b.title,
    requiresWetSignature: b.requires_wet_signature,
    fields: b.fields,
  })

  if (metaA.order !== metaB.order) return metaA.order - metaB.order

  const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
  const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
  return dateA - dateB
}

export default function SignaturePanel({
  caseId,
  canEdit,
  fixedProviderName,
  providerProduct = "baufi",
  uploadMode = "standard",
  advisorSignedDocumentActionLabel,
  skagDocumentStatuses = [],
  contractSigningUnlocked = true,
}: {
  caseId: string
  canEdit: boolean
  fixedProviderName?: string
  providerProduct?: "baufi" | "konsum"
  uploadMode?: "standard" | "schufaFreePackage"
  advisorSignedDocumentActionLabel?: string
  skagDocumentStatuses?: SkagDocumentStatus[]
  contractSigningUnlocked?: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<SignatureRequest[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [title, setTitle] = useState("")
  const [providerId, setProviderId] = useState("")
  const [requiresWet, setRequiresWet] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const lockedProviderLabel = fixedProviderName?.trim() ?? ""
  const lockedProvider = lockedProviderLabel
    ? providers.find((entry) => providerMatchesName(entry.provider?.name, lockedProviderLabel)) ?? null
    : null
  const lockedProviderId = lockedProvider?.provider?.id ?? ""

  useEffect(() => {
    ;(async () => {
      const res = await fetch(`/api/app/signatures?caseId=${encodeURIComponent(caseId)}`)
      const json = await res.json().catch(() => ({}))
      if (res.ok) setItems(Array.isArray(json?.items) ? json.items : [])
    })()
  }, [caseId])

  useEffect(() => {
    if (!canEdit) return
    ;(async () => {
      const res = await fetch(`/api/baufi/providers?product=${providerProduct}`)
      const json = await res.json().catch(() => ({}))
      const list = Array.isArray(json?.items) ? json.items : []
      setProviders(list)
    })()
  }, [canEdit, providerProduct])

  useEffect(() => {
    if (!lockedProviderLabel || !lockedProviderId) return
    if (providerId === lockedProviderId) return
    setProviderId(lockedProviderId)
  }, [lockedProviderId, lockedProviderLabel, providerId])

  useEffect(() => {
    const providerName = providers.find((p) => p.provider.id === providerId)?.provider?.name ?? ""
    if (providerName.toLowerCase().includes("commerzbank")) {
      setRequiresWet(true)
    }
  }, [providerId, providers])

  async function refresh() {
    const res = await fetch(`/api/app/signatures?caseId=${encodeURIComponent(caseId)}`)
    const json = await res.json().catch(() => ({}))
    if (res.ok) setItems(Array.isArray(json?.items) ? json.items : [])
  }

  async function createRequest() {
    if (uploadMode === "schufaFreePackage" && !contractSigningUnlocked) {
      setMsg("Bitte zuerst die interne Servicepauschalenrechnung anlegen. Erst danach wird der Vertragsbereich freigeschaltet.")
      return
    }
    if (!file) {
      setMsg(uploadMode === "schufaFreePackage" ? "Bitte das Vertragspaket hochladen." : "Bitte Titel und Datei angeben.")
      return
    }
    if (uploadMode !== "schufaFreePackage" && !title.trim()) {
      setMsg("Bitte Titel und Datei angeben.")
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const form = new FormData()
      form.append("caseId", caseId)
      form.append("file", file)
      if (uploadMode !== "schufaFreePackage") {
        form.append("title", title.trim())
        if (providerId) form.append("providerId", providerId)
        form.append("requiresWet", requiresWet ? "1" : "0")
      }

      const res = await fetch(
        uploadMode === "schufaFreePackage"
          ? "/api/app/cases/schufa-frei/signature-package"
          : "/api/app/signatures",
        { method: "POST", body: form }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Fehler")
      setTitle("")
      setProviderId(lockedProviderId)
      setRequiresWet(false)
      setFile(null)
      setMsg(String(json?.message ?? "Dokument erfolgreich angelegt."))
      await refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  async function saveFields(requestId: string, fields: SignatureField[], opts?: SaveFieldsOptions) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/signatures", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: requestId,
          fields,
          reopenCustomerSignature: opts?.reopenCustomerSignature === true,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Fehler")
      await refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  async function uploadSigned(requestId: string, files: FileList) {
    setBusy(true)
    setMsg(null)
    try {
      const form = new FormData()
      form.append("caseId", caseId)
      form.append("requestId", requestId)
      for (const f of Array.from(files)) form.append("file", f)
      const res = await fetch("/api/app/signatures/upload", { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Fehler")
      await refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  async function submitDigital(requestId: string, values: Record<string, any>) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/signatures/fields/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, values }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Fehler")
      await refresh()
      return true
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submitSignedDocumentToSkag(requestId: string, documentId: string) {
    if (!canEdit || !advisorSignedDocumentActionLabel) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/cases/schufa-frei/submit-signed-contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, requestId, documentId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Übermittlung fehlgeschlagen")
      setMsg(String(json?.message ?? "Dokument erfolgreich an SKAG übermittelt."))
      await refresh()
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Übermittlung fehlgeschlagen")
    } finally {
      setBusy(false)
    }
  }

  async function generateBankSubmission() {
    if (!canEdit || uploadMode !== "schufaFreePackage") return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/cases/schufa-frei/bank-submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Bankeinreichung konnte nicht erzeugt werden.")
      setMsg(String(json?.message ?? "Die Bankeinreichung wurde erzeugt und an SKAG übermittelt."))
      await refresh()
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Bankeinreichung konnte nicht erzeugt werden.")
    } finally {
      setBusy(false)
    }
  }

  async function deleteSignedDocument(docId: string) {
    if (!canEdit) return
    if (!confirm("Signiertes Dokument wirklich löschen?")) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/documents/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: docId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Löschen fehlgeschlagen")
      await refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  async function deleteSignatureRequest(requestId: string) {
    if (!canEdit) return
    if (
      !confirm(
        "Dokument komplett löschen? Dadurch werden Original, signierte Versionen, Felder und Eingaben entfernt."
      )
    ) {
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/signatures", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: requestId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Löschen fehlgeschlagen")
      await refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  const visibleItems = canEdit
    ? items
    : items.filter((req) => {
        const fields = req.fields ?? []
        const advisorOnly = hasAdvisorFields(fields) && !hasCustomerFields(fields)
        return !advisorOnly
      })
  const sortedVisibleItems = visibleItems.slice().sort(compareSignatureRequests)
  const hasSchufaFreePackageFlow = sortedVisibleItems.some((req) =>
    getSchufaFreeSignatureRequestMeta({
      title: req.title,
      requiresWetSignature: req.requires_wet_signature,
      fields: req.fields,
    }).packageRelated
  )
  const requiredSchufaFreePackageItems = items.filter((req) => {
    const meta = getSchufaFreeSignatureRequestMeta({
      title: req.title,
      requiresWetSignature: req.requires_wet_signature,
      fields: req.fields,
    })
    return meta.packageRelated && meta.completionRequired
  })
  const canGenerateBankSubmission =
    canEdit &&
    uploadMode === "schufaFreePackage" &&
    requiredSchufaFreePackageItems.length > 0 &&
    requiredSchufaFreePackageItems.every((req) =>
      isSignatureRequestComplete({
        fields: req.fields ?? [],
        requires_wet_signature: req.requires_wet_signature,
        advisor_signed_at: req.advisor_signed_at,
        customer_signed_at: req.customer_signed_at,
        status: req.status,
      })
    )

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Signaturbereich</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">Unterschriften</div>
        </div>
        {canEdit ? <div className="text-xs text-slate-500">Berater / Admin</div> : null}
      </div>

      {canEdit ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          {uploadMode === "schufaFreePackage" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <div className="text-sm font-semibold text-emerald-950">Vertragspaket automatisch aufteilen</div>
                <div className="mt-1 text-sm leading-relaxed text-emerald-900">
                  Laden Sie hier den vollständigen Schufa-frei-Kreditvertrag hoch. Das PDF wird automatisch in
                  Kreditvertrag, Ratenschutz, Serviceprovision, ggf. Abtretungserklärung und vorvertragliche
                  Informationen aufgeteilt.
                </div>
                <div className="mt-3 text-xs leading-relaxed text-emerald-800">
                  Bereits importierte Vertragspakete werden dabei ersetzt. Der Kunde erhält die Unterlagen danach
                  Schritt für Schritt im Portal.
                </div>
              </div>
              {!contractSigningUnlocked ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Bitte zuerst die interne Servicepauschalenrechnung anlegen. Erst danach werden Vertragsimport und
                  Signaturbereich freigeschaltet.
                </div>
              ) : null}

              <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                <div className="xl:w-[280px]">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bank</div>
                  <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">{lockedProviderLabel || "SIGMA Kreditbank AG"}</div>
                    <div className="mt-0.5 text-xs text-slate-500">Vertragspaket für Kredit ohne Schufa</div>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">PDF-Upload</div>
                  <label className="flex h-[50px] cursor-pointer items-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm">
                    <span className="truncate">{file?.name || "Vertragspaket wählen"}</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={!contractSigningUnlocked}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                <div className="xl:w-[230px]">
                  <button
                    onClick={createRequest}
                    disabled={busy || !contractSigningUnlocked}
                    className="flex h-[50px] w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    Vertragspaket importieren
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dokument</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dokument-Titel (z.B. Kreditvertrag)"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div className="xl:w-[240px]">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bank</div>
                {lockedProviderLabel ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
                    <div className="text-sm font-semibold text-emerald-950">{lockedProviderLabel}</div>
                    <div className="mt-0.5 text-xs text-emerald-700">Fest für Schufa-frei hinterlegt</div>
                  </div>
                ) : (
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="">Bank wählen</option>
                    {providers.map((p) => (
                      <option key={p.provider.id} value={p.provider.id}>
                        {p.provider.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="xl:w-[180px]">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Original</div>
                <label className="flex h-[50px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
                  <input
                    type="checkbox"
                    checked={requiresWet}
                    onChange={(e) => setRequiresWet(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Original nötig
                </label>
              </div>

              <div className="xl:w-[210px]">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Datei</div>
                <label className="flex h-[50px] cursor-pointer items-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm">
                  <span className="truncate">{file?.name || "Datei wählen"}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="xl:w-[210px]">
                <button
                  onClick={createRequest}
                  disabled={busy}
                  className="flex h-[50px] w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60"
                >
                  Unterschrift anfordern
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {msg ? <div className="mt-2 text-xs text-slate-600">{msg}</div> : null}

      {canGenerateBankSubmission ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <div className="text-sm font-semibold text-cyan-950">Bankeinreichung erzeugen</div>
              <div className="mt-1 text-sm leading-relaxed text-cyan-900">
                Prüft jetzt alle Pflichtunterlagen im Fall, bündelt die vollständige Reihenfolge in ein PDF und
                übermittelt die Bankeinreichung erst jetzt gesammelt an SKAG.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void generateBankSubmission()}
              disabled={busy}
              className="inline-flex h-[50px] items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60"
            >
              Bankeinreichung generieren
            </button>
          </div>
        </div>
      ) : null}

      {!canEdit && hasSchufaFreePackageFlow ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-900">
          Bitte gehe die Unterlagen Schritt für Schritt durch. Pflichtdokumente musst du unterschreiben, optionale
          Dokumente kannst du bei Bedarf auslassen und Informationsblätter stehen nur zum Download bereit.
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {sortedVisibleItems.map((req) => (
          <SignatureRequestCard
            key={req.id}
            req={req}
            canEdit={canEdit}
            busy={busy}
            fallbackProviderName={lockedProviderLabel || undefined}
            advisorSignedDocumentActionLabel={advisorSignedDocumentActionLabel}
            skagDocumentStatuses={skagDocumentStatuses}
            contractSigningUnlocked={contractSigningUnlocked}
            onSaveFields={saveFields}
            onUploadSigned={uploadSigned}
            onSubmitDigital={submitDigital}
            onSubmitSignedDocumentToSkag={submitSignedDocumentToSkag}
            onDeleteSignedDocument={deleteSignedDocument}
            onDeleteRequest={deleteSignatureRequest}
          />
        ))}

        {sortedVisibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            Noch keine Unterschriften angefordert.
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SignatureRequestCard({
  req,
  canEdit,
  busy,
  fallbackProviderName,
  advisorSignedDocumentActionLabel,
  skagDocumentStatuses,
  contractSigningUnlocked,
  onSaveFields,
  onUploadSigned,
  onSubmitDigital,
  onSubmitSignedDocumentToSkag,
  onDeleteSignedDocument,
  onDeleteRequest,
}: {
  req: SignatureRequest
  canEdit: boolean
  busy: boolean
  fallbackProviderName?: string
  advisorSignedDocumentActionLabel?: string
  skagDocumentStatuses: SkagDocumentStatus[]
  contractSigningUnlocked: boolean
  onSaveFields: (id: string, fields: SignatureField[], opts?: SaveFieldsOptions) => Promise<void>
  onUploadSigned: (id: string, files: FileList) => Promise<void>
  onSubmitDigital: (id: string, values: Record<string, any>) => Promise<boolean>
  onSubmitSignedDocumentToSkag: (requestId: string, documentId: string) => Promise<void>
  onDeleteSignedDocument: (id: string) => Promise<void>
  onDeleteRequest: (id: string) => Promise<void>
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const docsOriginal = (req.documents ?? []).filter((d) => d.document_kind === "signature_original")
  const docsSigned = (req.documents ?? []).filter((d) => d.document_kind === "signature_signed")
  const originalDoc = docsOriginal.length ? docsOriginal[docsOriginal.length - 1] : null
  const originalOpenUrl = originalDoc ? fileUrl(originalDoc.file_path, { raw: true }) : null
  const originalDownloadUrl = originalDoc
    ? fileUrl(originalDoc.file_path, { raw: true, download: true, filename: originalDoc.file_name })
    : null
  const primarySigned = docsSigned.length ? docsSigned[docsSigned.length - 1] : null
  const signedDownloadUrl = primarySigned
    ? fileUrl(primarySigned.file_path, {
        raw: true,
        download: true,
        filename: primarySigned.file_name,
      })
    : null
  const advisorRequired = hasAdvisorFields(req.fields)
  const customerRequired = hasCustomerFields(req.fields)
  const advisorOnly = advisorRequired && !customerRequired
  const meta = getSchufaFreeSignatureRequestMeta({
    title: req.title,
    requiresWetSignature: req.requires_wet_signature,
    fields: req.fields,
  })
  const lockedUntilInvoice = !contractSigningUnlocked && isSchufaSignatureRequestLockedUntilInvoice(req.title)
  const downloadOnly = meta.downloadOnly || (!advisorRequired && !customerRequired && !req.requires_wet_signature)
  const isComplete = req.requires_wet_signature
    ? !!req.customer_signed_at
    : (!advisorRequired || !!req.advisor_signed_at) && (!customerRequired || !!req.customer_signed_at)
  const hasAnySignature = !!req.advisor_signed_at || !!req.customer_signed_at
  const finalDoc = isComplete ? primarySigned : null
  const statusLabel = isComplete ? "Abgeschlossen" : hasAnySignature ? "Gestartet" : "Entwurf"
  const alreadySigned = canEdit ? !!req.advisor_signed_at : !!req.customer_signed_at
  const advisorLabel = advisorRequired ? (req.advisor_signed_at ? shortIso(req.advisor_signed_at) : "--") : "nicht erforderlich"
  const allowEditor = canEdit && !downloadOnly && !lockedUntilInvoice
  const canOpenSign = lockedUntilInvoice
    ? false
    : downloadOnly
      ? false
      : req.requires_wet_signature
        ? !canEdit
        : canEdit
          ? advisorRequired
          : customerRequired
  const providerLabel = req.provider_name || fallbackProviderName || "--"
  const allowSignedDocumentAction = Boolean(advisorSignedDocumentActionLabel) && shouldSyncSchufaSignatureRequestToSkag(req.title)
  const finalDocSync = finalDoc
    ? skagDocumentStatuses.find((item) => String(item.local_document_id ?? "").trim() === finalDoc.id)
    : null
  const finalDocUploaded = String(finalDocSync?.upload_status ?? "").trim().toLowerCase() === "uploaded"
  const finalDocUploadError = String(finalDocSync?.last_error ?? "").trim() || null
  const actionLabel = req.requires_wet_signature ? "Original hochladen" : meta.actionLabel
  const customerValues = req.values_by_role?.customer ?? {}
  const customerFields = (req.fields ?? []).map(normalizeField).filter((field) => field.owner === "customer")
  const customerOpenFieldCount = customerFields.filter((field) => !isFieldFilled(field, customerValues[field.id])).length
  const customerActionLabel =
    !canEdit && canOpenSign && !req.requires_wet_signature && customerFields.length > 0
      ? "Dokument oeffnen und unterschreiben"
      : actionLabel
  const customerStatus = getCustomerRequestStatus({
    isComplete,
    lockedUntilInvoice,
    downloadOnly,
    requiresWetSignature: req.requires_wet_signature,
    optional: meta.optional,
  })
  const customerCardClass = lockedUntilInvoice
    ? "border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,1),rgba(255,255,255,0.98))]"
    : isComplete
      ? "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(255,255,255,0.98))]"
      : "border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]"

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${canEdit ? "border-slate-200 bg-slate-50" : customerCardClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">{req.title}</div>
            {meta.stepLabel ? (
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {meta.stepLabel}
              </span>
            ) : null}
            {meta.kindLabel ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                {meta.kindLabel}
              </span>
            ) : null}
            {lockedUntilInvoice ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Rechnung fehlt
              </span>
            ) : null}
            {advisorOnly ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Beraterdokument
              </span>
            ) : null}
          </div>
          {canEdit ? (
            <>
              <div className="text-xs text-slate-500">
                Bank: {providerLabel} - Status: {statusLabel} - Erstellt: {shortIso(req.created_at)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Berater: {advisorLabel} · Kunde: {req.customer_signed_at ? shortIso(req.customer_signed_at) : "--"}
              </div>
              {originalDoc ? <div className="mt-1 text-xs text-slate-600">Datei: {originalDoc.file_name}</div> : null}
              {meta.description ? <div className="mt-2 text-xs leading-relaxed text-slate-600">{meta.description}</div> : null}
            </>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
                  Bank: {providerLabel}
                </span>
                <span className={`rounded-full border px-2.5 py-1 font-semibold ${customerStatus.className}`}>
                  {customerStatus.label}
                </span>
                {finalDoc ? (
                  <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-700">
                    Finale PDF verfügbar
                  </span>
                ) : originalDoc ? (
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-500">
                    PDF bereit
                  </span>
                ) : null}
              </div>
              {meta.description ? (
                <div className="mt-3 text-sm leading-relaxed text-slate-700">{meta.description}</div>
              ) : null}
              {isComplete && !finalDoc ? (
                <div className="mt-2 text-xs text-emerald-700">Dieser Schritt ist bereits abgeschlossen.</div>
              ) : null}
            </>
          )}
          {lockedUntilInvoice ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              Dieses Dokument wird erst nach Anlage der internen Servicepauschalenrechnung zur Unterschrift freigeschaltet.
            </div>
          ) : null}
          {req.requires_wet_signature ? (
            <div className="mt-1 text-xs text-rose-600">
              Original erforderlich (jede Seite scannen/fotografieren und hochladen).
            </div>
          ) : null}
          {!canEdit && canOpenSign && !alreadySigned && !req.requires_wet_signature && customerFields.length > 0 ? (
            <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-xs leading-relaxed text-sky-900">
              <div className="font-semibold">Handy-Hinweis</div>
              <div className="mt-1">
                Nach dem Oeffnen startet der Unterschriftsbereich direkt. In diesem Dokument warten noch{" "}
                {remainingFieldLabel(customerOpenFieldCount)} auf Sie.
              </div>
            </div>
          ) : null}
          {finalDoc ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-900">Finales Dokument</div>
                  <div className="mt-0.5 text-[11px] text-emerald-700">
                    {finalDoc.file_name} · {shortIso(finalDoc.created_at)} · {formatBytes(finalDoc.size_bytes)}
                  </div>
                </div>
                {signedDownloadUrl ? (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <a
                      href={signedDownloadUrl}
                      download
                      className="inline-flex w-full items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm sm:w-auto"
                    >
                      PDF herunterladen
                    </a>
                    {canEdit && allowSignedDocumentAction ? (
                      finalDocUploaded ? (
                        <div className="inline-flex w-full items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 px-3 py-2 text-[11px] font-semibold text-cyan-800 shadow-sm sm:w-auto">
                          An SKAG übermittelt
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (finalDoc) void onSubmitSignedDocumentToSkag(req.id, finalDoc.id)
                          }}
                          disabled={busy || !finalDoc}
                          className="inline-flex w-full items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 px-3 py-2 text-[11px] font-semibold text-cyan-800 shadow-sm transition hover:border-cyan-400 disabled:opacity-60 sm:w-auto"
                        >
                          {advisorSignedDocumentActionLabel}
                        </button>
                      )
                    ) : null}
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (primarySigned) void onDeleteSignedDocument(primarySigned.id)
                        }}
                        disabled={busy}
                        className="inline-flex w-full items-center justify-center rounded-full border border-rose-300 bg-white px-3 py-2 text-[11px] font-semibold text-rose-700 shadow-sm disabled:opacity-60 sm:w-auto"
                      >
                        Löschen
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {docsSigned.length > 1 ? (
                <div className="mt-2 space-y-1 text-[11px] text-emerald-700">
                  <div className="font-medium text-emerald-900">Weitere Versionen</div>
                  {docsSigned.slice(0, -1).map((d) => (
                    <div key={d.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <a
                        href={fileUrl(d.file_path, { raw: true, download: true, filename: d.file_name })}
                        download
                        className="block hover:underline"
                      >
                        {d.file_name} · {shortIso(d.created_at)} · {formatBytes(d.size_bytes)}
                      </a>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => onDeleteSignedDocument(d.id)}
                          disabled={busy}
                          className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white px-2 py-1 text-[10px] font-semibold text-rose-700 disabled:opacity-60"
                        >
                          Löschen
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 text-[11px] text-emerald-700">
                Enthält Protokoll (Audit-Log) der Unterschriften.
              </div>
              {canEdit && allowSignedDocumentAction && finalDocUploadError && !finalDocUploaded ? (
                <div className="mt-2 text-[11px] text-rose-700">SKAG-Uploadfehler: {finalDocUploadError}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={`flex w-full flex-col gap-2 ${canEdit ? "sm:w-auto sm:flex-row sm:flex-wrap" : "sm:w-[290px] sm:items-end"}`}>
          {allowEditor ? (
            <button
              onClick={() => setEditorOpen(true)}
              className="w-full rounded-full border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 sm:w-auto sm:py-1"
            >
              Editor öffnen
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={() => onDeleteRequest(req.id)}
              disabled={busy}
              className="w-full rounded-full border border-rose-300 bg-white px-3 py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-60 sm:w-auto sm:py-1"
            >
              Dokument komplett löschen
            </button>
          ) : null}
          {!canEdit && canOpenSign ? (
            <button
              onClick={() => setSignOpen(true)}
              className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition sm:min-w-[220px] sm:py-2 ${
                alreadySigned
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-100"
                  : "border-slate-900 bg-slate-900 text-white ring-4 ring-slate-100 hover:bg-slate-800"
              } disabled:cursor-default disabled:opacity-100`}
              disabled={alreadySigned}
            >
              {alreadySigned ? "Bereits unterschrieben" : customerActionLabel}
            </button>
          ) : null}
          {finalDoc && signedDownloadUrl ? (
            <a
              href={signedDownloadUrl}
              download
              className="w-full rounded-full border border-emerald-600 bg-emerald-600 px-3 py-2 text-center text-[11px] font-semibold text-white shadow-sm sm:w-auto sm:py-1"
            >
              {canEdit ? "Signed PDF" : "Abgeschlossene PDF"}
            </a>
          ) : null}
          {originalOpenUrl ? (
            <a
              href={originalOpenUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-full border border-slate-300 bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-700 sm:w-auto sm:py-1"
            >
              Dokument ansehen
            </a>
          ) : null}
          {originalDownloadUrl ? (
            <a
              href={originalDownloadUrl}
              download
              className="w-full rounded-full border border-slate-300 bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-700 sm:w-auto sm:py-1"
            >
              PDF herunterladen
            </a>
          ) : null}
          {canEdit && canOpenSign ? (
            <button
              onClick={() => setSignOpen(true)}
              className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition sm:min-w-[180px] sm:w-auto sm:py-2 ${
                alreadySigned
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-100"
                  : "border-slate-900 bg-slate-900 text-white ring-4 ring-slate-100 hover:bg-slate-800"
              } disabled:cursor-default disabled:opacity-100`}
              disabled={alreadySigned}
            >
              {alreadySigned ? "Bereits unterschrieben" : actionLabel}
            </button>
          ) : !canEdit && !canOpenSign ? (
            <span className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 sm:w-auto sm:py-1">
              {downloadOnly
                ? "Nur ansehen / herunterladen"
                : req.requires_wet_signature
                  ? "Original unterschreiben und hochladen"
                  : lockedUntilInvoice
                    ? "Wird noch freigeschaltet"
                    : "Gerade nicht verfügbar"}
            </span>
          ) : (
            <span className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 sm:w-auto sm:py-1">
              {downloadOnly
                ? "Nur ansehen / herunterladen"
                : req.requires_wet_signature
                  ? canEdit
                    ? "Kunde lädt Original hoch"
                    : "Original unterschreiben und hochladen"
                  : canEdit
                    ? "Nur Kundensignatur erforderlich"
                    : "Nur Beratersignatur erforderlich"}
            </span>
          )}
        </div>
      </div>

      {editorOpen ? (
        <SignatureEditorModal
          req={req}
          canEdit={canEdit}
          busy={busy}
          fallbackProviderName={fallbackProviderName}
          onClose={() => setEditorOpen(false)}
          onSaveFields={onSaveFields}
        />
      ) : null}

      {signOpen ? (
        <SignatureSignModal
          req={req}
          canEdit={canEdit}
          busy={busy}
          onClose={() => setSignOpen(false)}
          onUploadSigned={onUploadSigned}
          onSubmitDigital={onSubmitDigital}
        />
      ) : null}
    </div>
  )
}

function SignatureEditorModal({
  req,
  canEdit,
  busy,
  fallbackProviderName,
  onClose,
  onSaveFields,
}: {
  req: SignatureRequest
  canEdit: boolean
  busy: boolean
  fallbackProviderName?: string
  onClose: () => void
  onSaveFields: (id: string, fields: SignatureField[], opts?: SaveFieldsOptions) => Promise<void>
}) {
  const [editing, setEditing] = useState(canEdit)
  const [tab, setTab] = useState<"advisor" | "customer">(
    canEdit && !req.customer_signed_at ? "advisor" : "customer"
  )
  const [fields, setFields] = useState<SignatureField[]>(req.fields ?? [])
  const [activeType, setActiveType] = useState<SignatureField["type"]>("signature")
  const [placing, setPlacing] = useState(false)
  const [page, setPage] = useState(1)
  const [pdfPassword, setPdfPassword] = useState("")
  const [pdfError, setPdfError] = useState<"password_required" | "load_failed" | null>(null)
  const [pdfErrorDetail, setPdfErrorDetail] = useState<string | null>(null)
  const [pdfReloadKey, setPdfReloadKey] = useState(0)
  const pageFrameRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const frameSize = useElementSize(pageFrameRef)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const handlePageSize = (next: { width: number; height: number }) => {
    setPageSize((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next))
  }
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    originX: number
    originY: number
    rectW: number
    rectH: number
    originW: number
    originH: number
    mode: "move" | "resize"
  } | null>(null)

  useEffect(() => setFields((req.fields ?? []).map(normalizeField)), [req.fields])
  useEffect(() => setPage(1), [tab])
  useEffect(() => setPageSize(null), [page, req.id])
  const docsOriginal = (req.documents ?? []).filter((d) => d.document_kind === "signature_original")
  const originalDoc = docsOriginal[0] ?? null
  const pdfUrl = originalDoc?.mime_type?.includes("pdf") ? fileUrl(originalDoc.file_path, true) : null
  const { doc: pdfDoc, pageCount: pdfPageCount } = usePdfDocument(
    pdfUrl,
    pdfPassword || undefined,
    (err, detail) => {
      setPdfError(err)
      setPdfErrorDetail(detail ?? null)
    },
    pdfReloadKey
  )
  const pageCount = pdfPageCount ?? Math.max(1, ...fields.map((f) => Number(f.page || 1)))
  const showPagePicker = pageCount > 1
  const pagesWithFields = new Set(fields.map((f) => f.page))

  const canReopenCustomerSignature = canEdit && !!req.customer_signed_at
  const canEditFields =
    canEdit &&
    ((!req.advisor_signed_at && !req.customer_signed_at) || canReopenCustomerSignature)
  const tabFields = fields.filter((f) => f.owner === tab && f.page === page)
  const providerLabel = req.provider_name || fallbackProviderName || "--"

  useEffect(() => {
    if (canReopenCustomerSignature && tab !== "customer") setTab("customer")
  }, [canReopenCustomerSignature, tab])

  useEffect(() => {
    setPlacing(false)
  }, [tab, editing])
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])
  useEffect(() => {
    setPdfError(null)
    setPdfErrorDetail(null)
    setPdfReloadKey(0)
  }, [originalDoc?.file_path])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  useEffect(() => setPageSize(null), [page, req.id])

  function addField(type: SignatureField["type"], pos?: { x: number; y: number }) {
    const count = fields.filter((f) => f.type === type && f.owner === tab).length
    const nextIndex = count + 1
    const width = type === "checkbox" ? 3 : type === "signature" ? 18 : 12
    const height = type === "checkbox" ? 3 : type === "signature" ? 6 : 4
    const x = clamp(pos?.x ?? 10, 0, 100 - width)
    const y = clamp(pos?.y ?? 10, 0, 100 - height)
    setFields([
      ...fields,
      { id: uuidLike(), owner: tab, type, label: `${signatureFieldTypeLabel(type)} ${nextIndex}`, page, x, y, width, height },
    ])
  }

  function onPreviewClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!canEditFields || !editing || !placing) return
    if (!pageRef.current) return
    const rect = pageRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * 100
    const relY = ((e.clientY - rect.top) / rect.height) * 100
    addField(activeType, { x: relX, y: relY })
    setPlacing(false)
  }

  function startDrag(e: ReactMouseEvent, id: string) {
    if (!canEditFields || !editing || !pageRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = pageRef.current.getBoundingClientRect()
    const f = fields.find((x) => x.id === id)
    if (!f) return
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      originX: f.x,
      originY: f.y,
      rectW: rect.width,
      rectH: rect.height,
      originW: f.width,
      originH: f.height,
      mode: "move",
    }
  }

  function startResize(e: ReactMouseEvent, id: string) {
    if (!canEditFields || !editing || !pageRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = pageRef.current.getBoundingClientRect()
    const f = fields.find((x) => x.id === id)
    if (!f) return
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      originX: f.x,
      originY: f.y,
      rectW: rect.width,
      rectH: rect.height,
      originW: f.width,
      originH: f.height,
      mode: "resize",
    }
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return
      const drag = dragRef.current
      const f = fields.find((x) => x.id === drag.id)
      if (!f) return
      const dx = ((e.clientX - drag.startX) / drag.rectW) * 100
      const dy = ((e.clientY - drag.startY) / drag.rectH) * 100
      if (drag.mode === "move") {
        const nextX = clamp(drag.originX + dx, 0, 100 - f.width)
        const nextY = clamp(drag.originY + dy, 0, 100 - f.height)
        setFields(fields.map((x) => (x.id === f.id ? { ...x, x: nextX, y: nextY } : x)))
      } else {
        const minW = f.type === "checkbox" ? 4 : 8
        const minH = f.type === "checkbox" ? 4 : 5
        const nextW = clamp(drag.originW + dx, minW, 100 - f.x)
        const nextH = clamp(drag.originH + dy, minH, 100 - f.y)
        setFields(fields.map((x) => (x.id === f.id ? { ...x, width: nextW, height: nextH } : x)))
      }
    }
    function onUp() {
      dragRef.current = null
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [fields])

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-slate-900/45 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col overflow-y-auto bg-white shadow-2xl sm:h-[85vh] sm:max-w-[1200px] sm:overflow-hidden sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 sm:px-5 sm:py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{req.title}</div>
            <div className="text-xs text-slate-500">
              Bank: {providerLabel} · Berater: {req.advisor_signed_at ? shortIso(req.advisor_signed_at) : "--"} · Kunde:{" "}
              {req.customer_signed_at ? shortIso(req.customer_signed_at) : "--"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
          >
            Schliessen
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0 xl:flex-row">
          {showPagePicker ? (
            <div className="flex w-full items-center gap-2 border-b border-slate-200 bg-slate-50 p-3 xl:w-[180px] xl:flex-col xl:items-stretch xl:border-b-0 xl:border-r">
              <div className="shrink-0 text-[11px] font-semibold text-slate-600">Seiten</div>
              <div className="flex flex-1 gap-2 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:mt-2 xl:max-h-[70vh] xl:flex-col xl:overflow-auto">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
                  const hasField = pagesWithFields.has(p)
                  const active = p === page
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`shrink-0 flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <span>Seite {p}</span>
                      {hasField ? <span className="ml-2 h-2 w-2 rounded-full bg-emerald-500" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <>
                    <button
                      onClick={() => setTab("advisor")}
                      disabled={canReopenCustomerSignature}
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        tab === "advisor" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      Berater
                    </button>
                    <button
                      onClick={() => setTab("customer")}
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        tab === "customer" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      Kunde
                    </button>
                  </>
                ) : (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] text-sky-700">Kunde</span>
                )}
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700">
                  Seite {page}
                </div>
              </div>
            </div>

            {editing && canEditFields ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <select
                  value={activeType}
                  onChange={(e) => setActiveType(e.target.value as SignatureField["type"])}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px]"
                >
                  <option value="signature">Unterschrift</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="text">Eingabe</option>
                </select>
                <button
                  onClick={() => setPlacing((v) => !v)}
                  className={`rounded-full border px-3 py-1 text-[11px] ${
                    placing ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {placing ? "Platzieren aktiv" : "Feld platzieren"}
                </button>
                <span className="text-[11px] text-slate-500">Klicke ins Dokument, um das Feld zu setzen.</span>
              </div>
            ) : null}

            {canReopenCustomerSignature ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Nachträgliche Felder sind aktiv. Mit dem Spezial-Button unten wird die Kundensignatur zurueckgesetzt
                und der Kunde per E-Mail erneut zur Unterschrift aufgefordert.
              </div>
            ) : null}

            <div
              ref={pageFrameRef}
              className="relative mt-3 min-h-[28vh] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:min-h-[38vh] xl:min-h-0"
            >
              <div
                ref={pageRef}
                className="relative mx-auto"
                style={{
                  width: pageSize ? `${pageSize.width}px` : "100%",
                  height: pageSize ? `${pageSize.height}px` : "auto",
                }}
              >
                <div className="relative w-full">
                  {originalDoc ? (
                    originalDoc.mime_type?.includes("pdf") ? (
                      <PdfPageCanvas
                        doc={pdfDoc}
                        page={page}
                        width={frameSize.width || 800}
                        maxHeight={frameSize.height || 1000}
                        onSize={handlePageSize}
                      />
                    ) : (
                      <ImagePage
                        url={fileUrl(originalDoc.file_path, true)}
                        width={frameSize.width || 800}
                        maxHeight={frameSize.height || 1000}
                        onSize={handlePageSize}
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">Kein Dokument</div>
                  )}
                </div>

                <div className="absolute inset-0 pointer-events-none">
                  {tabFields.map((f) => (
                    <div
                      key={f.id}
                      onMouseDown={(e) => startDrag(e, f.id)}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute pointer-events-auto rounded-md border-2 text-[10px] shadow-sm ${
                        f.owner === "advisor"
                          ? "border-orange-400 text-orange-700"
                          : "border-sky-400 text-sky-700"
                      }`}
                      style={{
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        width: `${f.width}%`,
                        height: `${f.height}%`,
                        background: "transparent",
                      }}
                    >
                      <AutoFitText
                        text={
                          f.label ||
                          (f.type === "signature" ? "Unterschrift" : f.type === "checkbox" ? "Checkbox" : "Eingabe")
                        }
                        baseSize={10}
                        minSize={7}
                        className="px-2 py-1"
                      />
                      {editing && canEditFields ? (
                        <div
                          onMouseDown={(e) => startResize(e, f.id)}
                          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-sm border border-slate-300 bg-white"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>

                {placing && canEditFields ? (
                  <div
                    onClick={onPreviewClick}
                    className="absolute inset-0 cursor-crosshair"
                  />
                ) : null}
              </div>
            </div>

            {originalDoc ? (
              <div className="mt-2 text-xs text-slate-500">
                <a className="hover:underline" href={fileUrl(originalDoc.file_path)} target="_blank">
                  Dokument in neuem Tab öffnen
                </a>
              </div>
            ) : null}
            {originalDoc?.mime_type?.includes("pdf") && pdfError === "password_required" ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div>PDF ist passwortgeschuetzt. Bitte Passwort eingeben.</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    placeholder="PDF Passwort"
                    className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPdfError(null)
                      setPdfErrorDetail(null)
                      setPdfReloadKey((v) => v + 1)
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-800"
                  >
                    Neu laden
                  </button>
                </div>
              </div>
            ) : null}
            {originalDoc?.mime_type?.includes("pdf") && pdfError === "load_failed" ? (
              <div className="mt-2 text-xs text-rose-600">
                PDF konnte nicht geladen werden. Bitte Datei prüfen.
                {pdfErrorDetail ? <div className="mt-1 text-[11px] text-rose-500">{pdfErrorDetail}</div> : null}
              </div>
            ) : null}

          </div>

          <div className="flex w-full min-h-0 flex-col border-t border-slate-200 bg-slate-50 p-3 sm:p-4 xl:w-[360px] xl:border-l xl:border-t-0">
            <div className="flex shrink-0 items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Felder</div>
              {canEditFields ? (
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                >
                  {editing ? "Editor-Modus aus" : "Editor-Modus an"}
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              {fields
                .filter((f) => f.owner === tab)
                .map((f) => (
                  <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                    <div className="font-medium text-slate-800">{f.label || signatureFieldTypeLabel(f.type)}</div>
                    <div className="text-[11px] text-slate-500">
                      Seite {f.page} · {Math.round(f.x)}/{Math.round(f.y)} · {Math.round(f.width)}x{Math.round(f.height)}
                    </div>
                    {editing && canEditFields ? (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <input
                          value={String(f.label)}
                          onChange={(e) =>
                            setFields(fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))
                          }
                          placeholder="Name des Felds"
                          aria-label="Name des Felds"
                          className="col-span-2 rounded border border-slate-200 px-2 py-1 text-[11px]"
                        />
                        <input
                          value={String(f.page)}
                          onChange={(e) =>
                            setFields(fields.map((x) => (x.id === f.id ? { ...x, page: Number(e.target.value || 1) } : x)))
                          }
                          type="number"
                          min={1}
                          placeholder="Seite"
                          aria-label="Seite"
                          className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                        />
                        <input
                          value={String(f.width)}
                          onChange={(e) =>
                            setFields(fields.map((x) => (x.id === f.id ? { ...x, width: Number(e.target.value || 10) } : x)))
                          }
                          type="number"
                          min={1}
                          placeholder="Breite"
                          aria-label="Breite"
                          className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                        />
                        <input
                          value={String(f.height)}
                          onChange={(e) =>
                            setFields(fields.map((x) => (x.id === f.id ? { ...x, height: Number(e.target.value || 5) } : x)))
                          }
                          type="number"
                          min={1}
                          placeholder="Höhe"
                          aria-label="Höhe"
                          className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                        />
                        <button
                          onClick={() => setFields(fields.filter((x) => x.id !== f.id))}
                          className="col-span-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700"
                        >
                          Entfernen
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>

            {editing && canEditFields ? (
              canReopenCustomerSignature ? (
                <button
                  onClick={async () => {
                    await onSaveFields(req.id, fields, { reopenCustomerSignature: true })
                    setEditing(false)
                  }}
                  disabled={busy}
                  className="mt-3 w-full rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Zusatzfeld speichern + Kunde erneut anfordern
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await onSaveFields(req.id, fields)
                    setEditing(false)
                  }}
                  disabled={busy}
                  className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Felder speichern
                </button>
              )
            ) : null}

          </div>
        </div>
      </div>
    </div>
  )
}

function SignatureSignModal({
  req,
  canEdit,
  busy,
  onClose,
  onUploadSigned,
  onSubmitDigital,
}: {
  req: SignatureRequest
  canEdit: boolean
  busy: boolean
  onClose: () => void
  onUploadSigned: (id: string, files: FileList) => Promise<void>
  onSubmitDigital: (id: string, values: Record<string, any>) => Promise<boolean>
}) {
  const actor: "advisor" | "customer" = canEdit ? "advisor" : "customer"
  const initialActorFields = (req.fields ?? [])
    .map(normalizeField)
    .filter((field) => field.owner === actor)
    .slice()
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
  const initialActorValues = req.my_values ?? {}
  const initialOpenField =
    initialActorFields.find((field) => !isFieldFilled(field, initialActorValues[field.id])) ?? initialActorFields[0] ?? null
  const [values, setValues] = useState<Record<string, any>>(req.my_values ?? {})
  const [page, setPage] = useState(initialOpenField?.page ?? 1)
  const [mobileView, setMobileView] = useState<"document" | "fields">(
    !canEdit && !req.requires_wet_signature && initialActorFields.length > 0 ? "fields" : "document"
  )
  const [pdfPassword, setPdfPassword] = useState("")
  const [pdfError, setPdfError] = useState<"password_required" | "load_failed" | null>(null)
  const [pdfErrorDetail, setPdfErrorDetail] = useState<string | null>(null)
  const [pdfReloadKey, setPdfReloadKey] = useState(0)
  const pageFrameRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const fieldCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const frameSize = useElementSize(pageFrameRef)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const handlePageSize = (next: { width: number; height: number }) => {
    setPageSize((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next))
  }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const docsOriginal = (req.documents ?? []).filter((d) => d.document_kind === "signature_original")
  const originalDoc = docsOriginal[0] ?? null
  const fields = (req.fields ?? []).map(normalizeField)
  const advisorRequired = hasAdvisorFields(fields)
  const customerRequired = hasCustomerFields(fields)
  const pdfUrl = originalDoc?.mime_type?.includes("pdf") ? fileUrl(originalDoc.file_path, true) : null
  const { doc: pdfDoc, pageCount: pdfPageCount } = usePdfDocument(
    pdfUrl,
    pdfPassword || undefined,
    (err, detail) => {
      setPdfError(err)
      setPdfErrorDetail(detail ?? null)
    },
    pdfReloadKey
  )
  const pageCount = pdfPageCount ?? Math.max(1, ...fields.map((f) => Number(f.page || 1)))
  const showPagePicker = pageCount > 1
  const pagesWithFields = new Set(fields.map((f) => f.page))
  const actorFields = fields
    .filter((f) => f.owner === actor)
    .slice()
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
  const pageFields = fields.filter((f) => f.page === page)
  const valuesByRole = req.values_by_role ?? {}
  const advisorValues = valuesByRole.advisor ?? {}
  const customerValues = valuesByRole.customer ?? {}
  const alreadySigned = canEdit ? !!req.advisor_signed_at : !!req.customer_signed_at
  const canSign = canEdit
    ? advisorRequired
    : customerRequired
      ? !advisorRequired || !!req.advisor_signed_at
      : false
  const requiredCount = (advisorRequired ? 1 : 0) + (customerRequired ? 1 : 0)
  const signTotal = requiredCount || 1
  const signCount =
    (advisorRequired && req.advisor_signed_at ? 1 : 0) + (customerRequired && req.customer_signed_at ? 1 : 0)
  const advisorLabel = advisorRequired ? (req.advisor_signed_at ? shortIso(req.advisor_signed_at) : "--") : "nicht erforderlich"
  const allActorFieldsFilled = actorFields.length > 0 && actorFields.every((field) => isFieldFilled(field, fieldValue(field)))

  useEffect(() => {
    setValues(req.my_values ?? {})
  }, [req.my_values])
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])
  useEffect(() => {
    setPdfError(null)
    setPdfErrorDetail(null)
    setPdfReloadKey(0)
  }, [originalDoc?.file_path])

  function fieldValue(f: SignatureField) {
    if (f.owner === actor) return values[f.id]
    if (f.owner === "advisor") return advisorValues[f.id]
    return customerValues[f.id]
  }

  const filledActorFieldCount = actorFields.filter((field) => isFieldFilled(field, fieldValue(field))).length
  const remainingActorFieldCount = Math.max(0, actorFields.length - filledActorFieldCount)
  const nextIncompleteField =
    actorFields.find((field) => !isFieldFilled(field, fieldValue(field))) ?? actorFields[0] ?? null

  function openFieldArea(targetPage: number) {
    setPage(targetPage)
    setMobileView("document")
  }

  function scrollFieldCardIntoView(fieldId: string | null | undefined) {
    const normalizedFieldId = String(fieldId ?? "").trim()
    if (!normalizedFieldId) return
    window.setTimeout(() => {
      fieldCardRefs.current[normalizedFieldId]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 80)
  }

  function openFieldsView(targetField?: SignatureField | null) {
    if (targetField?.page) setPage(targetField.page)
    setMobileView("fields")
    scrollFieldCardIntoView(targetField?.id ?? nextIncompleteField?.id ?? null)
  }

  function setClampedPage(nextPage: number) {
    setPage(Math.min(pageCount, Math.max(1, nextPage)))
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-slate-900/45 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col overflow-y-auto bg-white shadow-2xl sm:h-[85vh] sm:max-w-[1200px] sm:overflow-hidden sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Unterschrift: {req.title}</div>
            <div className="text-xs text-slate-500">
              Fortschritt {signCount}/{signTotal} · Berater: {advisorLabel} · Kunde:{" "}
              {req.customer_signed_at ? shortIso(req.customer_signed_at) : "--"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
          >
            Schliessen
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileView("document")}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                  mobileView === "document"
                    ? "border border-slate-900 bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                Dokument
              </button>
              <button
                type="button"
                onClick={() => setMobileView("fields")}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                  mobileView === "fields"
                    ? "border border-slate-900 bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                Unterschrift {actorFields.length ? `(${filledActorFieldCount}/${actorFields.length})` : ""}
              </button>
            </div>
            <div className="shrink-0 text-[11px] font-medium text-slate-500">
              {actorFields.length ? `${filledActorFieldCount}/${actorFields.length} erledigt` : `Seite ${page}`}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
          {showPagePicker ? (
            <div className="hidden w-full items-center gap-2 border-b border-slate-200 bg-slate-50 p-3 xl:flex xl:w-[180px] xl:flex-col xl:items-stretch xl:border-b-0 xl:border-r">
              <div className="shrink-0 text-[11px] font-semibold text-slate-600">Seiten</div>
              <div className="flex flex-1 gap-2 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:mt-2 xl:max-h-[70vh] xl:flex-col xl:overflow-auto">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
                  const hasField = pagesWithFields.has(p)
                  const active = p === page
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`shrink-0 flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <span>Seite {p}</span>
                      {hasField ? <span className="ml-2 h-2 w-2 rounded-full bg-emerald-500" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className={`${mobileView === "fields" ? "hidden lg:flex" : "flex"} min-h-0 flex-1 flex-col p-3 sm:p-4`}>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700">
                {actor === "advisor" ? "Berater" : "Kunde"}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700">
                Seite {page}
              </div>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3 text-[11px] text-slate-500 lg:hidden">
              <span className="max-w-[120px] leading-[1.45]">
                Pruefen Sie hier das Dokument. Unten wechseln Sie direkt in den Unterschriftsbereich.
              </span>
            </div>

            {showPagePicker ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 xl:hidden">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setClampedPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Zurück
                  </button>
                  <div className="text-[11px] font-semibold text-slate-700">
                    Seite {page} von {pageCount}
                  </div>
                  <button
                    type="button"
                    onClick={() => setClampedPage(page + 1)}
                    disabled={page >= pageCount}
                    className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Weiter
                  </button>
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
                    const hasField = pagesWithFields.has(p)
                    const active = p === page
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        Seite {p}
                        {hasField ? (
                          <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div
              ref={pageFrameRef}
              className="relative mt-3 min-h-[28vh] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:min-h-[38vh] xl:min-h-0"
            >
              <div
                ref={pageRef}
                className="relative mx-auto"
                style={{
                  width: pageSize ? `${pageSize.width}px` : "100%",
                  height: pageSize ? `${pageSize.height}px` : "auto",
                }}
              >
                <div className="relative w-full">
                  {originalDoc ? (
                    originalDoc.mime_type?.includes("pdf") ? (
                      <PdfPageCanvas
                        doc={pdfDoc}
                        page={page}
                        width={frameSize.width || 800}
                        maxHeight={frameSize.height || 1000}
                        onSize={handlePageSize}
                      />
                    ) : (
                      <ImagePage
                        url={fileUrl(originalDoc.file_path, true)}
                        width={frameSize.width || 800}
                        maxHeight={frameSize.height || 1000}
                        onSize={handlePageSize}
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">Kein Dokument</div>
                  )}
                </div>

                <div className="absolute inset-0 pointer-events-none">
                  {pageFields.map((f) => {
                    const val = fieldValue(f)
                    return (
                      <div
                        key={f.id}
                        className={`absolute rounded-md border-2 text-[10px] shadow-sm ${
                          f.owner === "advisor" ? "border-orange-400 text-orange-700" : "border-sky-400 text-sky-700"
                        }`}
                        style={{
                          left: `${f.x}%`,
                          top: `${f.y}%`,
                          width: `${f.width}%`,
                          height: `${f.height}%`,
                          background: "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {f.type === "signature" && typeof val === "string" && val ? (
                          <img src={val} alt="" className="h-full w-full object-contain" />
                        ) : f.type === "checkbox" ? (
                          <span className="text-lg">{val ? "✓" : ""}</span>
                        ) : f.type === "text" ? (
                          <AutoFitText
                            text={typeof val === "string" ? val : val ? String(val) : ""}
                            baseSize={11}
                            minSize={7}
                            className="px-1 text-center text-slate-700"
                          />
                        ) : (
                          <AutoFitText
                            text={f.label || "Feld"}
                            baseSize={10}
                            minSize={7}
                            className="px-1 text-center text-slate-500"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {originalDoc ? (
              <div className="mt-2 text-xs text-slate-500">
                <a className="hover:underline" href={fileUrl(originalDoc.file_path)} target="_blank">
                  Dokument in neuem Tab öffnen
                </a>
              </div>
            ) : null}
            {originalDoc?.mime_type?.includes("pdf") && pdfError === "password_required" ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div>PDF ist passwortgeschuetzt. Bitte Passwort eingeben.</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    placeholder="PDF Passwort"
                    className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPdfError(null)
                      setPdfErrorDetail(null)
                      setPdfReloadKey((v) => v + 1)
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-800"
                  >
                    Neu laden
                  </button>
                </div>
              </div>
            ) : null}
            {originalDoc?.mime_type?.includes("pdf") && pdfError === "load_failed" ? (
              <div className="mt-2 text-xs text-rose-600">
                PDF konnte nicht geladen werden. Bitte Datei prüfen.
                {pdfErrorDetail ? <div className="mt-1 text-[11px] text-rose-500">{pdfErrorDetail}</div> : null}
              </div>
            ) : null}
            {!req.requires_wet_signature && !alreadySigned && actorFields.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 lg:hidden">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Mobil unterschreiben</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {allActorFieldsFilled ? "Alle Felder sind ausgefuellt" : `Noch ${remainingFieldLabel(remainingActorFieldCount)}`}
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  Im Unterschriftsbereich sehen Sie alle Stellen nacheinander und koennen direkt zur naechsten offenen Stelle springen.
                </div>
                <button
                  type="button"
                  onClick={() => openFieldsView(nextIncompleteField)}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-sky-300 bg-white px-4 py-3 text-sm font-semibold text-sky-800 shadow-sm"
                >
                  {allActorFieldsFilled ? "Unterschrift pruefen" : "Jetzt zum Unterschriftsbereich"}
                </button>
              </div>
            ) : null}
          </div>

          <div
            className={`${mobileView === "document" ? "hidden lg:flex" : "flex"} w-full min-h-0 flex-1 flex-col border-t border-slate-200 bg-slate-50 p-3 sm:p-4 xl:w-[360px] xl:flex-none xl:border-l xl:border-t-0`}
          >
            <div className="shrink-0 text-sm font-semibold text-slate-900">Unterschrift und Felder</div>
            <div className="mt-1 text-[11px] text-slate-500 lg:hidden">
              Fuellen Sie die Felder nacheinander aus. Ueber `Bereich anzeigen` springen Sie direkt zur passenden Stelle im Dokument.
            </div>
            {!req.requires_wet_signature && actorFields.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm lg:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ihr Fortschritt</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {filledActorFieldCount}/{actorFields.length} Felder erledigt
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      {allActorFieldsFilled
                        ? "Alles ist ausgefuellt. Unten koennen Sie jetzt direkt abschliessen."
                        : `Scrollen Sie nach unten fuer weitere Felder. Noch ${remainingFieldLabel(remainingActorFieldCount)}.`}
                    </div>
                  </div>
                  {!allActorFieldsFilled && nextIncompleteField ? (
                    <button
                      type="button"
                      onClick={() => scrollFieldCardIntoView(nextIncompleteField.id)}
                      className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700"
                    >
                      Naechstes Feld
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {req.requires_wet_signature ? (
              <div className="mt-3">
                <div className="text-xs text-slate-600">
                  Original erforderlich. Bitte jede Seite einscannen/fotografieren und hochladen.
                </div>
                <label className="mt-3 inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm">
                  Dateien hochladen
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files
                      if (files?.length) onUploadSigned(req.id, files)
                      e.currentTarget.value = ""
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {actorFields.length === 0 ? (
                  <div className="text-xs text-slate-500">Keine Felder vorhanden.</div>
                ) : null}
                {actorFields.map((f, index) => {
                  const fieldFilled = isFieldFilled(f, fieldValue(f))
                  return (
                  <div
                    key={f.id}
                    ref={(node) => {
                      fieldCardRefs.current[f.id] = node
                    }}
                    className={`rounded-xl border bg-white p-3 ${fieldFilled ? "border-emerald-200" : "border-slate-200"}`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            fieldFilled ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {signatureFieldStepLabel(index + 1, actorFields.length)}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-700">
                            {f.label || (f.type === "signature" ? "Unterschrift" : f.type === "checkbox" ? "Checkbox" : "Eingabe")}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            Seite {f.page} {page === f.page ? "· aktuell sichtbar" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                            fieldFilled
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {fieldFilled ? "Erledigt" : "Offen"}
                        </span>
                        <button
                          type="button"
                          onClick={() => openFieldArea(f.page)}
                          className="shrink-0 self-start rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          Bereich anzeigen
                        </button>
                      </div>
                    </div>
                    {f.type === "checkbox" ? (
                      <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={!!values[f.id]}
                          onChange={(e) => setValues({ ...values, [f.id]: e.target.checked })}
                          className="h-4 w-4"
                        />
                        Bestaetigen
                      </label>
                    ) : f.type === "signature" ? (
                      <div className="mt-2">
                        <SignaturePad
                          value={String(values[f.id] ?? "")}
                          onChange={(val) => setValues({ ...values, [f.id]: val })}
                          disabled={alreadySigned}
                        />
                      </div>
                    ) : (
                      <input
                        value={String(values[f.id] ?? "")}
                        onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                        className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      />
                    )}
                  </div>
                )})}
              </div>
            )}

            <div className="mt-4 shrink-0 border-t border-slate-200 pt-3">
              {!req.requires_wet_signature ? (
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 lg:hidden">
                  <span>Fortschritt</span>
                  <span className="font-semibold text-slate-900">
                    {filledActorFieldCount}/{actorFields.length || 0} Felder erledigt
                  </span>
                </div>
              ) : null}
              {!req.requires_wet_signature && !allActorFieldsFilled ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-800">
                  Bitte zuerst alle Unterschriften und Felder vollständig ausfüllen. Danach erscheint der Abschluss-Button.
                </div>
              ) : null}
              {!req.requires_wet_signature && allActorFieldsFilled ? (
                <button
                  onClick={async () => {
                    const ok = await onSubmitDigital(req.id, values)
                    if (ok) onClose()
                  }}
                  disabled={busy || alreadySigned || !canSign}
                  className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {canEdit ? "Speichern & senden" : "Unterschreiben"}
                </button>
              ) : null}
              {!canEdit && customerRequired && advisorRequired && !req.advisor_signed_at ? (
                <div className="mt-2 text-xs text-slate-500">Der Berater muss zuerst unterschreiben.</div>
              ) : null}
              {alreadySigned ? (
                <div className="mt-2 text-xs text-slate-500">
                  {canEdit ? "Berater unterschrieben." : "Kunde unterschrieben."}
                </div>
              ) : null}
              <div className="mt-3 flex justify-end lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileView("document")}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                >
                  Dokument ansehen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SignaturePad({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
  const activeRectRef = useRef<DOMRect | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    // Use a higher internal resolution to keep the signature crisp when scaled into PDFs.
    const ratio = Math.min(3, (window.devicePixelRatio || 1) * 2)
    const width = canvas.clientWidth || 320
    const height = canvas.clientHeight || 120
    canvas.width = width * ratio
    canvas.height = height * ratio
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"
    ctx.clearRect(0, 0, width, height)
    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
      }
      img.src = value
    }
  }, [value])

  function getPoint(e: ReactPointerEvent<HTMLCanvasElement>, rect?: DOMRect | null) {
    const bounds = rect ?? activeRectRef.current ?? e.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(bounds.width, Math.max(0, e.clientX - bounds.left)),
      y: Math.min(bounds.height, Math.max(0, e.clientY - bounds.top)),
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    if (!e.isPrimary) return
    e.preventDefault()
    activePointerIdRef.current = e.pointerId
    activeRectRef.current = canvas.getBoundingClientRect()
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {}
    const p = getPoint(e, activeRectRef.current)
    drawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || !drawingRef.current) return
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    e.preventDefault()
    const p = getPoint(e, activeRectRef.current)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function onPointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    if (canvas && activePointerIdRef.current !== null) {
      try {
        canvas.releasePointerCapture(activePointerIdRef.current)
      } catch {}
    }
    activePointerIdRef.current = null
    activeRectRef.current = null
    if (canvas) onChange(canvas.toDataURL("image/png"))
  }

  function clearPad() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange("")
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-2 select-none">
      <canvas
        ref={canvasRef}
        className="h-[180px] w-full touch-none rounded-lg bg-white sm:h-[120px]"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Signaturfeld"
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Bitte hier unterschreiben</span>
        <button
          type="button"
          onClick={clearPad}
          className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
        >
          Leeren
        </button>
      </div>
    </div>
  )
}

function usePdfDocument(
  url: string | null,
  password?: string,
  onError?: (message: PdfError, detail?: string) => void,
  reloadKey: number = 0
) {
  const [doc, setDoc] = useState<any | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    if (!url) {
      setDoc(null)
      setPageCount(null)
      onErrorRef.current?.(null)
      return
    }
    let active = true
    ;(async () => {
      try {
        const pdfModule = await import("pdfjs-dist")
        const pdfjs: any = (pdfModule as any).default ?? pdfModule
        ensurePdfWorker(pdfjs)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`http_${res.status}`)
        const data = new Uint8Array(await res.arrayBuffer())
        const task = pdfjs.getDocument({ data, password, disableWorker: true })
        if (typeof task.onPassword === "function") {
          task.onPassword = (cb: (pwd: string) => void, reason: number) => {
            if (!password) {
              const detail = reason === 2 ? "password_incorrect" : "password_required"
              onErrorRef.current?.("password_required", detail)
              return
            }
            cb(password)
          }
        }
        const loaded = await task.promise
        if (!active) return
        setDoc(loaded)
        setPageCount(loaded?.numPages ?? null)
        onErrorRef.current?.(null)
      } catch (e: any) {
        if (!active) return
        setDoc(null)
        setPageCount(null)
        const name = String(e?.name || "")
        const msg = String(e?.message || "")
        const detail = msg || name || "unknown"
        if (name.includes("Password") || msg.toLowerCase().includes("password") || e?.code === 1 || e?.code === 2) {
          onErrorRef.current?.("password_required", detail)
        } else {
          onErrorRef.current?.("load_failed", detail)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [url, password, reloadKey])

  return { doc, pageCount }
}

function PdfPageCanvas({
  doc,
  page,
  width,
  maxHeight,
  onSize,
}: {
  doc: any | null
  page: number
  width: number
  maxHeight?: number
  onSize: (size: { width: number; height: number }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onSizeRef = useRef(onSize)

  useEffect(() => {
    onSizeRef.current = onSize
  }, [onSize])

  useEffect(() => {
    if (!doc) return
    let active = true
    ;(async () => {
      try {
        const pageIndex = Math.max(1, Math.min(page, doc.numPages || 1))
        const pageObj = await doc.getPage(pageIndex)
        if (!active) return
        const viewport = pageObj.getViewport({ scale: 1 })
        const scaleByWidth = Math.max(0.1, width / viewport.width)
        const scaleByHeight = maxHeight ? Math.max(0.1, maxHeight / viewport.height) : scaleByWidth
        const scale = maxHeight ? Math.min(scaleByWidth, scaleByHeight) : scaleByWidth
        const cssViewport = pageObj.getViewport({ scale })
        const dpr = window.devicePixelRatio || 1
        const qualityBoost = dpr > 1 ? 1 : 1.6
        const renderViewport = pageObj.getViewport({ scale: scale * qualityBoost })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = renderViewport.width * dpr
        canvas.height = renderViewport.height * dpr
        canvas.style.width = `${cssViewport.width}px`
        canvas.style.height = `${cssViewport.height}px`
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, renderViewport.width, renderViewport.height)
        await pageObj.render({ canvasContext: ctx, viewport: renderViewport }).promise
        if (!active) return
        onSizeRef.current?.({ width: cssViewport.width, height: cssViewport.height })
      } catch {
        // ignore
      }
    })()
    return () => {
      active = false
    }
  }, [doc, page, width, maxHeight])

  return <canvas ref={canvasRef} className="block" />
}

function ImagePage({
  url,
  width,
  maxHeight,
  onSize,
}: {
  url: string
  width: number
  maxHeight?: number
  onSize: (size: { width: number; height: number }) => void
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    setSize(null)
  }, [url, width])

  return (
    <img
      src={url}
      alt=""
      className="block"
      style={{ width: width ? `${width}px` : "100%", height: size ? `${size.height}px` : "auto" }}
      onLoad={(e) => {
        const img = e.currentTarget
        const naturalW = img.naturalWidth || 1
        const naturalH = img.naturalHeight || 1
        const scaleByWidth = (width || naturalW) / naturalW
        const scaleByHeight = maxHeight ? maxHeight / naturalH : scaleByWidth
        const scale = maxHeight ? Math.min(scaleByWidth, scaleByHeight) : scaleByWidth
        const next = { width: Math.round(naturalW * scale), height: Math.round(naturalH * scale) }
        setSize(next)
        onSize(next)
      }}
    />
  )
}


