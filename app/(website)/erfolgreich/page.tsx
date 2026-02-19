import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import GoogleAdsDankeConversion from "./ui/GoogleAdsDankeConversion"

export const metadata: Metadata = {
  title: "Anfrage erfolgreich | SEPANA",
  description: "Ihre Anfrage wurde erfolgreich uebermittelt. Wir melden uns zeitnah bei Ihnen.",
  alternates: { canonical: "/erfolgreich" },
}

function parseExisting(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export default async function ErfolgreichPage({
  searchParams,
}: {
  searchParams?: Promise<{ existing?: string | string[] }>
}) {
  const resolved = searchParams ? await searchParams : undefined
  const existingAccount = parseExisting(resolved?.existing)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <GoogleAdsDankeConversion />
      </Suspense>
      <section className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-white p-6 shadow-[0_24px_70px_rgba(2,6,23,0.10)] sm:p-10">
        <div className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -bottom-16 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />

        <div className="relative">
          <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Erfolgreich
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Vielen Dank fuer Ihre Anfrage</h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Wir haben Ihre Angaben erhalten und melden uns zeitnah mit einer klaren Rueckmeldung zu den naechsten Schritten.
          </p>

          {existingAccount ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Die Anfrage wird im Kundenkonto gespeichert.
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Schritt 1</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Datenpruefung</div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Schritt 2</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Persoenliche Rueckmeldung</div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Schritt 3</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Naechster Schritt</div>
            </article>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/privatkredit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Zurueck zur Privatkredit-Seite
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Zur Startseite
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
