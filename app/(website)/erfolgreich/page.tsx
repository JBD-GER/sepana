import type { Metadata } from "next"
import Link from "next/link"
import { Suspense, type ReactNode } from "react"
import GoogleAdsDankeConversion from "./ui/GoogleAdsDankeConversion"

export const metadata: Metadata = {
  title: "Anfrage erfolgreich | SEPANA",
  description: "Ihre Anfrage wurde erfolgreich übermittelt. Die nächsten Schritte erhalten Sie per E-Mail und durch Ihren Kundenberater.",
  alternates: { canonical: "/erfolgreich" },
}

type SourceType = "baufi" | "privatkredit" | null

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function parseExisting(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

function parseSource(value: string | string[] | undefined): SourceType {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (
    normalized === "baufi" ||
    normalized === "baufinanzierung" ||
    normalized.startsWith("baufi") ||
    normalized.includes("immobilie")
  ) {
    return "baufi"
  }
  if (
    normalized === "privatkredit" ||
    normalized === "konsum" ||
    normalized.startsWith("privatkredit") ||
    normalized.includes("scheidung-kredit-privat")
  ) {
    return "privatkredit"
  }
  return null
}

function sourceBackLink(source: SourceType) {
  if (source === "baufi") return { href: "/baufinanzierung", label: "Zur Baufinanzierung" }
  if (source === "privatkredit") return { href: "/privatkredit", label: "Zum Privatkredit" }
  return null
}

function IconCheckBadge(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.7 12.3l2.2 2.2 4.7-4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMail(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 8l5.6 4.2a1.5 1.5 0 0 0 1.8 0L18.5 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconUserCall(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.5 6.5h3M20 5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconShield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 3l7 3v6c0 4.3-2.7 7.3-7 9-4.3-1.7-7-4.7-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m13 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StepCard({
  step,
  title,
  text,
  icon,
  accentClass,
}: {
  step: string
  title: string
  text: string
  icon: ReactNode
  accentClass: string
}) {
  return (
    <article className="relative rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl border", accentClass)}>{icon}</div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{step}</div>
      <h2 className="mt-1 text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
    </article>
  )
}

export default async function ErfolgreichPage({
  searchParams,
}: {
  searchParams?: Promise<{ existing?: string | string[]; source?: string | string[] }>
}) {
  const resolved = searchParams ? await searchParams : undefined
  const existingAccount = parseExisting(resolved?.existing)
  const source = parseSource(resolved?.source)
  const backLink = sourceBackLink(source)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <GoogleAdsDankeConversion />
      </Suspense>

      <div className="space-y-5 sm:space-y-6">
        <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_14%,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_88%_10%,rgba(59,130,246,0.12),transparent_34%),linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#0f3a80_100%)] p-6 text-white shadow-[0_24px_70px_rgba(2,6,23,0.30)] sm:p-8">
          <div className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-cyan-300/14 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-16 h-56 w-56 rounded-full bg-blue-300/14 blur-3xl" />

          <div className="relative grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                <IconCheckBadge className="h-3.5 w-3.5" />
                Erfolgreich übermittelt
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Vielen Dank für Ihre Anfrage
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
                Ihre Angaben sind bei uns eingegangen. Die nächsten Schritte laufen jetzt digital und strukturiert weiter.
              </p>

              {existingAccount ? (
                <div className="mt-4 rounded-2xl border border-emerald-200/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
                  Ihr bestehendes Kundenkonto wurde erkannt. Die Anfrage wird dort direkt gespeichert.
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/kreditanfrage"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Weitere Kreditanfrage starten
                  <IconArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Zur Startseite
                </Link>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur sm:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/90">Was als Nächstes passiert</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">1. E-Mail</div>
                  <div className="mt-1 text-sm font-semibold text-white">Einladung zum SEPANA-Portal</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-200/90">
                    Sie erhalten eine Einladung per E-Mail und können damit Ihre Anfrage digital weiterführen.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">2. Kontakt</div>
                  <div className="mt-1 text-sm font-semibold text-white">Zugewiesener Kundenberater meldet sich</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-200/90">
                    Ihr zugewiesener Kundenberater kontaktiert Sie und stimmt die nächsten sinnvollen Schritte mit Ihnen ab.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">3. Prüfung</div>
                  <div className="mt-1 text-sm font-semibold text-white">Digitale Prüfung Ihrer Finanzierung</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-200/90">
                    Danach startet die digitale Prüfung Ihrer Finanzierung auf Basis Ihrer Angaben und Unterlagen.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-cyan-200/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-12 -top-10 h-36 w-36 rounded-full bg-emerald-200/20 blur-3xl" />

          <div className="relative">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Nächste Schritte</div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  So geht es nach Ihrer Anfrage weiter
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Sie müssen jetzt nichts weiter vorbereiten. Wir führen Sie Schritt für Schritt durch den weiteren Ablauf.
                </p>
              </div>
              {backLink ? (
                <Link
                  href={backLink.href}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {backLink.label}
                </Link>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <StepCard
                step="Schritt 1"
                title="Einladung per E-Mail erhalten"
                text="Sie haben eine Einladung zum Portal erhalten. Bitte prüfen Sie auch den Spam-Ordner, falls die Nachricht nicht direkt im Posteingang erscheint."
                icon={<IconMail className="h-5 w-5" />}
                accentClass="border-cyan-200 bg-cyan-50 text-cyan-700"
              />
              <StepCard
                step="Schritt 2"
                title="Zugewiesener Kundenberater kontaktiert Sie"
                text="Ihr zugewiesener Kundenberater meldet sich persönlich bei Ihnen, beantwortet Rückfragen und koordiniert die nächsten Schritte."
                icon={<IconUserCall className="h-5 w-5" />}
                accentClass="border-blue-200 bg-blue-50 text-[#0b1f5e]"
              />
              <StepCard
                step="Schritt 3"
                title="Digitale Prüfung der Finanzierung"
                text="Im Anschluss erfolgt die digitale Prüfung Ihrer Finanzierung. Dafür werden Ihre Angaben strukturiert ausgewertet und bei Bedarf ergänzt."
                icon={<IconShield className="h-5 w-5" />}
                accentClass="border-emerald-200 bg-emerald-50 text-emerald-700"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[26px] border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hinweis</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Bitte E-Mail-Postfach kurz prüfen</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Die Einladung zum SEPANA-Portal wird an die angegebene E-Mail-Adresse gesendet. Darüber können Sie Ihre Anfrage digital weiterführen.
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <span className="mt-[2px] text-emerald-600">
                  <IconCheckBadge className="h-4 w-4" />
                </span>
                <span>Spam- / Werbung-Ordner prüfen, falls die Einladung nicht sofort sichtbar ist.</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <span className="mt-[2px] text-emerald-600">
                  <IconCheckBadge className="h-4 w-4" />
                </span>
                <span>Ihre Anfrage wird parallel intern vorbereitet und dem zuständigen Kundenberater zugeordnet.</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <span className="mt-[2px] text-emerald-600">
                  <IconCheckBadge className="h-4 w-4" />
                </span>
                <span>Die digitale Prüfung startet nach der Erstkontaktaufnahme und den nächsten abgestimmten Angaben.</span>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/70 bg-[linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#0f3a80_100%)] p-5 text-white shadow-[0_18px_45px_rgba(2,6,23,0.22)] sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/90">Weiter</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Während wir prüfen</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
              Sie können zur Startseite zurückkehren oder bei Bedarf eine weitere Anfrage starten. Ihre aktuelle Anfrage bleibt gespeichert.
            </p>

            <div className="mt-5 grid gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Zur Startseite
              </Link>
              <Link
                href="/kreditanfrage"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Neue Kreditanfrage starten
              </Link>
              {backLink ? (
                <Link
                  href={backLink.href}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {backLink.label}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}


