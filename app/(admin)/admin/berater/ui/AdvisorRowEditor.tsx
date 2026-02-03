"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type AdvisorProfile = {
  display_name: string | null
  bio: string | null
  languages: string[] | null
  photo_path: string | null
  is_active?: boolean | null
  phone?: string | null
}

const ACCENT = "#07183d"

function splitLanguages(v: string) {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function avatarSrc(path?: string | null) {
  if (!path) return null
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path
  return `/api/baufi/logo?bucket=advisor_avatars&width=256&height=256&quality=100&resize=cover&path=${encodeURIComponent(path)}`
}

export default function AdvisorRowEditor({
  userId,
  email,
  initial,
}: {
  userId: string
  email: string
  initial: AdvisorProfile
}) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(initial.display_name ?? "")
  const [phone, setPhone] = useState(initial.phone ?? "")
  const [bio, setBio] = useState(initial.bio ?? "")
  const [langs, setLangs] = useState((initial.languages ?? []).join(", "))
  const [photoPath, setPhotoPath] = useState<string | null>(initial.photo_path ?? null)
  const [isActive, setIsActive] = useState(initial.is_active ?? true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const imgSrc = useMemo(() => avatarSrc(photoPath), [photoPath])
  const langList = splitLanguages(langs)

  async function save() {
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/advisors/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: name.trim() || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          languages: splitLanguages(langs),
          photo_path: photoPath,
          is_active: isActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen")
      setMsg("Gespeichert ✅")
      setEdit(false)
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(null), 2000)
    }
  }

  async function onUpload(file: File) {
    setMsg(null)
    setBusy(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`/api/admin/advisors/upload?userId=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Upload fehlgeschlagen")
      setPhotoPath(json?.path ?? null)
      setEdit(true)
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  async function removeAdvisor() {
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/advisors/${encodeURIComponent(userId)}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Entfernen fehlgeschlagen")
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  async function resendInvite() {
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/advisors/${encodeURIComponent(userId)}/resend-invite`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Invite fehlgeschlagen")
      if (json?.sent) {
        setMsg("Einladung erneut versendet ✓")
        return
      }
      if (json?.link) {
        try {
          await navigator.clipboard.writeText(json.link)
          setMsg("Einladungslink kopiert ✓")
        } catch {
          setMsg("Einladungslink erzeugt (Clipboard fehlgeschlagen)")
        }
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-500">E-Mail</div>
          <div className="truncate text-sm font-medium text-slate-900">{email || userId}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {langList.length ? (
              langList.map((l) => (
                <span key={l} className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-800">
                  {l}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">Keine Sprachen</span>
            )}
          </div>
          <div className="mt-2">
            <button
              onClick={async () => {
                setBusy(true)
                setMsg(null)
                try {
                  const next = !isActive
                  const res = await fetch(`/api/admin/advisors/${encodeURIComponent(userId)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ is_active: next }),
                  })
                  const json = await res.json()
                  if (!res.ok) throw new Error(json?.error || "Update fehlgeschlagen")
                  setIsActive(next)
                } catch (e: any) {
                  setMsg(e?.message ?? "Fehler")
                } finally {
                  setBusy(false)
                }
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {isActive ? "Aktiv" : "Deaktiviert"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {!edit ? (
          <div className="rounded-2xl border border-slate-300 bg-white p-4">
            <div className="text-xs text-slate-500">Name</div>
            <div className="text-sm font-semibold text-slate-900">{name || "—"}</div>
            <div className="mt-2 text-xs text-slate-500">Telefon</div>
            <div className="text-sm text-slate-700">{phone || "—"}</div>
            <div className="mt-2 text-xs text-slate-500">Text</div>
            <div className="text-sm text-slate-700">{bio || "—"}</div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <label className="text-xs text-slate-600">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="Max Musterberater"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-slate-600">Telefon</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="+49 170 1234567"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-slate-600">Text</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[70px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="Kurzprofil, Schwerpunkte, Erfahrung"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-slate-600">Sprachen (Komma-getrennt)</label>
              <input
                value={langs}
                onChange={(e) => setLangs(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="Deutsch, Englisch, Türkisch"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEdit((v) => !v)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm"
          >
            {edit ? "Vorschau" : "Bearbeiten"}
          </button>
          <button
            onClick={resendInvite}
            disabled={busy}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm"
          >
            Einladung neu senden
          </button>
          <label className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-700">
            Foto hochladen
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUpload(f)
              }}
              className="hidden"
            />
          </label>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #142a57)` }}
          >
            {busy ? "…" : "Speichern"}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-sm"
          >
            Entfernen
          </button>
          {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
        </div>

        {confirmDelete ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Wirklich entfernen?
            <div className="mt-2 flex gap-2">
              <button
                onClick={removeAdvisor}
                className="rounded-lg bg-red-600 px-3 py-1 text-xs text-white"
              >
                Ja, entfernen
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs text-red-700"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
