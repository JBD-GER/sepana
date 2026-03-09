export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { safeFileName } from "@/lib/tippgeber/service"
import { normalizeTippgeberKind } from "@/lib/tippgeber/kinds"

type TippgeberProfileKind = {
  tippgeber_kind?: unknown
}

const MAX_EXPOSE_UPLOAD_BYTES = 20 * 1024 * 1024
const EXPOSE_MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
}

const ALLOWED_EXPOSE_EXTENSIONS = new Set(Object.keys(EXPOSE_MIME_BY_EXT))

function fileExt(name: string) {
  const raw = String(name ?? "")
  const dot = raw.lastIndexOf(".")
  if (dot < 0) return ""
  return raw.slice(dot + 1).trim().toLowerCase()
}

function inferMimeType(file: File) {
  const explicit = String(file.type ?? "").trim().toLowerCase()
  if (explicit) return explicit
  return EXPOSE_MIME_BY_EXT[fileExt(file.name)] || "application/octet-stream"
}

function isAllowedExpose(file: File, mimeType: string) {
  const normalizedMime = String(mimeType ?? "").trim().toLowerCase()
  if (normalizedMime === "application/pdf") return true
  if (normalizedMime.startsWith("image/")) return true
  const ext = fileExt(file.name)
  if (!ext) return false
  return ALLOWED_EXPOSE_EXTENSIONS.has(ext)
}

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "Nicht eingeloggt." }, { status: 401 })
    if (role !== "tipgeber" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 })
    }

    const admin = supabaseAdmin()
    if (role === "tipgeber") {
      const { data: profile } = await admin
        .from("tippgeber_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!profile) {
        return NextResponse.json({ ok: false, error: "Tippgeber-Profil nicht gefunden." }, { status: 404 })
      }
      const typedProfile = profile as TippgeberProfileKind
      if (normalizeTippgeberKind(typedProfile.tippgeber_kind) === "private_credit") {
        return NextResponse.json(
          { ok: false, error: "Exposé-Upload ist im Bereich Tippgeber Privat nicht vorgesehen." },
          { status: 409 }
        )
      }
    }

    const url = new URL(req.url)
    const tempId = String(url.searchParams.get("tempId") ?? "").trim()
    const referralId = String(url.searchParams.get("referralId") ?? "").trim()
    if (!tempId && !referralId) {
      return NextResponse.json({ ok: false, error: "tempId oder referralId fehlt." }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Datei fehlt." }, { status: 400 })
    }
    if (!file.size) {
      return NextResponse.json({ ok: false, error: "Leere Datei." }, { status: 400 })
    }
    if (file.size > MAX_EXPOSE_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Datei zu gross. Maximal ${Math.round(MAX_EXPOSE_UPLOAD_BYTES / (1024 * 1024))} MB erlaubt.` },
        { status: 413 }
      )
    }
    const mimeType = inferMimeType(file)
    if (!isAllowedExpose(file, mimeType)) {
      return NextResponse.json({ ok: false, error: "Erlaubt sind nur PDF oder Bilddateien." }, { status: 415 })
    }

    const base = referralId ? `referrals/${referralId}` : `temp/${user.id}/${tempId}`
    const path = `${base}/${Date.now()}_${safeFileName(file.name || "expose.pdf")}`

    const { error } = await admin.storage
      .from("tipgeber_files")
      .upload(path, file, { upsert: true, contentType: mimeType })
    if (error) throw error

    return NextResponse.json({
      ok: true,
      path,
      file_name: file.name || "Exposé",
      mime_type: mimeType || null,
      size_bytes: Number(file.size || 0) || null,
    })
  } catch (e: unknown) {
    const message = e instanceof Error && e.message ? e.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

