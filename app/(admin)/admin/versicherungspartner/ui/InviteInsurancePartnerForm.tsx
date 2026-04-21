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

export default function InviteInsurancePartnerForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [partnerCode, setPartnerCode] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [street, setStreet] = useState("")
  const [zipcode, setZipcode] = useState("")
  const [city, setCity] = useState("")
  const [bio, setBio] = useState("")
  const [langs, setLangs] = useState<string[]>([])
  const [customLang, setCustomLang] = useState("")
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [tempId] = useState(() => Math.random().toString(36).slice(2))
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const langsLabel = useMemo(() => langs.join(", "), [langs])

  function toggleLang(language: string) {
    setLangs((prev) => (prev.includes(language) ? prev.filter((entry) => entry !== language) : [...prev, language]))
  }

  function addCustom() {
    const value = customLang.trim()
    if (!value) return
    setLangs((prev) => normalizeLangs([...prev, value]))
    setCustomLang("")
  }

  async function onInvite() {
    setMsg(null)
    if (!email.includes("@")) return setMsg("Bitte eine gueltige E-Mail eingeben.")
    if (!partnerCode.trim()) return setMsg("Bitte eine Partner-ID eingeben.")
    if (!street.trim() || !zipcode.trim() || !city.trim()) return setMsg("Bitte Adresse, PLZ und Ort angeben.")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/insurance-partners/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          partnerCode,
          company_name: companyName || null,
          display_name: name || null,
          phone: phone || null,
          street: street || null,
          zipcode: zipcode || null,
          city: city || null,
          bio: bio || null,
          languages: normalizeLangs(langs),
          photo_path: photoPath,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Einladung fehlgeschlagen")

      setMsg("Versicherungs-Partner wurde eingeladen.")
      setEmail("")
      setPartnerCode("")
      setCompanyName("")
      setName("")
      setPhone("")
      setStreet("")
      setZipcode("")
      setCity("")
      setBio("")
      setLangs([])
      setCustomLang("")
      setPhotoPath(null)
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
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
          <div className="mt-1 text-lg font-semibold text-slate-900">Versicherungs-Partner einladen</div>
          <p className="mt-1 text-sm text-slate-600">
            Interner Versicherungszugang mit Partner-ID, Profilbild und Invite-Mail.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">Admin-only</div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">E-Mail</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@domain.de" className={inputBase} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Partner-ID</span>
              <input
                value={partnerCode}
                onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                placeholder="VP-1001"
                className={inputBase}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Firma</span>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputBase} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputBase} />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs text-slate-600">Telefon</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 170 1234567" className={inputBase} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-slate-600">Adresse</span>
            <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Musterstr. 12" className={inputBase} />
          </label>

          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">PLZ</span>
              <input value={zipcode} onChange={(e) => setZipcode(e.target.value)} placeholder="30159" className={inputBase} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Ort</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Hannover" className={inputBase} />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs text-slate-600">Kurzprofil</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Schwerpunkte, Versicherungsbereiche, interne Hinweise"
              className={`${inputBase} min-h-[96px]`}
            />
          </label>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-700">Profilbild (optional)</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {photoPath ? (
                  <img
                    src={`/api/baufi/logo?bucket=insurance_partner_avatars&width=256&height=256&quality=100&resize=cover&path=${encodeURIComponent(photoPath)}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm">
                Datei waehlen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setMsg(null)
                    setLoading(true)
                    try {
                      const form = new FormData()
                      form.append("file", file)
                      const res = await fetch(`/api/admin/insurance-partners/upload?tempId=${encodeURIComponent(tempId)}`, {
                        method: "POST",
                        body: form,
                      })
                      const json = await res.json().catch(() => ({}))
                      if (!res.ok || !json?.ok) throw new Error(json?.error || "Upload fehlgeschlagen")
                      setPhotoPath(json?.path ?? null)
                    } catch (error: any) {
                      setMsg(error?.message ?? "Upload fehlgeschlagen")
                    } finally {
                      setLoading(false)
                    }
                  }}
                />
              </label>
            </div>
            <div className="mt-2 text-xs text-slate-500">{photoPath ? "Bild hochgeladen" : "Noch kein Bild"}</div>
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
                onChange={(e) => setCustomLang(e.target.value)}
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

          <button
            type="button"
            onClick={onInvite}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
          >
            {loading ? "Sende..." : "Versicherungs-Partner einladen"}
          </button>
        </div>
      </div>

      {msg ? <div className="mt-3 text-sm text-slate-700">{msg}</div> : null}
    </div>
  )
}
