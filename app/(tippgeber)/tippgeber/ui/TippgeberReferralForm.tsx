"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { TippgeberKind } from "@/lib/tippgeber/kinds"

type ExposeMeta = {
  path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function randomId() {
  return Math.random().toString(36).slice(2)
}

function parsePositiveMoney(value: string) {
  const cleaned = String(value ?? "").trim().replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const num = Number(normalized)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

export default function TippgeberReferralForm({ companyName, tippgeberKind }: { companyName: string; tippgeberKind: TippgeberKind }) {
  const router = useRouter()
  const isPrivateCredit = tippgeberKind === "private_credit"

  const [customerFirstName, setCustomerFirstName] = useState("")
  const [customerLastName, setCustomerLastName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")

  const [privateCreditVolume, setPrivateCreditVolume] = useState("")

  const [purchasePrice, setPurchasePrice] = useState("")
  const [brokerCommissionPercent, setBrokerCommissionPercent] = useState("0")
  const [street, setStreet] = useState("")
  const [houseNumber, setHouseNumber] = useState("")
  const [zip, setZip] = useState("")
  const [city, setCity] = useState("")

  const [tempId] = useState(() => randomId())
  const [expose, setExpose] = useState<ExposeMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"

  const hasManualData = useMemo(
    () => Boolean(purchasePrice.trim() || street.trim() || zip.trim() || city.trim()),
    [purchasePrice, street, zip, city]
  )

  async function uploadExpose(file: File) {
    if (isPrivateCredit) return
    setMessage(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/tippgeber/referrals/upload-expose?tempId=${encodeURIComponent(tempId)}`, {
        method: "POST",
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Upload fehlgeschlagen")
      setExpose({
        path: String(json.path ?? ""),
        file_name: String(json.file_name ?? file.name ?? "Expose"),
        mime_type: json.mime_type ? String(json.mime_type) : null,
        size_bytes: json.size_bytes == null ? null : Number(json.size_bytes),
      })
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Upload fehlgeschlagen"))
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit() {
    setMessage(null)
    if (!customerFirstName.trim() || !customerLastName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setMessage("Bitte alle Kontaktdaten des Kunden angeben.")
      return
    }

    if (isPrivateCredit) {
      const parsedVolume = parsePositiveMoney(privateCreditVolume)
      if (!parsedVolume) {
        setMessage("Bitte ein gueltiges Kreditvolumen angeben.")
        return
      }
    } else if (!expose && !hasManualData) {
      setMessage("Bitte Expose hochladen oder Objektdaten manuell eintragen.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/tippgeber/referrals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerFirstName,
          customerLastName,
          customerEmail,
          customerPhone,
          privateCreditVolume: isPrivateCredit ? privateCreditVolume : null,
          expose: isPrivateCredit ? null : expose,
          manual: isPrivateCredit
            ? null
            : {
                purchasePrice,
                brokerCommissionPercent,
                street,
                houseNumber,
                zip,
                city,
              },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Tipp konnte nicht gespeichert werden")

      setCustomerFirstName("")
      setCustomerLastName("")
      setCustomerEmail("")
      setCustomerPhone("")
      setPrivateCreditVolume("")
      setPurchasePrice("")
      setBrokerCommissionPercent("0")
      setStreet("")
      setHouseNumber("")
      setZip("")
      setCity("")
      setExpose(null)
      setMessage("Tipp erfolgreich eingereicht. Sie und SEPANA erhalten eine Bestaetigung per E-Mail.")
      router.refresh()
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Fehler beim Speichern"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Neuer Tipp</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {isPrivateCredit ? "Privatkredit-Anfrage einreichen" : "Kundenanfrage einreichen"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Fuer {companyName}: {isPrivateCredit ? "Kontaktdaten und Kreditvolumen erfassen." : "Kontaktdaten erfassen und Expose hochladen oder Objektdaten manuell eintragen."}
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          {isPrivateCredit ? "Tippgeber Privat" : "Tippgeber"}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Vorname des Kunden *</span>
              <input className={inputClass} value={customerFirstName} onChange={(e) => setCustomerFirstName(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Nachname des Kunden *</span>
              <input className={inputClass} value={customerLastName} onChange={(e) => setCustomerLastName(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">E-Mail *</span>
              <input className={inputClass} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-600">Telefon *</span>
              <input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </label>
          </div>

          {!isPrivateCredit ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
              <div className="text-sm font-medium text-slate-900">Expose hochladen (optional, empfohlen)</div>
              <p className="mt-1 text-xs text-slate-600">PDF oder Bilddatei. Alternativ koennen unten Objektdaten manuell eingetragen werden.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm">
                  {uploading ? "Upload laeuft..." : "Datei waehlen"}
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadExpose(file)
                    }}
                  />
                </label>
                {expose ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    {expose.file_name}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Noch keine Datei hochgeladen</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          {isPrivateCredit ? (
            <>
              <div className="text-sm font-medium text-slate-900">Privatkredit-Daten</div>
              <p className="mt-1 text-xs text-slate-600">Nur Kreditvolumen und Kontaktdaten sind erforderlich.</p>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs text-slate-600">Kreditvolumen *</span>
                  <input
                    className={inputClass}
                    value={privateCreditVolume}
                    onChange={(e) => setPrivateCreditVolume(e.target.value)}
                    placeholder="z. B. 25000"
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-slate-900">Objektdaten manuell (optional)</div>
              <p className="mt-1 text-xs text-slate-600">
                Sinnvoll, wenn kein Expose vorliegt. Maklerprovision ist standardmaessig auf 0 % gesetzt.
              </p>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs text-slate-600">Kaufpreis</span>
                    <input className={inputClass} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="z. B. 420000" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs text-slate-600">Maklerprovision %</span>
                    <input className={inputClass} value={brokerCommissionPercent} onChange={(e) => setBrokerCommissionPercent(e.target.value)} />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <label className="grid gap-1.5">
                    <span className="text-xs text-slate-600">Strasse</span>
                    <input className={inputClass} value={street} onChange={(e) => setStreet(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs text-slate-600">Hausnummer</span>
                    <input className={inputClass} value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <label className="grid gap-1.5">
                    <span className="text-xs text-slate-600">PLZ</span>
                    <input className={inputClass} value={zip} onChange={(e) => setZip(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs text-slate-600">Ort</span>
                    <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
                  </label>
                </div>
              </div>
            </>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading || uploading}
              className={cn(
                "inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800",
                (loading || uploading) && "cursor-not-allowed opacity-60"
              )}
            >
              {loading ? "Sende..." : "Tipp einreichen"}
            </button>
            <div className="text-xs text-slate-500">
              {isPrivateCredit
                ? "Pflicht: Kundenkontakt + Kreditvolumen"
                : "Pflicht: Kundenkontakt + Expose oder manuelle Objektdaten"}
            </div>
          </div>
          {message ? <div className="mt-3 text-sm text-slate-700">{message}</div> : null}
        </div>
      </div>
    </section>
  )
}

