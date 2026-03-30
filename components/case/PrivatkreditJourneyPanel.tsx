import Link from "next/link"
import type { PrivatkreditJourneySummary, PrivatkreditJourneyMeta } from "@/lib/europace/customerJourney"

function labelStepState(value: "done" | "current" | "upcoming") {
  if (value === "done") return "Erledigt"
  if (value === "current") return "Aktuell"
  return "Danach"
}

function stepClasses(value: "done" | "current" | "upcoming") {
  if (value === "done") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (value === "current") return "border-slate-900 bg-slate-900 text-white"
  return "border-slate-200 bg-white text-slate-700"
}

export default function PrivatkreditJourneyPanel({
  caseId,
  summary,
  meta,
}: {
  caseId: string
  summary: PrivatkreditJourneySummary
  meta: PrivatkreditJourneyMeta
}) {
  const quickLinks = [
    { href: `/app/faelle/${caseId}#privatkredit-angaben`, label: "Angaben" },
    { href: `/app/faelle/${caseId}#privatkredit-angebote`, label: "Angebote" },
    ...(summary.shouldHideUploads ? [] : [{ href: `/app/faelle/${caseId}#privatkredit-unterlagen`, label: "Unterlagen" }]),
    ...(summary.shouldHideSignatures ? [] : [{ href: `/app/faelle/${caseId}#privatkredit-unterschrift`, label: "Unterschrift" }]),
    { href: `/app/faelle/${caseId}#privatkredit-status`, label: "Status" },
  ]
  const hasLockedOfferView = summary.hasAcceptedOffer || summary.hasRunningApplicationJob || summary.hasApplication

  return (
    <section
      id="privatkredit-journey"
      className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-[0_24px_64px_rgba(15,23,42,0.35)] sm:p-8"
    >
      <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">Privatkredit</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Antrag fortsetzen</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
              {summary.directOnlineBankCompletionFlow
                ? summary.isCompleted
                  ? "Dein Kontocheck-Direktabschluss ist erledigt. Der Antrag liegt im Fall und der weitere Upload-Schritt entfällt vollständig."
                  : "Nach dem Kontocheck läuft dieser Privatkredit direkt online bei der Bank weiter. SEPANA zeigt dir hier nur noch den aktuellen Fortschritt bis zur Legitimation und digitalen Signatur."
                : hasLockedOfferView
                  ? "Dein ausgewähltes Angebot bleibt jetzt fixiert. Ab hier führen wir dich nur noch durch Antrag, Unterlagen, Vertrag und Status."
                  : "Du führst deinen Privatkredit Schritt für Schritt weiter: Angaben vervollständigen, Live-Angebot wählen, Unterlagen hochladen und den Antrag bis zum Abschluss begleiten."}
            </p>
          </div>

          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/80">Naechster Schritt</div>
            <div className="mt-2 text-lg font-semibold text-white">{summary.nextLabel}</div>
            <p className="mt-1 text-sm text-slate-200/90">{summary.nextDescription}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                href={summary.nextHref}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
              >
                Jetzt fortsetzen
              </Link>
              <Link
                href={`/app/faelle/${caseId}#privatkredit-status`}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Antragsstatus ansehen
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 transition hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">Aktueller Stand</div>
            <div className="mt-1 text-sm font-semibold text-white">{summary.stageLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">Kontocheck</div>
            <div className="mt-1 text-sm font-semibold text-white">{summary.accountCheckRequired ? "Ja" : "Nein"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">
              {summary.directOnlineBankCompletionFlow ? "Bankdokumente" : hasLockedOfferView ? "Ausgewähltes Angebot" : "Live-Angebote"}
            </div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {summary.directOnlineBankCompletionFlow ? summary.importedBankDocumentCount : hasLockedOfferView ? 1 : summary.offerCount}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">
              {summary.directOnlineBankCompletionFlow ? "Bank-Links" : "Unterlagen"}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {summary.directOnlineBankCompletionFlow
                ? summary.bankContinuationReady
                  ? "Bereit"
                  : summary.isCompleted
                    ? "Erledigt"
                    : "Warten"
                : summary.requiredDocumentCount > 0
                  ? `${summary.uploadedDocumentCount}/${summary.requiredDocumentCount}`
                  : summary.hasApplication
                    ? "Noch keine"
                    : "-"}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">
              {summary.directOnlineBankCompletionFlow ? "Direkt-online" : "Unterschriften offen"}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {summary.directOnlineBankCompletionFlow ? "Ja" : summary.customerSignatureOpenCount}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">Antrag</div>
            <div className="mt-1 text-sm font-semibold text-white break-all">
              {summary.hasApplication ? (meta?.antragsnummer ?? "vorhanden") : summary.hasRunningApplicationJob ? "wird erstellt" : "-"}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-5">
          {summary.steps.map((step) => (
            <div key={step.id} className={`rounded-2xl border p-4 shadow-sm ${stepClasses(step.state)}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
                {labelStepState(step.state)}
              </div>
              <div className="mt-2 text-base font-semibold">{step.title}</div>
              <p className="mt-1 text-sm leading-relaxed opacity-90">{step.description}</p>
            </div>
          ))}
        </div>

        {meta?.last_error ? (
          <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-200/10 px-4 py-3 text-sm text-amber-50">
            Letzter Hinweis: {meta.last_error}
          </div>
        ) : null}
      </div>
    </section>
  )
}
