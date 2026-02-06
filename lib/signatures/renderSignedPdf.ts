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

function normalizeRightAngle(page: any) {
  try {
    const raw = Number(page?.getRotation?.()?.angle ?? 0)
    const normalized = ((raw % 360) + 360) % 360
    if (normalized === 90 || normalized === 180 || normalized === 270) return normalized
  } catch {
    // ignore
  }
  return 0
}

function percentToPdfCoords(page: any, f: SignatureField) {
  const w = page.getWidth()
  const h = page.getHeight()
  const xPct = Number(f.x || 0)
  const yPct = Number(f.y || 0)
  const wPct = Number(f.width || 0)
  const hPct = Number(f.height || 0)
  const rotation = normalizeRightAngle(page)

  // Keep field placement aligned with the editor preview for upside-down source PDFs.
  if (rotation === 180) {
    const fieldW = (wPct / 100) * w
    const fieldH = (hPct / 100) * h
    const x = ((100 - xPct - wPct) / 100) * w
    const y = (yPct / 100) * h
    return { x, y, fieldW, fieldH, rotation }
  }

  const x = (xPct / 100) * w
  const yTop = (yPct / 100) * h
  const fieldW = (wPct / 100) * w
  const fieldH = (hPct / 100) * h
  const y = h - yTop - fieldH
  return { x, y, fieldW, fieldH, rotation }
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
  const { PDFDocument, StandardFonts, rgb, degrees } = pdfLib

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
    const { x, y, fieldW, fieldH, rotation } = percentToPdfCoords(page, f)
    const upsideDown = rotation === 180
    const val =
      f.owner === "advisor"
        ? opts.values.advisor?.[f.id]
        : opts.values.customer?.[f.id]

    if (f.type === "signature" && typeof val === "string" && val) {
      const bytes = dataUrlToBytes(val)
      if (!bytes) continue
      const img = await pdfDoc.embedPng(bytes)
      page.drawImage(img, {
        x: upsideDown ? x + fieldW : x,
        y: upsideDown ? y + fieldH : y,
        width: fieldW,
        height: fieldH,
        ...(upsideDown ? { rotate: degrees(180) } : {}),
      })
    } else if (f.type === "checkbox") {
      if (val) {
        const size = Math.min(14, Math.max(12, fieldH * 0.6))
        page.drawText("X", {
          x: upsideDown ? x + fieldW - 2 : x + 2,
          y: upsideDown ? y + fieldH - 2 : y + 2,
          size,
          font,
          color: rgb(0, 0, 0),
          ...(upsideDown ? { rotate: degrees(180) } : {}),
        })
      }
    } else {
      const text = typeof val === "string" ? val : ""
      if (text) {
        const baseSize = Math.min(14, Math.max(12, fieldH * 0.45))
        const maxWidth = Math.max(1, fieldW - 4)
        let size = baseSize
        try {
          const textWidth = font.widthOfTextAtSize(text, size)
          if (textWidth > maxWidth) {
            size = Math.max(7, (maxWidth / textWidth) * size)
          }
        } catch {
          size = baseSize
        }
        page.drawText(text, {
          x: upsideDown ? x + fieldW - 2 : x + 2,
          y: upsideDown ? y + fieldH - Math.max(2, fieldH * 0.2) : y + Math.max(2, fieldH * 0.2),
          size,
          font,
          color: rgb(0.1, 0.1, 0.1),
          ...(upsideDown ? { rotate: degrees(180) } : {}),
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
