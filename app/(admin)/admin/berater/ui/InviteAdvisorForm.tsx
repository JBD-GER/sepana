"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

const PRIMARY = "#0a1b3d"
const LANGUAGE_OPTIONS = [
  "Deutsch",
  "Englisch",
  "Türkisch",
  "Arabisch",
  "Französisch",
  "Spanisch",
  "Italienisch",
  "Russisch",
  "Polnisch",
]

function normalizeLangs(list: string[]) {
  return list.map((s) => s.trim()).filter(Boolean).slice(0, 20)
}

export default function InviteAdvisorForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [bio, setBio] = useState("")
  const [langs, setLangs] = useState<string[]>([])
  const [customLang, setCustomLang] = useState("")
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [tempId] = useState(() => Math.random().toString(36).slice(2))
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const langsLabel = useMemo(() => langs.join(", "), [langs])

  function toggleLang(l: string) {
    setLangs((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]))
  }

  function addCustom() {
    const v = customLang.trim()
    if (!v) return
    setLangs((prev) => normalizeLangs([...prev, v]))
    setCustomLang("")
  }

  async function onInvite() {
    setMsg(null)
    if (!email.includes("@")) return setMsg("Bitte eine gültige E-Mail eingeben.")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/invite-advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          display_name: name || null,
          phone: phone || null,
          bio: bio || null,
          languages: normalizeLangs(langs),
          photo_path: photoPath,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Einladung fehlgeschlagen")
      setMsg("Einladung wurde versendet ✅")
      setEmail("")
      setName("")
      setPhone("")
      setBio("")
      setLangs([])
      setCustomLang("")
      setPhotoPath(null)
      router.refresh()
    } catch (e: any) {
      setMsg(e.message ?? "Fehler")
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">Berater einladen</div>
          <p className="mt-1 text-sm text-slate-600">
            Der Berater erhält eine Supabase Invite-Mail und wird als <span className="font-medium">advisor</span> angelegt.
          </p>
        </div>
        <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
          Admin-only
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-xs text-slate-600">E-Mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="berater@domain.de"
              className={inputBase}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-600">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Max Musterberater"
              className={inputBase}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-600">Telefon</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 170 1234567"
              className={inputBase}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-600">Profilbild (optional)</label>
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-300 bg-white">
                {photoPath ? (
                  <img
                    src={`/api/baufi/logo?bucket=advisor_avatars&path=${encodeURIComponent(photoPath)}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <label className="cursor-pointer text-xs font-medium text-slate-800">
                Datei wählen
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setMsg(null)
                    setLoading(true)
                    try {
                      const form = new FormData()
                      form.append("file", f)
                      const res = await fetch(`/api/admin/advisors/upload?tempId=${encodeURIComponent(tempId)}`, {
                        method: "POST",
                        body: form,
                      })
                      const json = await res.json()
                      if (!res.ok) throw new Error(json?.error || "Upload fehlgeschlagen")
                      setPhotoPath(json?.path ?? null)
                    } catch (err: any) {
                      setMsg(err?.message ?? "Fehler")
                    } finally {
                      setLoading(false)
                    }
                  }}
                  className="hidden"
                />
              </label>
              <div className="text-xs text-slate-500">{photoPath ? "Bild gewählt" : "Noch kein Bild"}</div>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-600">Kurzprofil</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Schwerpunkte, Erfahrung, Spezialisierung"
              className={`${inputBase} min-h-[96px]`}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-xs text-slate-600">Sprachen</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((l) => {
                const active = langs.includes(l)
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLang(l)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                    }`}
                  >
                    {l}
                  </button>
                )
              })}
            </div>

            <div className="mt-1 flex gap-2">
              <input
                value={customLang}
                onChange={(e) => setCustomLang(e.target.value)}
                placeholder="Weitere Sprache"
                className={inputBase}
              />
              <button
                type="button"
                onClick={addCustom}
                className="rounded-2xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm"
              >
                Hinzufügen
              </button>
            </div>
            <div className="text-xs text-slate-500">{langsLabel || "—"}</div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={onInvite}
              disabled={loading}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${PRIMARY}, #142a57)` }}
            >
              {loading ? "Sende..." : "Einladen"}
            </button>
          </div>
        </div>
      </div>

      {msg ? <div className="mt-3 text-sm text-slate-700">{msg}</div> : null}
    </div>
  )
}
