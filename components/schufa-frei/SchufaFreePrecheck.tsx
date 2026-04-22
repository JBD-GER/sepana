"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState, type InputHTMLAttributes } from "react"
import { SCHUFA_FREE_FAMILY_OPTIONS } from "@/lib/schufa-frei/application"
import {
  getSchufaFreeEmploymentMonthsSince,
  getSchufaFreeMonthlyRate,
  runSchufaFreePrecheck,
  SCHUFA_FREE_AMOUNT_OPTIONS,
  SCHUFA_FREE_TERM_OPTIONS,
  type SchufaFreePrecheckResult,
} from "@/lib/schufa-frei/precheck"

type ResultModalState = {
  tone: "success" | "rejected" | "error"
  title: string
  description: string
  actionLabel: string
  applicationHref?: string
  precheck?: Pick<
    SchufaFreePrecheckResult,
    "minimumIncomeRequired" | "employmentRequirementText" | "reason" | "incomeCheckPending"
  > | null
}

const ADVISOR_TEAM = [
  {
    name: "Hr. Pfad",
    role: "Kreditexperte",
    focus: "Strategie und Fallstrukturierung",
    imageSrc: "/pfad.png",
    imageAlt: "Herr Pfad",
    imagePosition: "center 18%",
  },
  {
    name: "Hr. Wagner",
    role: "Kreditexperte",
    focus: "Finanzierungsprüfung und Begleitung",
    imageSrc: "/wagner.png",
    imageAlt: "Herr Wagner",
    imagePosition: "center 16%",
  },
  {
    name: "Fr. Müller",
    role: "Kreditexpertin",
    focus: "Privatkredit und schnelle Rückmeldung",
    imageSrc: "/mueller.png",
    imageAlt: "Frau Müller",
    imagePosition: "center 14%",
  },
] as const

function formatRate(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-"
  return `${new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))} p.M.`
}

const FIELD_BASE_CLASS =
  "h-14 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-cyan-100 sm:h-12 sm:text-sm"
const FIELD_CLASS = `mt-1 ${FIELD_BASE_CLASS}`
const DATE_FIELD_CLASS = `${FIELD_BASE_CLASS} date-field appearance-none pr-11 [color-scheme:light]`
const CHECKBOX_CLASS = "mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-slate-900"
const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-14 w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#0f172a,#0f766e)] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(15,23,42,0.18)] transition disabled:opacity-60 sm:min-h-12 sm:text-sm"

function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", lang, value, ...rest } = props
  const hasValue = String(value ?? "").trim().length > 0

  return (
    <div className="relative mt-1">
      {!hasValue ? (
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-slate-400 sm:text-sm">
          TT.MM.JJJJ
        </span>
      ) : null}
      <input
        {...rest}
        type="date"
        value={value}
        lang={lang ?? "de-DE"}
        className={`${DATE_FIELD_CLASS} ${!hasValue ? "date-field-empty text-transparent" : ""} ${className}`.trim()}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        </svg>
      </span>
    </div>
  )
}

export default function SchufaFreePrecheck() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthDate: "",
    familySituation: "1",
    desiredAmount: "3500",
    termMonths: "40",
    dependentChildrenCount: "0",
    nationalityGroup: "de",
    employmentMode: "salary",
    employmentStartDate: "",
    acceptsPrivacyPolicy: false,
    acceptsProvisionAgreement: false,
  })
  const [busy, setBusy] = useState(false)
  const [resultModal, setResultModal] = useState<ResultModalState | null>(null)
  const [consentError, setConsentError] = useState<string | null>(null)
  const [showProvisionPreview, setShowProvisionPreview] = useState(false)

  const amount = Number(form.desiredAmount)
  const termMonths = Number(form.termMonths)
  const childrenCount = Number(form.dependentChildrenCount)
  const monthlyRate = getSchufaFreeMonthlyRate(amount, termMonths)
  const employmentMonthsCurrent = getSchufaFreeEmploymentMonthsSince(form.employmentStartDate)
  const liveCheck = runSchufaFreePrecheck(
    {
      desiredAmount: amount,
      termMonths,
      dependentChildrenCount: childrenCount,
      nationalityGroup:
        form.nationalityGroup === "eu_ch" ? "eu_ch" : form.nationalityGroup === "other" ? "other" : "de",
      employmentMode: form.employmentMode === "hourly" ? "hourly" : "salary",
      birthDate: form.birthDate,
      employmentStartDate: form.employmentStartDate,
    },
    { requireIncomeCheck: false }
  )

  useEffect(() => {
    if (!busy && !resultModal && !showProvisionPreview) return

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [busy, resultModal, showProvisionPreview])

  async function submit() {
    const missingConsents = [
      !form.acceptsPrivacyPolicy ? "den Datenschutz" : null,
      !form.acceptsProvisionAgreement ? "die Provisionsvereinbarung" : null,
    ].filter(Boolean)

    if (missingConsents.length) {
      setConsentError(`Bitte bestätigen Sie zuerst ${missingConsents.join(" und ")}.`)
      return
    }

    setBusy(true)
    setResultModal(null)
    setConsentError(null)

    const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 3000))

    try {
      const response = await fetch("/api/schufa-frei/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          desiredAmount: Number(form.desiredAmount),
          termMonths: Number(form.termMonths),
          dependentChildrenCount: Number(form.dependentChildrenCount),
          acceptsPrivacyPolicy: form.acceptsPrivacyPolicy,
          acceptsProvisionAgreement: form.acceptsProvisionAgreement,
        }),
      })

      const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
      await minimumDelay

      const precheck = (json.precheck ?? null) as ResultModalState["precheck"]

      if (!response.ok || !json?.ok) {
        const rejected = response.status === 422
        setResultModal({
          tone: rejected ? "rejected" : "error",
          title: rejected ? "Erste Vorprüfung aktuell nicht positiv" : "Prüfung konnte nicht abgeschlossen werden",
          description: String(json.error ?? "Die Vorprüfung konnte nicht abgeschlossen werden."),
          actionLabel: "Daten anpassen",
          precheck,
        })
        return
      }

      const applicationHref = String(json.applicationHref ?? "").trim()
      if (!applicationHref) {
        throw new Error("Die Vorprüfung war positiv, aber der nächste Schritt konnte nicht erzeugt werden.")
      }

      setResultModal({
        tone: "success",
        title: "Erste Vorprüfung positiv",
        description:
          "Ihre Eckdaten passen für den nächsten Schritt. Sie können den vollständigen Antrag jetzt direkt ohne Neustart fortsetzen.",
        actionLabel: "Vollständigen Antrag starten",
        applicationHref,
        precheck,
      })
    } catch (requestError) {
      await minimumDelay
      setResultModal({
        tone: "error",
        title: "Prüfung konnte nicht abgeschlossen werden",
        description: requestError instanceof Error ? requestError.message : "Serverfehler",
        actionLabel: "Daten anpassen",
        precheck: null,
      })
    } finally {
      setBusy(false)
    }
  }

  const resultToneClass =
    resultModal?.tone === "success"
      ? "border-emerald-200 bg-[linear-gradient(180deg,#ffffff,rgba(236,253,245,0.98))]"
      : resultModal?.tone === "rejected"
        ? "border-amber-200 bg-[linear-gradient(180deg,#ffffff,rgba(255,251,235,0.98))]"
        : "border-rose-200 bg-[linear-gradient(180deg,#ffffff,rgba(255,241,242,0.98))]"

  return (
    <>
      <div className="space-y-5 sm:space-y-6">
        <section className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-sm sm:rounded-[34px] sm:p-7">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
              Diskrete Vorprüfung
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Kredit ohne Schufa diskret vorprüfen
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Sie starten mit den wichtigsten Eckdaten und erhalten direkt eine erste Einschätzung zu Ihrer Variante.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm text-slate-700">
              Vorname
              <input
                value={form.firstName}
                autoComplete="given-name"
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                className={FIELD_CLASS}
              />
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Nachname
              <input
                value={form.lastName}
                autoComplete="family-name"
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                className={FIELD_CLASS}
              />
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              E-Mail
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className={FIELD_CLASS}
              />
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Telefon
              <input
                value={form.phone}
                autoComplete="tel"
                inputMode="tel"
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className={FIELD_CLASS}
              />
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Geburtsdatum
              <DateInput
                lang="de-DE"
                value={form.birthDate}
                autoComplete="bday"
                onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
              />
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Kreditsumme
              <select
                value={form.desiredAmount}
                onChange={(event) => setForm((current) => ({ ...current, desiredAmount: event.target.value }))}
                className={FIELD_CLASS}
              >
                {SCHUFA_FREE_AMOUNT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.toLocaleString("de-DE")} EUR
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Laufzeit
              <select
                value={form.termMonths}
                onChange={(event) => setForm((current) => ({ ...current, termMonths: event.target.value }))}
                className={FIELD_CLASS}
              >
                {SCHUFA_FREE_TERM_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} Monate
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Familienstand
              <select
                value={form.familySituation}
                onChange={(event) => setForm((current) => ({ ...current, familySituation: event.target.value }))}
                className={FIELD_CLASS}
              >
                {SCHUFA_FREE_FAMILY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Unterhaltspflichtige Kinder
              <select
                value={form.dependentChildrenCount}
                onChange={(event) => setForm((current) => ({ ...current, dependentChildrenCount: event.target.value }))}
                className={FIELD_CLASS}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Staatsangehörigkeit
              <select
                value={form.nationalityGroup}
                onChange={(event) => setForm((current) => ({ ...current, nationalityGroup: event.target.value }))}
                className={FIELD_CLASS}
              >
                <option value="de">DE-Bürger</option>
                <option value="eu_ch">CH- / EU-Bürger</option>
                <option value="other">Andere</option>
              </select>
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Beschäftigungsart
              <select
                value={form.employmentMode}
                onChange={(event) => setForm((current) => ({ ...current, employmentMode: event.target.value }))}
                className={FIELD_CLASS}
              >
                <option value="salary">Gehalt</option>
                <option value="hourly">Stundenlohn</option>
              </select>
            </label>
            <label className="min-w-0 text-sm text-slate-700">
              Beim aktuellen Arbeitgeber seit
              <DateInput
                lang="de-DE"
                value={form.employmentStartDate}
                onChange={(event) => setForm((current) => ({ ...current, employmentStartDate: event.target.value }))}
              />
            </label>
          </div>

          <div className="mt-5 space-y-3">
            <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={form.acceptsPrivacyPolicy}
                onChange={(event) => {
                  setForm((current) => ({ ...current, acceptsPrivacyPolicy: event.target.checked }))
                  setConsentError(null)
                }}
                className={CHECKBOX_CLASS}
              />
              <span className="min-w-0 leading-relaxed">
                Ich stimme der Verarbeitung meiner Angaben gemäß{" "}
                <Link
                  href="/datenschutz"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-slate-900 underline underline-offset-2"
                >
                  Datenschutzerklärung
                </Link>{" "}
                zu.
              </span>
            </label>

            <div className="rounded-[22px] border border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.95),rgba(255,255,255,0.98))] px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-800">
                    Provisionsvereinbarung
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    Vorschau direkt im ersten Formular einsehbar
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Die Provisionsvereinbarung bleibt Teil der ersten Stufe. Eine Vorauszahlung ist hier aber nicht
                    fällig.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProvisionPreview(true)}
                  className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300"
                >
                  Vorschau öffnen
                </button>
              </div>
              <div className="mt-3 rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-xs leading-relaxed text-slate-600">
                Die Provisionszahlung wird erst nach der Kreditauszahlung und nach Ablauf des 14-tägigen
                Widerrufsrechts fällig.
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={form.acceptsProvisionAgreement}
                onChange={(event) => {
                  setForm((current) => ({ ...current, acceptsProvisionAgreement: event.target.checked }))
                  setConsentError(null)
                }}
                className={CHECKBOX_CLASS}
              />
              <span className="min-w-0 leading-relaxed">
                Ich habe die Vorschau der Provisionsvereinbarung gelesen und bestätige, dass die Provisionszahlung
                erst nach der Kreditauszahlung und nach Ablauf des 14-tägigen Widerrufsrechts fällig wird.
              </span>
            </label>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-relaxed text-slate-500">
              Die konkrete Provisionsregelung wird im weiteren Verlauf in den Vertragsunterlagen ausgewiesen. Im ersten
              Formular wird keine Vorauszahlung verlangt.
            </div>

            <div className="rounded-[22px] border border-cyan-200 bg-cyan-50/70 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-800">
                Aktuelle Variante
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-cyan-100 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">Kreditsumme</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    {amount.toLocaleString("de-DE")} EUR
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-100 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">Laufzeit</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{termMonths} Monate</div>
                </div>
                <div className="rounded-2xl border border-cyan-100 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">Monatsrate</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{formatRate(monthlyRate)}</div>
                </div>
              </div>
            </div>

            {consentError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {consentError}
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className={PRIMARY_BUTTON_CLASS}
            >
              {busy ? "Vorprüfung läuft..." : "Erste Vorprüfung starten"}
            </button>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Live-Einschätzung</div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              So sieht Ihre aktuelle Variante aus
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">Variante</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {amount.toLocaleString("de-DE")} EUR / {termMonths} Monate / {formatRate(monthlyRate)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">Nächster Schritt</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  Bei passender Vorprüfung direkt weiter in den vollständigen Antrag.
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">Arbeitgeber-Regel</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {liveCheck.employmentRequirementText ?? "-"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">Berechnete Beschäftigungsdauer</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {employmentMonthsCurrent == null ? "-" : `${employmentMonthsCurrent} Monate`}
                </div>
              </div>
            </div>

            <div
              className={`mt-4 rounded-[24px] border px-4 py-4 text-sm ${
                liveCheck.eligible
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {liveCheck.eligible
                ? "Die Eckdaten passen grundsätzlich. Sie können direkt mit dem nächsten Schritt fortfahren."
                : liveCheck.reason ?? "Die aktuelle Auswahl passt noch nicht vollständig zur Strecke."}
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-cyan-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_38%),linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.98))] p-5 shadow-sm sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Team</div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Ihre Kreditexperten bei SEPANA
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Keine anonyme Strecke: Unser Team begleitet Ihre Anfrage strukturiert und persönlich bis zur nächsten klaren Entscheidung.
            </p>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {ADVISOR_TEAM.map((advisor) => (
                <article
                  key={advisor.name}
                  className="group overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-sm ring-1 ring-white/70"
                >
                  <div className="relative h-36 overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_52%,#e2e8f0_100%)]">
                    <Image
                      src={advisor.imageSrc}
                      alt={advisor.imageAlt}
                      fill
                      unoptimized
                      quality={100}
                      className="object-cover object-top transition duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, 280px"
                      style={{ objectPosition: advisor.imagePosition }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/28 via-slate-900/0 to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full border border-[#0b1f5e]/80 bg-[#0b1f5e] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                      {advisor.role}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="text-base font-semibold text-slate-900">{advisor.name}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#0b1f5e]">
                      {advisor.role}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-slate-600">{advisor.focus}</div>
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        OK
                      </span>
                      Persönliche Begleitung statt Standardstrecke
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
              Sie starten digital, werden aber nicht allein gelassen. Genau dafür ist diese Strecke bewusst persönlich aufgebaut.
            </div>
          </section>
        </div>
      </div>

      {showProvisionPreview ? (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-slate-950/70 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schufa-provision-preview-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_30px_90px_rgba(15,23,42,0.32)] sm:rounded-[32px] sm:p-7"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800">Vorschau</div>
            <h3 id="schufa-provision-preview-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Provisionsvereinbarung
            </h3>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                SEPANA begleitet Ihre Anfrage strukturiert bis zu den nächsten Schritten im Kreditprozess und weist die
                Provisionsregelung transparent aus.
              </div>
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
                <div className="font-semibold text-slate-900">Fälligkeit</div>
                <div className="mt-1">
                  Die Provisionszahlung wird erst fällig, wenn der Kredit ausgezahlt wurde und das 14-tägige
                  Widerrufsrecht vollständig abgelaufen ist.
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                Vor diesem Zeitpunkt ist keine Vorauszahlung im ersten Formular geschuldet.
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                Die konkrete Provisionsregelung wird im weiteren Verlauf in den Vertragsunterlagen ausgewiesen.
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowProvisionPreview(false)}
                className={`${PRIMARY_BUTTON_CLASS} flex-1`}
              >
                Vorschau schließen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {busy ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/72 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,47,73,0.98))] px-5 py-7 text-white shadow-[0_28px_80px_rgba(15,23,42,0.45)] sm:rounded-[32px] sm:px-6 sm:py-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-emerald-300" />
            </div>
            <div className="mt-6 text-center text-2xl font-semibold tracking-tight">Wir prüfen Ihre Eckdaten</div>
            <p className="mt-3 text-center text-sm leading-relaxed text-slate-200">
              Einen Moment bitte. Die erste Vorprüfung läuft und das Ergebnis wird anschließend direkt eingeblendet.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {["Kontakt wird vorbereitet", "Variante wird geprüft", "Nächster Schritt wird geladen"].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {resultModal ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/70 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schufa-precheck-result-title"
            className={`max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[28px] border p-4 shadow-[0_30px_90px_rgba(15,23,42,0.32)] sm:rounded-[32px] sm:p-7 ${resultToneClass}`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {resultModal.tone === "success"
                ? "Erste Vorprüfung positiv"
                : resultModal.tone === "rejected"
                  ? "Erste Vorprüfung negativ"
                  : "Technischer Hinweis"}
            </div>
            <h3 id="schufa-precheck-result-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {resultModal.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{resultModal.description}</p>

            {resultModal.tone === "success" ? (
              <div className="mt-5 rounded-[26px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))] p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-900 text-lg font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                    OK
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      Nächster Schritt freigeschaltet
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      Der vollständige Antrag ist jetzt direkt für Sie bereit.
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-slate-700">
                      Sie müssen nichts neu starten. Die Vorprüfungsdaten werden direkt in den nächsten Schritt übernommen.
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    "Antrag öffnen",
                    "Restliche Angaben ergänzen",
                    "Danach Unterlagen hochladen",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-emerald-200/80 bg-white/90 px-3 py-3 text-sm font-semibold text-slate-900"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {resultModal.precheck ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
                  Nächster Schritt
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {resultModal.tone === "success" ? "Vollständigen Antrag ausfüllen" : "Daten prüfen und anpassen"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
                  Arbeitgeber-Anforderung
                  <div className="mt-2 font-semibold text-slate-900">
                    {resultModal.precheck.employmentRequirementText ?? "-"}
                  </div>
                </div>
              </div>
            ) : null}

            {resultModal.precheck?.incomeCheckPending ? (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                Hinweis: Diese erste Vorprüfung basiert bewusst nur auf den wichtigsten Eckdaten.
              </div>
            ) : null}

            {resultModal.tone !== "success" && resultModal.precheck?.reason ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Hinweis: {resultModal.precheck.reason}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {resultModal.applicationHref ? (
                <a href={resultModal.applicationHref} className={`${PRIMARY_BUTTON_CLASS} flex-1`}>
                  {resultModal.actionLabel}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setResultModal(null)}
                  className={`${PRIMARY_BUTTON_CLASS} flex-1`}
                >
                  {resultModal.actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
