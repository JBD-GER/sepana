import Link from "next/link"
import type { ReactNode, SVGProps } from "react"

const ACCENT = "#091840"

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

/* ────────────────────────────────────────────────────────────────
   Icons (no deps)
──────────────────────────────────────────────────────────────── */

function IconArrow(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconWallet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M16 12h4v4h-4a2 2 0 010-4z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M7 9h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}
function IconShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 2l7 4v6c0 5-3 9-7 10C8 21 5 17 5 12V6l7-4z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M6 11h12v10H6V11z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  )
}
function IconDoc(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M7 3h7l3 3v15H7V3z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}
function IconBolt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M13 2L4 14h7l-1 8 10-12h-7l0-8z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconChat(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M7 18l-3 3V6a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H7z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M8 9h10M8 12h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}
function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconSpark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 2l1.6 5.3L19 9l-5.4 1.7L12 16l-1.6-5.3L5 9l5.4-1.7L12 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 13.5l.8 2.6L23 17l-2.7.9-.8 2.6-.8-2.6L16 17l2.7-.9.8-2.6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────────
   Small UI building blocks
──────────────────────────────────────────────────────────────── */

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-1 text-xs text-slate-700 shadow-sm whitespace-nowrap">
      {children}
    </span>
  )
}

function SectionTitle({
  kicker,
  title,
  desc,
  right,
}: {
  kicker?: string
  title: string
  desc?: string
  right?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {kicker ? <div className="text-xs font-semibold text-slate-500">{kicker}</div> : null}
        <div className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</div>
        {desc ? <div className="text-sm text-slate-600">{desc}</div> : null}
      </div>
      {right ? <div className="text-xs text-slate-500">{right}</div> : null}
    </div>
  )
}

/** ✅ Always single-line on desktop: truncate + title for hover */
function CheckRow({ text }: { text: string }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/85 px-4 py-3 shadow-sm">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ backgroundColor: ACCENT }}
        aria-hidden
      >
        <IconCheck className="h-5 w-5" />
      </span>
      <span
        className="min-w-0 text-sm text-slate-700 sm:whitespace-nowrap sm:truncate"
        title={text}
      >
        {text}
      </span>
    </div>
  )
}

/** ✅ Never wrap (fixes “Angebote / sichtbar”) */
function MiniStat({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-1 text-xs text-slate-700 shadow-sm whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} aria-hidden />
      {label}
    </div>
  )
}

function SoftCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur", className)}>
      {children}
    </div>
  )
}

function Benefit({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-5 shadow-sm backdrop-blur transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{ backgroundColor: ACCENT }}
          aria-hidden
        >
          {icon}
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-sm text-slate-600">{desc}</div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   Choice Card (2 clean checkbox rows, 1-line meta, 1-line CTA)
──────────────────────────────────────────────────────────────── */

function ChoiceCard({
  href,
  badge,
  title,
  desc,
  icon,
  line1,
  line2,
}: {
  href: string
  badge: string
  title: string
  desc: string
  icon: ReactNode
  line1: string
  line2: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-[30px] border border-slate-200/70 bg-white/70",
        "shadow-sm backdrop-blur transition",
        "hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300/70"
      )}
    >
      <div
        className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full opacity-[0.14]"
        style={{ background: `radial-gradient(circle, ${ACCENT} 0%, transparent 60%)` }}
      />

      <div className="relative p-7 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-1 text-xs text-slate-700 shadow-sm whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} aria-hidden />
              {badge}
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">{desc}</p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm transition group-hover:opacity-95"
              style={{ backgroundColor: ACCENT }}
              aria-hidden
            >
              {icon}
            </div>

            <div className="text-xs text-slate-600 whitespace-nowrap">
              Dauer: <span className="font-semibold text-slate-900">~2 Minuten</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <CheckRow text={line1} />
          <CheckRow text={line2} />
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* ✅ shorter so it stays tidy */}
          <div className="text-sm text-slate-600 sm:whitespace-nowrap sm:truncate" title="Danach: Vorschlag auswählen → Upload-Link erhalten. Live-Beratung optional direkt im Ergebnis.">
            Danach: Vorschlag auswählen → Upload-Link. Live optional im Ergebnis.
          </div>

          {/* ✅ CTA NEVER wraps */}
          <div
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition group-hover:opacity-95 whitespace-nowrap min-w-[180px]"
            style={{ backgroundColor: ACCENT }}
          >
            Vergleich starten
            <IconArrow className="h-4 w-4" />
          </div>
        </div>
      </div>
    </Link>
  )
}

/* ────────────────────────────────────────────────────────────────
   Stepper
──────────────────────────────────────────────────────────────── */

function Step({
  n,
  title,
  desc,
  right,
}: {
  n: string
  title: string
  desc: string
  right?: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ backgroundColor: ACCENT }}
            aria-hidden
          >
            {n}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="text-sm text-slate-600">{desc}</div>
          </div>
        </div>

        {right ? <div className="hidden sm:block shrink-0">{right}</div> : null}
      </div>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">{q}</div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-700 transition group-open:rotate-45"
            aria-hidden
          >
            +
          </div>
        </div>
      </summary>
      <div className="pt-3 text-sm leading-relaxed text-slate-600">{a}</div>
    </details>
  )
}

/* ────────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="space-y-14">
      {/* FULL-BLEED HERO */}
      <section className="relative -mx-4 overflow-hidden rounded-[34px] border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur sm:-mx-6 lg:-mx-8">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(15 23 42 / 0.22) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div
            className="absolute -left-48 -top-48 h-[640px] w-[640px] rounded-full opacity-[0.13]"
            style={{ background: `radial-gradient(circle, ${ACCENT} 0%, transparent 60%)` }}
          />
          <div className="absolute -bottom-64 -right-64 h-[640px] w-[640px] rounded-full bg-slate-900/5" />
        </div>

        <div className="relative px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          {/* ONLY here: Schufa-neutral */}
          <div className="flex flex-wrap items-center gap-2">
            <Pill>
              Willkommen bei <span className="font-semibold" style={{ color: ACCENT }}>SEPANA</span>
            </Pill>
            <Pill>
              <IconShield className="h-4 w-4 text-slate-700" />
              Schufa-neutraler Vergleich
            </Pill>
            <Pill>
              <IconLock className="h-4 w-4 text-slate-700" />
              DSGVO-konform
            </Pill>
            <Pill>
              <IconChat className="h-4 w-4 text-slate-700" />
              Live wie Online-Filiale
            </Pill>
          </div>

          <div className="mt-7 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Online-Kreditvergleich –
                <span className="block" style={{ color: ACCENT }}>
                  Vorschläge sehen. Angebot wählen. Upload-Link erhalten.
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
                Sie starten den Vergleich, geben Ihre Daten ein und erhalten passende Banken-Vorschläge.
                Wählen Sie ein Angebot – danach erhalten Sie Ihren Link zum sicheren Upload der Unterlagen.
                Optional können Sie direkt bei den Vorschlägen live mit uns sprechen und alles final prüfen – wie in einer Online-Filiale.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/baufinanzierung"
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 whitespace-nowrap"
                  style={{ backgroundColor: ACCENT }}
                >
                  Vergleich starten
                  <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs whitespace-nowrap">
                    Baufinanzierung
                  </span>
                </Link>

                <Link
                  href="/privatkredit"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200/70 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:shadow-md whitespace-nowrap"
                >
                  Privatkredit vergleichen
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <MiniStat label="Banken-Vorschläge sofort sichtbar" />
                <MiniStat label="Auswahl → Upload-Link" />
                <MiniStat label="Live-Beratung optional" />
              </div>

              <div className="mt-4 text-sm text-slate-500">
                Hinweis: Konditionen sind bonitäts- & objektabhängig; die finale Prüfung erfolgt anhand Ihrer Unterlagen.
              </div>
            </div>

            <SoftCard className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900">Was passiert nach dem Ergebnis?</div>
                  <div className="text-sm text-slate-600">Zwei Wege – beide schnell und klar.</div>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{ backgroundColor: ACCENT }}
                  aria-hidden
                >
                  <IconSpark className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">A) Direkt live final prüfen</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Bei den Vorschlägen live sprechen – Fragen klären, Angebot finalisieren.
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">B) Angebot wählen → Upload-Link</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Sie wählen den Vorschlag aus und erhalten den sicheren Upload-Link.
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                  <div className="text-xs font-semibold" style={{ color: ACCENT }}>
                    Schufa-neutral
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Der Vergleich dient der Orientierung; die finale Zusage folgt nach Prüfung.
                  </div>
                </div>
              </div>
            </SoftCard>
          </div>
        </div>
      </section>

      {/* MAIN FOCUS: TWO CARDS */}
      <section className="space-y-6">
        <SectionTitle
          kicker="START"
          title="Wählen Sie Ihren Vergleich"
          desc="Daten eingeben → Banken-Vorschläge sehen → Angebot auswählen → Upload-Link erhalten (oder direkt live final prüfen)."
          right={<span>Klare Schritte • keine Formularflut</span>}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <ChoiceCard
            href="/baufinanzierung"
            badge="Immobilie"
            title="Baufinanzierung"
            desc="Kauf, Neubau oder Anschlussfinanzierung – vergleichen, Vorschläge sehen, Angebot auswählen."
            icon={<IconHome className="h-7 w-7" />}
            line1="Eckdaten eingeben → Banken-Vorschläge vergleichen"
            line2="Favorit wählen → Upload-Link (oder live final prüfen)"
          />

          <ChoiceCard
            href="/privatkredit"
            badge="Liquidität"
            title="Privatkredit"
            desc="Ratenkredit transparent vergleichen – Rate, Laufzeit & Konditionen verständlich aufbereitet."
            icon={<IconWallet className="h-7 w-7" />}
            line1="Rate, Laufzeit & Zins sofort vergleichen"
            line2="Favorit wählen → Upload-Link (oder live final prüfen)"
          />
        </div>
      </section>

      {/* BENEFITS (NO schufa spam) */}
      <section className="space-y-5">
        <SectionTitle
          kicker="VORTEILE"
          title="Warum SEPANA besser funktioniert als „nur ein Vergleich“"
          desc="Sie bekommen nicht nur Vorschläge – sondern einen sauberen Prozess bis zum Abschluss."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Benefit
            icon={<IconBolt className="h-5 w-5" />}
            title="Schnell zum Ergebnis"
            desc="Vorschläge sehen, vergleichen, einordnen – ohne Umwege."
          />
          <Benefit
            icon={<IconChat className="h-5 w-5" />}
            title="Live exakt im Ergebnis"
            desc="Wenn es wichtig wird: direkt bei den Vorschlägen live final prüfen."
          />
          <Benefit
            icon={<IconDoc className="h-5 w-5" />}
            title="Upload-Link statt E-Mail"
            desc="Unterlagen sicher übermitteln – strukturiert und nachvollziehbar."
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Benefit
            icon={<IconSpark className="h-5 w-5" />}
            title="Einordnung statt Bauchgefühl"
            desc="Sie verstehen, was das Angebot praktisch bedeutet (Rate, Laufzeit, Spielräume)."
          />
          <Benefit
            icon={<IconShield className="h-5 w-5" />}
            title="Saubere nächste Schritte"
            desc="Nach dem Ergebnis geht’s logisch weiter – Auswahl → Upload/Live."
          />
          <Benefit
            icon={<IconLock className="h-5 w-5" />}
            title="Sicher & DSGVO-konform"
            desc="Verschlüsselte Übertragung und klare Datenprozesse."
          />
        </div>
      </section>

      {/* PROCESS */}
      <section className="space-y-5">
        <SectionTitle
          kicker="ABLAUF"
          title="So läuft es bei SEPANA – Schritt für Schritt"
          desc="Erst Vergleich → dann Vorschläge → dann Auswahl → dann Upload oder live final."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Step
            n="1"
            title="Vergleich starten"
            desc="Sie geben die wichtigsten Eckdaten ein – nur das, was für Vorschläge gebraucht wird."
            right={<MiniStat label="Schnellstart" />}
          />
          <Step
            n="2"
            title="Banken-Vorschläge ansehen"
            desc="Sie sehen passende Angebote und vergleichen Konditionen – transparent & verständlich."
            right={<MiniStat label="Vorschläge" />}
          />
          <Step
            n="3"
            title="Angebot auswählen"
            desc="Sie wählen Ihren Favoriten – danach erhalten Sie den Upload-Link (oder wir melden uns)."
            right={<MiniStat label="Auswahl" />}
          />
          <Step
            n="4"
            title="Upload oder Live-Finalprüfung"
            desc="Unterlagen hochladen (Upload-Link) oder direkt live bei den Vorschlägen final prüfen."
            right={<MiniStat label="Upload/Live" />}
          />
        </div>

        <SoftCard className="p-7 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="text-sm font-semibold text-slate-900">Live-Beratung – genau im richtigen Moment</div>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Sobald die Vorschläge da sind, entstehen die entscheidenden Fragen. Genau dort können Sie live
                mit uns sprechen – wir klären offene Punkte und prüfen den Fall direkt final.
              </p>

              <div className="mt-4 grid gap-3">
                <CheckRow text="Offene Fragen zu Rate/Laufzeit sofort klären" />
                <CheckRow text="Finale Einordnung direkt im Ergebnis" />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900">Direkt starten</div>
                  <div className="text-sm text-slate-600">Live ist optional – die Vorschläge kommen zuerst.</div>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{ backgroundColor: ACCENT }}
                  aria-hidden
                >
                  <IconArrow className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Link
                  href="/baufinanzierung"
                  className="group inline-flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 whitespace-nowrap"
                  style={{ backgroundColor: ACCENT }}
                >
                  Baufinanzierung starten
                  <IconArrow className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>

                <Link
                  href="/privatkredit"
                  className="group inline-flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md whitespace-nowrap"
                >
                  Privatkredit starten
                  <IconArrow className="h-4 w-4 transition group-hover:translate-x-0.5" style={{ color: ACCENT }} />
                </Link>

                <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                  <div className="text-xs font-semibold" style={{ color: ACCENT }}>
                    Upload-Link
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Nach Auswahl erhalten Sie Ihren Link für Unterlagen & Nachweise.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SoftCard>
      </section>

      {/* PORTAL / TRUST */}
      <section className="space-y-5">
        <SectionTitle
          kicker="PORTAL"
          title="Sicherer Ablauf – von Eingabe bis Upload"
          desc="Damit Sie nach dem Ergebnis nicht im E-Mail-Chaos landen."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Benefit
            icon={<IconLock className="h-5 w-5" />}
            title="Verschlüsselte Übertragung"
            desc="Daten & Uploads laufen verschlüsselt – keine sensiblen PDFs per E-Mail."
          />
          <Benefit
            icon={<IconDoc className="h-5 w-5" />}
            title="Strukturierte Unterlagen"
            desc="Upload-Link führt Sie durch die Unterlagen – sauber, nachvollziehbar, geordnet."
          />
          <Benefit
            icon={<IconShield className="h-5 w-5" />}
            title="Klarer Prozess"
            desc="Ein Vorgang, klare Schritte – weniger Missverständnisse, weniger Rückfragen."
          />
        </div>

        <SoftCard className="p-7 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900">Was Sie im Portal erwarten können</div>
              <p className="text-sm text-slate-600 sm:text-base">
                Sobald Sie Ihr Angebot gewählt haben, erhalten Sie den Upload-Link. Dort laden Sie Unterlagen sicher hoch
                und behalten Fortschritt & nächste Schritte im Blick.
              </p>

              {/* ✅ +2 Punkte, alle tidy (1-line on desktop) */}
              <div className="mt-4 grid gap-3">
                <CheckRow text="Unterlagen hochladen – sicher, geordnet, ohne E-Mail-Anhänge" />
                <CheckRow text="Fortschritt & nächste Schritte jederzeit sichtbar" />
                <CheckRow text="Fehlende Dokumente klar markiert – keine Ratespiele" />
                <CheckRow text="Rückfragen zentral im Vorgang statt 20 Nachrichten" />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Beispiele für typische Unterlagen</div>
              <p className="mt-2 text-sm text-slate-600">
                Je nach Fall können folgende Dokumente relevant sein (die genaue Liste erhalten Sie im Upload-Link):
              </p>

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {[
                  "Einkommensnachweise (z. B. Gehalt, Selbstständigkeit)",
                  "Identitätsnachweis",
                  "Objekt-/Projektunterlagen (bei Baufinanzierung)",
                  "Bestehende Kredite/Verbindlichkeiten (falls vorhanden)",
                  "Weitere Nachweise je nach Situation",
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                <div className="text-xs font-semibold" style={{ color: ACCENT }}>
                  Tipp
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Wenn Sie im Ergebnis Fragen haben, ist Live-Beratung oft schneller als mehrere Rückfragen.
                </p>
              </div>
            </div>
          </div>
        </SoftCard>
      </section>

      {/* FAQ */}
      <section className="space-y-5">
        <SectionTitle kicker="FAQ" title="Häufige Fragen" desc="Kurz und klar – damit Sie wissen, was Sie erwartet." />

        <div className="grid gap-4 lg:grid-cols-2">
          <FAQItem
            q="Was passiert nach dem Vergleich?"
            a="Sie sehen Banken-Vorschläge. Wählen Sie ein Angebot, erhalten Sie den Upload-Link für Unterlagen (oder wir melden uns). Alternativ können Sie direkt bei den Vorschlägen live sprechen und final prüfen."
          />
          <FAQItem
            q="Kann ich direkt live sprechen?"
            a="Ja. Sobald die Vorschläge angezeigt werden, können Sie optional live wie in einer Online-Filiale mit uns sprechen – ideal, um offene Fragen sofort zu klären."
          />
          <FAQItem
            q="Sind die angezeigten Konditionen verbindlich?"
            a="Die Vorschläge sind Orientierungswerte. Die finale Kondition hängt von Bonität sowie – bei Baufinanzierung – vom Objekt ab und wird nach Prüfung (inkl. Unterlagen) bestätigt."
          />
          <FAQItem
            q="Warum gibt es einen Upload-Link?"
            a="Damit sensible Unterlagen nicht per E-Mail versendet werden. Der Upload-Link ist der sichere, strukturierte Weg für Nachweise und nächste Schritte."
          />
          <FAQItem
            q="Wie schnell sehe ich Vorschläge?"
            a="In der Regel direkt nach Eingabe Ihrer Daten. Der Umfang hängt vom Produkt und den Angaben ab."
          />
          <FAQItem
            q="Welche Unterlagen brauche ich?"
            a="Typisch sind Identitäts- und Einkommensnachweise; bei Baufinanzierungen kommen Objekt-/Projektunterlagen hinzu. Im Upload-Link erhalten Sie eine klare Liste."
          />
          <FAQItem
            q="Was ist der Unterschied zwischen Baufinanzierung und Privatkredit?"
            a="Baufinanzierung ist objektbezogen (Kauf/Neubau/Anschluss) und oft objektabhängig. Privatkredit ist ein klassischer Ratenkredit für Konsum/Liquidität und wird primär bonitätsbezogen bewertet."
          />
          <FAQItem
            q="Ist der Vergleich kostenlos?"
            a="Der Vergleich dient der Orientierung. Sie sehen klar die nächsten Schritte: Vorschläge → Auswahl → Upload/Live-Prüfung."
          />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/70 p-7 shadow-sm backdrop-blur sm:p-10">
        <div
          className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full opacity-[0.14]"
          style={{ background: `radial-gradient(circle, ${ACCENT} 0%, transparent 60%)` }}
        />

        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold text-slate-500">READY</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Starten Sie jetzt –
              <span className="block" style={{ color: ACCENT }}>
                Vorschläge sehen, Angebot wählen, Upload-Link erhalten.
              </span>
            </h3>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              Wenn Sie bei den Vorschlägen sofort Klarheit möchten, ist Live-Beratung optional verfügbar.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <MiniStat label="Vorschläge" />
              <MiniStat label="Auswahl" />
              <MiniStat label="Upload-Link" />
              <MiniStat label="Live optional" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-sm">
            <div className="grid gap-3">
              <Link
                href="/baufinanzierung"
                className="group inline-flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 whitespace-nowrap"
                style={{ backgroundColor: ACCENT }}
              >
                Baufinanzierung vergleichen
                <IconArrow className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>

              <Link
                href="/privatkredit"
                className="group inline-flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md whitespace-nowrap"
              >
                Privatkredit vergleichen
                <IconArrow className="h-4 w-4 transition group-hover:translate-x-0.5" style={{ color: ACCENT }} />
              </Link>

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                <div className="text-xs font-semibold" style={{ color: ACCENT }}>
                  Kurz gesagt
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Vergleich starten → Vorschläge ansehen → Angebot auswählen → Upload-Link.
                  Live optional direkt im Ergebnis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
