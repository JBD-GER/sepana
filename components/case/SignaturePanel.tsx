"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

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

function fileUrl(path: string, raw = false) {
  const rawParam = raw ? "&raw=1" : ""
  return `/api/baufi/logo?bucket=case_documents&path=${encodeURIComponent(path)}${rawParam}`
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
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(ts))
  } catch {
    return ts
  }
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

export default function SignaturePanel({
  caseId,
  canEdit,
}: {
  caseId: string
  canEdit: boolean
}) {
  const [items, setItems] = useState<SignatureRequest[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [title, setTitle] = useState("")
  const [providerId, setProviderId] = useState("")
  const [requiresWet, setRequiresWet] = useState(false)
  const [file, setFile] = useState<File | null>(null)

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
      const res = await fetch("/api/baufi/providers?product=baufi")
      const json = await res.json().catch(() => ({}))
      const list = Array.isArray(json?.items) ? json.items : []
      setProviders(list)
    })()
  }, [canEdit])

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
    if (!file || !title.trim()) {
      setMsg("Bitte Titel und Datei angeben.")
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const form = new FormData()
      form.append("caseId", caseId)
      form.append("title", title.trim())
      if (providerId) form.append("providerId", providerId)
      form.append("requiresWet", requiresWet ? "1" : "0")
      form.append("file", file)
      const res = await fetch("/api/app/signatures", { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Fehler")
      setTitle("")
      setProviderId("")
      setRequiresWet(false)
      setFile(null)
      await refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  async function saveFields(requestId: string, fields: SignatureField[]) {
    setBusy(true)
    try {
      const res = await fetch("/api/app/signatures", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: requestId, fields }),
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

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-900">Unterschriften</div>
        {canEdit ? <div className="text-xs text-slate-500">Berater / Admin</div> : null}
      </div>

      {canEdit ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_200px_160px_140px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dokument-Titel (z.B. Kreditvertrag)"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="">Bank waehlen</option>
            {providers.map((p) => (
              <option key={p.provider.id} value={p.provider.id}>
                {p.provider.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={requiresWet}
              onChange={(e) => setRequiresWet(e.target.checked)}
              className="h-4 w-4"
            />
            Original noetig
          </label>
          <label className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm">
            Datei waehlen
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-2 flex justify-end">
          <button
            onClick={createRequest}
            disabled={busy}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md disabled:opacity-60"
          >
            Unterschrift anfordern
          </button>
        </div>
      ) : null}

      {msg ? <div className="mt-2 text-xs text-slate-600">{msg}</div> : null}

      <div className="mt-4 space-y-3">
        {items.map((req) => (
          <SignatureRequestCard
            key={req.id}
            req={req}
            canEdit={canEdit}
            busy={busy}
            onSaveFields={saveFields}
            onUploadSigned={uploadSigned}
            onSubmitDigital={submitDigital}
          />
        ))}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
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
  onSaveFields,
  onUploadSigned,
  onSubmitDigital,
}: {
  req: SignatureRequest
  canEdit: boolean
  busy: boolean
  onSaveFields: (id: string, fields: SignatureField[]) => Promise<void>
  onUploadSigned: (id: string, files: FileList) => Promise<void>
  onSubmitDigital: (id: string, values: Record<string, any>) => Promise<boolean>
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const docsOriginal = (req.documents ?? []).filter((d) => d.document_kind === "signature_original")
  const docsSigned = (req.documents ?? []).filter((d) => d.document_kind === "signature_signed")
  const advisorRequired = hasAdvisorFields(req.fields)
  const statusLabel = req.customer_signed_at
    ? "Abgeschlossen"
    : req.advisor_signed_at
      ? "Gestartet"
      : "Entwurf"
  const alreadySigned = canEdit ? !!req.advisor_signed_at : !!req.customer_signed_at
  const advisorLabel = advisorRequired ? (req.advisor_signed_at ? shortIso(req.advisor_signed_at) : "--") : "nicht erforderlich"
  const canOpenSign = canEdit ? advisorRequired : true

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{req.title}</div>
          <div className="text-xs text-slate-500">
            Bank: {req.provider_name || "--"} - Status: {statusLabel} - Erstellt: {shortIso(req.created_at)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Berater: {advisorLabel} · Kunde: {req.customer_signed_at ? shortIso(req.customer_signed_at) : "--"}
          </div>
          {docsOriginal[0] ? (
            <div className="mt-1 text-xs text-slate-600">Datei: {docsOriginal[0].file_name}</div>
          ) : null}
          {req.requires_wet_signature ? (
            <div className="mt-1 text-xs text-rose-600">
              Original erforderlich (jede Seite scannen/fotografieren und hochladen).
            </div>
          ) : null}
          {docsSigned.length > 0 ? (
            <div className="mt-2 text-xs text-slate-700">
              <div className="font-medium text-slate-900">Finales Dokument</div>
              <div className="mt-1 space-y-1">
                {docsSigned.map((d) => (
                  <a
                    key={d.id}
                    href={fileUrl(d.file_path, true)}
                    className="block text-slate-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {d.file_name} · {shortIso(d.created_at)} · {formatBytes(d.size_bytes)}
                  </a>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Enthält Protokoll (Audit-Log) der Unterschriften.
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <button
              onClick={() => setEditorOpen(true)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
            >
              Editor oeffnen
            </button>
          ) : null}
          {canOpenSign ? (
            <button
              onClick={() => setSignOpen(true)}
              className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
              disabled={alreadySigned}
            >
              {alreadySigned ? "Bereits unterschrieben" : "Unterschreiben"}
            </button>
          ) : (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
              Nur Kundensignatur erforderlich
            </span>
          )}
        </div>
      </div>

      {editorOpen ? (
        <SignatureEditorModal
          req={req}
          canEdit={canEdit}
          busy={busy}
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
  onClose,
  onSaveFields,
}: {
  req: SignatureRequest
  canEdit: boolean
  busy: boolean
  onClose: () => void
  onSaveFields: (id: string, fields: SignatureField[]) => Promise<void>
}) {
  const [editing, setEditing] = useState(canEdit)
  const [tab, setTab] = useState<"advisor" | "customer">(canEdit ? "advisor" : "customer")
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

  const canEditFields = canEdit && !req.advisor_signed_at && !req.customer_signed_at
  const tabFields = fields.filter((f) => f.owner === tab && f.page === page)

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
    if (count >= 3) return
    const width = type === "checkbox" ? 3 : type === "signature" ? 18 : 12
    const height = type === "checkbox" ? 3 : type === "signature" ? 6 : 4
    const x = clamp(pos?.x ?? 10, 0, 100 - width)
    const y = clamp(pos?.y ?? 10, 0, 100 - height)
    setFields([
      ...fields,
      { id: uuidLike(), owner: tab, type, label: "", page, x, y, width, height },
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
    <div className="fixed inset-0 z-[70] bg-slate-900/45 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[85vh] sm:max-w-[1200px] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 sm:px-5 sm:py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{req.title}</div>
            <div className="text-xs text-slate-500">
              Bank: {req.provider_name || "--"} · Berater: {req.advisor_signed_at ? shortIso(req.advisor_signed_at) : "--"} · Kunde:{" "}
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

        <div className="flex flex-1 flex-col gap-0 xl:flex-row">
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

          <div className="flex flex-1 flex-col p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <>
                    <button
                      onClick={() => setTab("advisor")}
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        tab === "advisor" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600"
                      }`}
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

            <div
              ref={pageFrameRef}
              className="relative mt-3 min-h-[38vh] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:min-h-0"
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
                  Dokument in neuem Tab oeffnen
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
                PDF konnte nicht geladen werden. Bitte Datei pruefen.
                {pdfErrorDetail ? <div className="mt-1 text-[11px] text-rose-500">{pdfErrorDetail}</div> : null}
              </div>
            ) : null}

          </div>

          <div className="w-full border-t border-slate-200 bg-slate-50 p-3 sm:p-4 xl:w-[360px] xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between">
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

            <div className="mt-3 space-y-2">
              {fields
                .filter((f) => f.owner === tab)
                .map((f) => (
                  <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                    <div className="font-medium text-slate-800">{f.label || f.type}</div>
                    <div className="text-[11px] text-slate-500">
                      Seite {f.page} · {Math.round(f.x)}/{Math.round(f.y)} · {Math.round(f.width)}x{Math.round(f.height)}
                    </div>
                    {editing && canEditFields ? (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <input
                          value={String(f.page)}
                          onChange={(e) =>
                            setFields(fields.map((x) => (x.id === f.id ? { ...x, page: Number(e.target.value || 1) } : x)))
                          }
                          className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                        />
                        <input
                          value={String(f.label)}
                          onChange={(e) =>
                            setFields(fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))
                          }
                          className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                        />
                        <input
                          value={String(f.width)}
                          onChange={(e) =>
                            setFields(fields.map((x) => (x.id === f.id ? { ...x, width: Number(e.target.value || 10) } : x)))
                          }
                          className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                        />
                        <input
                          value={String(f.height)}
                          onChange={(e) =>
                            setFields(fields.map((x) => (x.id === f.id ? { ...x, height: Number(e.target.value || 5) } : x)))
                          }
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
              <button
                onClick={async () => {
                  await onSaveFields(req.id, fields)
                  setEditing(false)
                }}
                disabled={busy}
                className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Felder speichern
              </button>
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
  const [values, setValues] = useState<Record<string, any>>(req.my_values ?? {})
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
  const actorFields = fields.filter((f) => f.owner === actor)
  const pageFields = fields.filter((f) => f.page === page)
  const valuesByRole = req.values_by_role ?? {}
  const advisorValues = valuesByRole.advisor ?? {}
  const customerValues = valuesByRole.customer ?? {}
  const alreadySigned = canEdit ? !!req.advisor_signed_at : !!req.customer_signed_at
  const canSign = canEdit ? advisorRequired : advisorRequired ? !!req.advisor_signed_at : true
  const signTotal = advisorRequired ? 2 : 1
  const signCount = (req.customer_signed_at ? 1 : 0) + (advisorRequired && req.advisor_signed_at ? 1 : 0)
  const advisorLabel = advisorRequired ? (req.advisor_signed_at ? shortIso(req.advisor_signed_at) : "--") : "nicht erforderlich"

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

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/45 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[85vh] sm:max-w-[1200px] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 sm:px-5 sm:py-3">
          <div>
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

        <div className="flex flex-1 flex-col gap-0 xl:flex-row">
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

          <div className="flex flex-1 flex-col p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700">
                {actor === "advisor" ? "Berater" : "Kunde"}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700">
                Seite {page}
              </div>
            </div>

            <div
              ref={pageFrameRef}
              className="relative mt-3 min-h-[38vh] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:min-h-0"
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
                  Dokument in neuem Tab oeffnen
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
                PDF konnte nicht geladen werden. Bitte Datei pruefen.
                {pdfErrorDetail ? <div className="mt-1 text-[11px] text-rose-500">{pdfErrorDetail}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="w-full border-t border-slate-200 bg-slate-50 p-3 sm:p-4 xl:w-[360px] xl:border-l xl:border-t-0">
            <div className="text-sm font-semibold text-slate-900">Ausfuellen</div>
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
              <div className="mt-3 space-y-3">
                {actorFields.length === 0 ? (
                  <div className="text-xs text-slate-500">Keine Felder vorhanden.</div>
                ) : null}
                {actorFields.map((f) => (
                  <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-medium text-slate-700">
                      {f.label || (f.type === "signature" ? "Unterschrift" : f.type === "checkbox" ? "Checkbox" : "Eingabe")}
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
                ))}
              </div>
            )}

            <button
              onClick={async () => {
                const ok = await onSubmitDigital(req.id, values)
                if (ok) onClose()
              }}
              disabled={busy || alreadySigned || req.requires_wet_signature || !canSign}
              className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {canEdit ? "Speichern & senden" : "Unterschreiben"}
            </button>
            {!canEdit && advisorRequired && !req.advisor_signed_at ? (
              <div className="mt-2 text-xs text-slate-500">Der Berater muss zuerst unterschreiben.</div>
            ) : null}
            {alreadySigned ? (
              <div className="mt-2 text-xs text-slate-500">
                {canEdit ? "Berater unterschrieben." : "Kunde unterschrieben."}
              </div>
            ) : null}
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

  function getPoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const p = getPoint(e)
    drawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || !drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const p = getPoint(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function onPointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
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
    <div className="rounded-xl border border-slate-300 bg-white p-2">
      <canvas
        ref={canvasRef}
        className="h-[150px] w-full rounded-lg bg-white sm:h-[120px]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
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
        const scaled = pageObj.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        const ratio = window.devicePixelRatio || 1
        canvas.width = scaled.width * ratio
        canvas.height = scaled.height * ratio
        canvas.style.width = `${scaled.width}px`
        canvas.style.height = `${scaled.height}px`
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, scaled.width, scaled.height)
        await pageObj.render({ canvasContext: ctx, viewport: scaled }).promise
        if (!active) return
        onSizeRef.current?.({ width: scaled.width, height: scaled.height })
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
