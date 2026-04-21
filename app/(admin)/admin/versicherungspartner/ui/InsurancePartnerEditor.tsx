"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

const LANGUAGE_OPTIONS = [
  "Deutsch",
  "Englisch",
  "Tuerkisch",
  "Arabisch",
  "Franzoesisch",
  "Spanisch",
  "Italienisch",
  "Russisch",
  "Polnisch",
]

function normalizeLangs(list: string[]) {
  return list.map((value) => value.trim()).filter(Boolean).slice(0, 20)
}

function avatarUrl(path: string | null | undefined) {
  const clean = String(path ?? "").trim()
  if (!clean) return null
  return `/api/baufi/logo?bucket=insurance_partner_avatars&width=256&height=256&quality=100&resize=cover&path=${encodeURIComponent(clean)}`
}

export default function InsurancePartnerEditor({
  userId,
  authEmail,
  initial,
}: {
  userId: string
  authEmail: string
  initial: {
    partner_code: string | null
    company_name: string | null
    display_name: string | null
    bio: string | null
    languages: string[] | null
    photo_path: string | null
    phone: string | null
    email: string | null
    is_active: boolean | null
  }
}) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [partnerCode, setPartnerCode] = useState(initial.partner_code ?? "")
  const [companyName, setCompanyName] = useState(initial.company_name ?? "")
  const [displayName, setDisplayName] = useState(initial.display_name ?? "")
  const [phone, setPhone] = useState(initial.phone ?? "")
  const [contactEmail, setContactEmail] = useState(initial.email ?? authEmail ?? "")
  const [bio, setBio] = useState(initial.bio ?? "")
  const [langs, setLangs] = useState<string[]>(normalizeLangs(initial.languages ?? []))
  const [customLang, setCustomLang] = useState("")
  const [photoPath, setPhotoPath] = useState<string | null>(initial.photo_path ?? null)
  const [isActive, setIsActive] = useState(initial.is_active !== false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const langsLabel = useMemo(() => langs.join(", "), [langs])
  const imgSrc = useMemo(() => avatarUrl(photoPath), [photoPath])

  function toggleLang(language: string) {
    setLangs((prev) => (prev.includes(language) ? prev.filter((entry) => entry !== language) : normalizeLangs([...prev, language])))
  }

  function addCustom() {
    const value = customLang.trim()
    if (!value) return
    setLangs((prev) => normalizeLangs([...prev, value]))
    setCustomLang("")
  }

  async function onUpload(file: File) {
    setMsg(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`/api/admin/insurance-partners/upload?userId=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: form,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Upload fehlgeschlagen")
      setPhotoPath(json?.path ?? null)
      setEdit(true)
      setMsg("Profilbild aktualisiert.")
    } catch (error: any) {
      setMsg(error?.message ?? "Upload fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setMsg(null)
    if (!partnerCode.trim()) {
      setMsg("Bitte eine Partner-ID eingeben.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/insurance-partners/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partner_code: partnerCode,
          company_name: companyName || null,
          display_name: displayName || null,
          phone: phone || null,
          email: contactEmail || null,
          bio: bio || null,
          languages: normalizeLangs(langs),
          photo_path: photoPath,
          is_active: isActive,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Speichern fehlgeschlagen")
      setMsg("Versicherungspartner gespeichert.")
      setEdit(false)
      router.refresh()
    } catch (error: any) {
      setMsg(error?.message ?? "Speichern fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] text-slate-400">Foto</span>}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900">{companyName || displayName || "Versicherungspartner"}</div>
            <div className="mt-1 text-xs text-slate-500">Partner-ID: {partnerCode || "-"}</div>
            <div className="mt-1 text-xs text-slate-600">Login: {authEmail || userId}</div>
            <div className="text-xs text-slate-600">Kontakt: {contactEmail || "-"}</div>
            <div className="text-xs text-slate-600">{phone || "-"}</div>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => {
              setIsActive(event.target.checked)
              setEdit(true)
            }}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          />
          Aktiv
        </label>
      </div>

      {!edit ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Kurzprofil</div>
            <div className="mt-1 text-sm text-slate-700">{bio || "-"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {langs.length ? (
              langs.map((language) => (
                <span key={language} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-800">
                  {language}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">Keine Sprachen hinterlegt</span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs text-slate-600">Partner-ID</span>
                <input
                  value={partnerCode}
                  onChange={(event) => setPartnerCode(event.target.value.toUpperCase())}
                  className={inputBase}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs text-slate-600">Firma</span>
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={inputBase} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs text-slate-600">Name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputBase} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs text-slate-600">Telefon</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className={inputBase} />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Kontakt-E-Mail</span>
              <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className={inputBase} />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Kurzprofil</span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Schwerpunkte, Versicherungsbereiche, interne Hinweise"
                className={`${inputBase} min-h-[96px]`}
              />
            </label>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
              <div className="text-xs font-medium text-slate-700">Profilbild</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] text-slate-400">Kein Bild</span>}
                </div>
                <div className="grid gap-2">
                  <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm">
                    Datei waehlen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void onUpload(file)
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPath(null)
                      setEdit(true)
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300"
                  >
                    Bild entfernen
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-slate-600">Sprachen</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((language) => {
                  const active = langs.includes(language)
                  return (
                    <button
                      key={language}
                      type="button"
                      onClick={() => toggleLang(language)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                      }`}
                    >
                      {language}
                    </button>
                  )
                })}
              </div>
              <div className="mt-1 flex gap-2">
                <input
                  value={customLang}
                  onChange={(event) => setCustomLang(event.target.value)}
                  placeholder="Weitere Sprache"
                  className={inputBase}
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="rounded-2xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm"
                >
                  Hinzufuegen
                </button>
              </div>
              <div className="text-xs text-slate-500">{langsLabel || "-"}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEdit((value) => !value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm"
        >
          {edit ? "Vorschau" : "Bearbeiten"}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {loading ? "Speichere..." : "Aenderungen speichern"}
        </button>
        {msg ? <span className="text-xs text-slate-600">{msg}</span> : null}
      </div>
    </div>
  )
}
