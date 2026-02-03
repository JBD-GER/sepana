import path from "path"
import fs from "fs/promises"

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

type SignatureEvent = {
  created_at: string
  event: string
  actor_role: string | null
  ip: string | null
  user_agent: string | null
}

type ValuesByRole = {
  advisor?: Record<string, any>
  customer?: Record<string, any>
}

function dataUrlToBytes(input: string) {
  const parts = input.split(",")
  if (parts.length < 2) return null
  const b64 = parts[1]
  const binary = Buffer.from(b64, "base64")
  return new Uint8Array(binary)
}

function percentToPdfCoords(page: any, f: SignatureField) {
  const w = page.getWidth()
  const h = page.getHeight()
  const x = (f.x / 100) * w
  const yTop = (f.y / 100) * h
  const fieldW = (f.width / 100) * w
  const fieldH = (f.height / 100) * h
  const y = h - yTop - fieldH
  return { x, y, fieldW, fieldH }
}

export async function renderSignedPdf(opts: {
  originalBytes: Uint8Array
  originalMime: string | null
  fields: SignatureField[]
  values: ValuesByRole
  events: SignatureEvent[]
  auditTitle: string
}) {
  const pdfLib = await import("pdf-lib").catch(() => null)
  if (!pdfLib) throw new Error("pdf_lib_missing")
  const { PDFDocument, StandardFonts, rgb } = pdfLib

  let pdfDoc: any
  if (opts.originalMime?.includes("pdf")) {
    try {
      pdfDoc = await PDFDocument.load(opts.originalBytes)
    } catch (e: any) {
      const name = String(e?.name || "")
      const msg = String(e?.message || "")
      if (name === "EncryptedPDFError" || msg.toLowerCase().includes("encrypted")) {
        // Best-effort load for encrypted PDFs (may still fail to modify).
        pdfDoc = await PDFDocument.load(opts.originalBytes, { ignoreEncryption: true })
      } else {
        throw e
      }
    }
  } else {
    pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage()
    const imgBytes = opts.originalBytes
    let img: any
    if (opts.originalMime?.includes("png")) img = await pdfDoc.embedPng(imgBytes)
    else img = await pdfDoc.embedJpg(imgBytes)
    const { width, height } = img.scale(1)
    const scale = Math.min(page.getWidth() / width, page.getHeight() / height)
    const drawW = width * scale
    const drawH = height * scale
    const x = (page.getWidth() - drawW) / 2
    const y = (page.getHeight() - drawH) / 2
    page.drawImage(img, { x, y, width: drawW, height: drawH })
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const pages = pdfDoc.getPages()
  for (const f of opts.fields) {
    const page = pages[f.page - 1]
    if (!page) continue
    const { x, y, fieldW, fieldH } = percentToPdfCoords(page, f)
    const val =
      f.owner === "advisor"
        ? opts.values.advisor?.[f.id]
        : opts.values.customer?.[f.id]

    if (f.type === "signature" && typeof val === "string" && val) {
      const bytes = dataUrlToBytes(val)
      if (!bytes) continue
      const img = await pdfDoc.embedPng(bytes)
      page.drawImage(img, {
        x,
        y,
        width: fieldW,
        height: fieldH,
      })
    } else if (f.type === "checkbox") {
      if (val) {
        const size = Math.min(14, Math.max(12, fieldH * 0.6))
        page.drawText("X", { x: x + 2, y: y + 2, size, font, color: rgb(0, 0, 0) })
      }
    } else {
      const text = typeof val === "string" ? val : ""
      if (text) {
        const size = Math.min(14, Math.max(12, fieldH * 0.45))
        page.drawText(text, {
          x: x + 2,
          y: y + Math.max(2, fieldH * 0.2),
          size,
          font,
          color: rgb(0.1, 0.1, 0.1),
          maxWidth: fieldW - 4,
        })
      }
    }
  }

  const auditPage = pdfDoc.addPage([595, 842])
  const logoPath = path.join(process.cwd(), "public", "og.png")
  let logoBytes: Uint8Array | null = null
  try {
    logoBytes = new Uint8Array(await fs.readFile(logoPath))
  } catch {
    logoBytes = null
  }
  if (logoBytes) {
    const logoImg = await pdfDoc.embedPng(logoBytes)
    auditPage.drawImage(logoImg, { x: 40, y: 796, width: 80, height: 20 })
  }
  auditPage.drawText("Audit Log", { x: 40, y: 740, size: 16, font, color: rgb(0, 0, 0) })
  auditPage.drawText(opts.auditTitle, { x: 40, y: 720, size: 11, font, color: rgb(0.2, 0.2, 0.2) })

  let cursorY = 690
  let currentPage = auditPage
  for (const ev of opts.events) {
    const line = `${ev.created_at} · ${ev.event} · ${ev.actor_role ?? "-"} · ${ev.ip ?? "-"}`
    currentPage.drawText(line, { x: 40, y: cursorY, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
    cursorY -= 14
    if (cursorY < 60) {
      currentPage = pdfDoc.addPage([595, 842])
      currentPage.drawText("Audit Log (Fortsetzung)", { x: 40, y: 800, size: 12, font, color: rgb(0, 0, 0) })
      cursorY = 780
    }
  }

  const pdfBytes = await pdfDoc.save()
  return new Uint8Array(pdfBytes)
}
