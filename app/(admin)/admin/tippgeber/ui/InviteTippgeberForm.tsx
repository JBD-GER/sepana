"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export default function InviteTippgeberForm() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState("")
  const [street, setStreet] = useState("")
  const [houseNumber, setHouseNumber] = useState("")
  const [zip, setZip] = useState("")
  const [city, setCity] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [tempId] = useState(() => Math.random().toString(36).slice(2))
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const inputBase =
    "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"

  async function uploadLogo(file: File) {
    setMsg(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`/api/admin/tippgeber/upload-logo?tempId=${encodeURIComponent(tempId)}`, {
        method: "POST",
        body: form,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Upload fehlgeschlagen")
      setLogoPath(String(json.path ?? ""))
    } catch (e: unknown) {
      setMsg(errorMessage(e, "Upload fehlgeschlagen"))
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    setMsg(null)
    if (!companyName.trim() || !street.trim() || !houseNumber.trim() || !zip.trim() || !city.trim()) {
      setMsg("Bitte Firmendaten vollständig angeben.")
      return
    }
    if (!email.includes("@")) {
      setMsg("Bitte eine gültige E-Mail eingeben.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/tippgeber/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName,
          street,
          houseNumber,
          zip,
          city,
          email,
          phone,
          logoPath,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Einladung fehlgeschlagen")

      setCompanyName("")
      setStreet("")
      setHouseNumber("")
      setZip("")
      setCity("")
      setEmail("")
      setPhone("")
      setLogoPath(null)
      setMsg("Tippgeber eingeladen ✅")
      router.refresh()
    } catch (e: unknown) {
      setMsg(errorMessage(e, "Fehler"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">Tippgeber einladen</div>
          <p className="mt-1 text-sm text-slate-600">
            Firmenprofil anlegen, optional Logo hochladen und Einladung ins Tippgeber-Dashboard senden.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">Admin-only</div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Firmenname</span>
              <input className={inputBase} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">E-Mail</span>
              <input className={inputBase} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Straße</span>
              <input className={inputBase} value={street} onChange={(e) => setStreet(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Hausnummer</span>
              <input className={inputBase} value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-[180px_1fr_1fr]">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">PLZ</span>
              <input className={inputBase} value={zip} onChange={(e) => setZip(e.target.value)} />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs text-slate-600">Ort</span>
              <input className={inputBase} value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs text-slate-600">Telefon</span>
            <input className={inputBase} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-700">Logo (optional)</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {logoPath ? (
                  <img
                    src={`/api/baufi/logo?bucket=tipgeber_logos&width=128&height=128&resize=contain&path=${encodeURIComponent(logoPath)}`}
                    alt=""
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400">Kein Logo</span>
                )}
              </div>
              <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm">
                Datei wählen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadLogo(file)
                  }}
                />
              </label>
            </div>
            <div className="mt-2 text-xs text-slate-500">{logoPath ? "Logo hochgeladen" : "PNG/JPG/SVG empfohlen"}</div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className={cn(
              "rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800",
              loading && "cursor-not-allowed opacity-60"
            )}
          >
            {loading ? "Sende..." : "Tippgeber einladen"}
          </button>
          {msg ? <div className="text-sm text-slate-700">{msg}</div> : null}
        </div>
      </div>
    </div>
  )
}
