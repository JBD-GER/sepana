import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Baufinanzierung Auswahl",
  robots: { index: false, follow: false },
}

const ACCENT = "#091840"

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

async function getRecommendation(caseId: string, caseRef: string) {
  const qs = new URLSearchParams({ caseId, caseRef }).toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/baufi/recommendation?${qs}`, {
    cache: "no-store",
  })
  const json = await res.json().catch(() => null)
  return json?.recommendation as
    | {
        recommended: "online" | "live"
        confidence: number
        headline: string
        reasoning: string[]
        risk_flags: string[]
        transparency_note: string
      }
    | null
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur-xl">
      {children}
    </div>
  )
}

function Card({
  title,
  subtitle,
  highlight,
  ctaHref,
  ctaLabel,
  bullets,
}: {
  title: string
  subtitle: string
  highlight?: string
  ctaHref: string
  ctaLabel: string
  bullets: string[]
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition hover:bg-white/80 hover:shadow-md">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: ACCENT }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
        </div>
        {highlight ? (
          <div
            className="shrink-0 rounded-2xl px-3 py-1.5 text-xs font-medium text-white shadow-sm"
            style={{ background: ACCENT }}
          >
            {highlight}
          </div>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full" style={{ background: ACCENT }} />
            <span className="min-w-0">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Link
          href={ctaHref}
          className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] sm:w-auto"
          style={{ background: ACCENT }}
        >
          {ctaLabel}
        </Link>

        <div className="text-xs text-slate-500">
          Sie können später jederzeit wechseln.
        </div>
      </div>
    </div>
  )
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; caseRef?: string }>
}) {
  const sp = await searchParams
  const caseId = sp.caseId || ""
  const caseRef = sp.caseRef || ""

  const rec = caseId ? await getRecommendation(caseId, caseRef) : null
  const recommended = rec?.recommended

  return (
    <div className="space-y-4">
      {/* HERO BOX (volle Breite) */}
      <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          {/* 2/3 HEADLINE */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Pill>DSGVO-konform</Pill>
              <Pill>In ~60 Sekunden startklar</Pill>
              <Pill>Ergebnis im Portal</Pill>
              {rec?.headline ? (
                <div
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm"
                  style={{ background: ACCENT }}
                >
                  KI-Empfehlung: {recommended === "online" ? "Online-Vergleich" : "Live-Beratung"}
                </div>
              ) : null}
            </div>

            <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
              Finden Sie die passende Baufinanzierung –<br className="hidden sm:block" />
              strukturiert & ohne Chaos.
            </h1>

            <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
              Wir haben Ihre Angaben gespeichert. Jetzt wählen Sie, wie Sie fortfahren möchten:
              <span className="font-medium text-slate-900"> günstig online vergleichen</span> oder
              <span className="font-medium text-slate-900"> live mit Beratung</span> (wenn es knapp/komplex ist).
            </p>

            {rec ? (
              <div className="rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{rec.headline}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Transparenz: {rec.transparency_note}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-white/60 bg-white/70 px-3 py-1.5 text-xs text-slate-700">
                    Confidence: {Math.round((rec.confidence || 0) * 100)}%
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                    <div className="text-xs font-medium text-slate-900">Warum?</div>
                    <ul className="mt-1 space-y-1 text-xs text-slate-600">
                      {(rec.reasoning || []).slice(0, 3).map((x, i) => (
                        <li key={i}>• {x}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                    <div className="text-xs font-medium text-slate-900">Hinweise</div>
                    <ul className="mt-1 space-y-1 text-xs text-slate-600">
                      {(rec.risk_flags || []).length ? (
                        rec.risk_flags.slice(0, 3).map((x, i) => <li key={i}>• {x}</li>)
                      ) : (
                        <li>• Keine kritischen Flags erkannt.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Hinweis: Empfehlung konnte nicht geladen werden. Sie können trotzdem fortfahren.
              </div>
            )}
          </div>

          {/* 1/3 BONUS BOX */}
          <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: ACCENT }}
              >
                €
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-600">Bonus bei erfolgreichem Abschluss</div>
                <div className="mt-0.5 text-3xl font-semibold text-slate-900">350 €</div>
                <div className="mt-1 text-xs text-slate-600">
                  Gutschrift nach erfolgreicher Finanzierung/Abschluss gemäß Bedingungen.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-xs text-slate-700">
              Tipp: Wenn die Haushaltsrechnung knapp ist, sparen Sie mit Live-Beratung oft Zeit & Schleifen.
            </div>
          </div>
        </div>
      </div>

      {/* ACTION CARDS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Online-Vergleich (günstig & schnell)"
          subtitle="Wir priorisieren günstige Konditionen – transparent & ohne falsche Versprechen."
          highlight={recommended === "online" ? "Empfohlen" : undefined}
          ctaHref={`/baufinanzierung/banken?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}`}
          ctaLabel="Zum Online-Vergleich"
          bullets={[
            "Ideal, wenn Ihr finanzieller Puffer solide ist.",
            "Sie sehen Angebote übersichtlich und können direkt auswählen.",
            "Danach: Dokumente hochladen → Bankenprüfung → Abschluss.",
          ]}
        />

        <Card
          title="Live-Beratung (wenn es knapp/komplex ist)"
          subtitle="Wir prüfen live, welche Bank wirklich passt – und vermeiden unnötige Ablehnungen."
          highlight={recommended === "live" ? "Empfohlen" : undefined}
          ctaHref={`/baufinanzierung/live?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}`}
          ctaLabel="Zur Live-Beratung"
          bullets={[
            "Empfohlen bei knappem Puffer, Sonderfällen oder Unsicherheit.",
            "Sie erhalten eine klare Einschätzung + next steps.",
            "Sie können jederzeit zurück in den Online-Vergleich wechseln.",
          ]}
        />
      </div>

      {/* MINI FOOTER */}
      <div className="rounded-3xl border border-white/60 bg-white/55 p-4 text-sm text-slate-600 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Fall-Referenz: <span className="font-medium text-slate-900">{caseRef || "—"}</span>
          </div>
          <Link href="/login" className="text-sm font-medium text-slate-900 underline underline-offset-4">
            Ich habe schon ein Konto → anmelden
          </Link>
        </div>
      </div>
    </div>
  )
}
