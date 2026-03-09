import Image from "next/image"
import Link from "next/link"
import TeamLiveCta from "./TeamLiveCta"

export const BRAND_SLOGAN = "Ihr Finanzpartner für klare Kreditentscheidungen."
export const BRAND_SUBLINE =
  "SEPANA begleitet Baufinanzierung und Privatkredit persönlich, strukturiert und digital - von der Anfrage bis zur Umsetzung."

type TeamMember = {
  name: string
  role: string
  focus: string
  email: string
  imageSrc: string
  imageAlt: string
  accent: string
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Hr. Pfad",
    role: "Kreditexperte",
    focus: "Strategie, Fallstrukturierung und persönliche Begleitung",
    email: "c.pfad@sepana.de",
    imageSrc: "/pfad.png",
    imageAlt: "Herr Pfad",
    accent: "from-cyan-400/25 to-blue-500/15",
  },
  {
    name: "Hr. Wagner",
    role: "Kreditexperte",
    focus: "Baufinanzierung, Anschlussfinanzierung und Objektstrategie",
    email: "m.wagner@sepana.de",
    imageSrc: "/wagner.png",
    imageAlt: "Herr Wagner",
    accent: "from-blue-400/25 to-indigo-500/15",
  },
  {
    name: "Fr. Müller",
    role: "Kreditexperte",
    focus: "Privatkredit, Haushaltsplanung und schnelle Rückmeldung",
    email: "s.müller@sepana.de",
    imageSrc: "/mueller.png",
    imageAlt: "Frau Müller",
    accent: "from-emerald-400/25 to-cyan-500/15",
  },
]

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.8 12.3l2.1 2.1 4.5-4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type ValueCard = {
  title: string
  text: string
}

type ValueGridProps = {
  eyebrow?: string
  title: string
  description?: string
  items: ValueCard[]
  className?: string
}

export function ValueGridSection({
  eyebrow = "Vorteile",
  title,
  description,
  items,
  className,
}: ValueGridProps) {
  return (
    <section className={["rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7", className].filter(Boolean).join(" ")}>
      <div className="max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{description}</p> : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-[#0b1f5e]">
              <CheckIcon />
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function TeamSection({
  eyebrow = "Team",
  title = "Ihre Kreditexperten bei SEPANA",
  description = "Keine anonyme Strecke: Unser Team begleitet Ihre Anfrage strukturiert und persönlich bis zur nächsten klaren Entscheidung.",
  className,
  liveCtaLabel,
}: {
  eyebrow?: string
  title?: string
  description?: string
  className?: string
  liveCtaLabel?: string
}) {
  return (
    <section
      className={[
        "relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_18%_12%,rgba(14,165,233,0.14),transparent_40%),radial-gradient(circle_at_92%_14%,rgba(59,130,246,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm sm:p-7",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute -left-12 -top-10 h-36 w-36 rounded-full bg-cyan-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-14 -bottom-12 h-44 w-44 rounded-full bg-blue-200/25 blur-3xl" />

      <div className="relative">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{description}</p>
        </div>

        {liveCtaLabel ? <TeamLiveCta buttonLabel={liveCtaLabel} /> : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {TEAM_MEMBERS.map((member) => (
            <article
              key={member.name}
              className="group overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/95 shadow-sm ring-1 ring-white/70"
            >
              <div className={`relative h-56 overflow-hidden bg-gradient-to-br ${member.accent}`}>
                <Image
                  src={member.imageSrc}
                  alt={member.imageAlt}
                  fill
                  className="object-cover object-top transition duration-500 group-hover:scale-[1.02]"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-900/5 to-transparent" />
                <div className="absolute left-3 top-3 rounded-full border border-[#0b1f5e]/80 bg-[#0b1f5e] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                  Kreditexperte
                </div>
              </div>

              <div className="p-4">
                <div className="text-base font-semibold text-slate-900">{member.name}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#0b1f5e]">{member.role}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{member.focus}</p>
                <a
                  href={`mailto:${member.email}`}
                  className="mt-3 block text-sm font-medium text-[#0b1f5e] underline decoration-slate-300 underline-offset-4 hover:decoration-[#0b1f5e]"
                >
                  {member.email}
                </a>
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    <CheckIcon />
                  </span>
                  Persönliche Begleitung statt Standardstrecke
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ProductOverviewSection({
  eyebrow = "Kredite",
  title = "Baufinanzierung und Privatkredit aus einer Hand",
  description = "Wir denken nicht in isolierten Formularen, sondern in Ihrer passenden Finanzierungssituation. Die Anfrage startet über eine klare, strukturierte Kreditanfrage.",
}: {
  eyebrow?: string
  title?: string
  description?: string
}) {
  return (
    <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
      <div className="max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{description}</p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-[linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#113a7a_100%)] p-5 text-white shadow-sm">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              Baufinanzierung
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight">Finanzierung für Kauf, Neubau oder Anschluss</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
              Wir strukturieren den Fall mit Ihnen und begleiten die Anfrage bis zur passenden Bankenansprache.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-100/95">
              <li className="flex items-start gap-2"><span className="mt-[3px] text-cyan-200">•</span><span>Objekt- und Haushaltsdaten sauber vorbereitet</span></li>
              <li className="flex items-start gap-2"><span className="mt-[3px] text-cyan-200">•</span><span>Rückfragen reduzieren durch klare Erfassung</span></li>
              <li className="flex items-start gap-2"><span className="mt-[3px] text-cyan-200">•</span><span>Persönliche Begleitung bis zur nächsten Entscheidung</span></li>
            </ul>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/kreditanfrage"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Kreditanfrage starten
                <ArrowIcon />
              </Link>
              <Link
                href="/baufinanzierung"
                className="inline-flex items-center rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Seite ansehen
              </Link>
            </div>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-emerald-200/25 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              Privatkredit
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">Flexibel finanzieren mit klaren Schritten</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Von der ersten Anfrage bis zur Rückmeldung in einem Prozess, der auf Tempo und Transparenz ausgelegt ist.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2"><span className="mt-[3px] text-emerald-500">•</span><span>Klare Einschätzung statt unübersichtlicher Optionen</span></li>
              <li className="flex items-start gap-2"><span className="mt-[3px] text-emerald-500">•</span><span>Schnelle Rückmeldung bei vollständigen Angaben</span></li>
              <li className="flex items-start gap-2"><span className="mt-[3px] text-emerald-500">•</span><span>Persönliche Ansprechpartner im gesamten Ablauf</span></li>
            </ul>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/kreditanfrage"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Kreditanfrage starten
                <ArrowIcon />
              </Link>
              <Link
                href="/privatkredit"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Seite ansehen
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

export function LeadCtaSection({
  title = "Bereit für den nächsten Schritt?",
  text = "Starten Sie jetzt Ihre Kreditanfrage. Die Produktauswahl (Baufinanzierung oder Privatkredit) erfolgt direkt in der Antragsstrecke.",
  buttonLabel = "Kreditanfrage starten",
}: {
  title?: string
  text?: string
  buttonLabel?: string
}) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-[linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#0f3b80_100%)] p-6 text-white shadow-[0_20px_60px_rgba(2,6,23,0.28)] sm:p-8">
      <div className="pointer-events-none absolute -left-12 top-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-blue-300/20 blur-3xl" />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/85">Kreditanfrage</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-200/90 sm:text-base">{text}</p>
        </div>

        <Link
          href="/kreditanfrage"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
        >
          {buttonLabel}
          <ArrowIcon />
        </Link>
      </div>
    </section>
  )
}

export function ImageFeatureBlock({
  imageSrc,
  imageAlt,
  eyebrow,
  title,
  text,
  points,
  reversed = false,
}: {
  imageSrc: string
  imageAlt: string
  eyebrow: string
  title: string
  text: string
  points: string[]
  reversed?: boolean
}) {
  return (
    <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-4 shadow-sm sm:p-6">
      <div className={`grid gap-4 lg:grid-cols-2 ${reversed ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-slate-900">
          <div className="relative h-[260px] sm:h-[320px] lg:h-full lg:min-h-[360px]">
            <Image src={imageSrc} alt={imageAlt} fill className="object-cover object-center" sizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />
        </div>

        <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{text}</p>

          <div className="mt-4 space-y-2">
            {points.map((point) => (
              <div key={point} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                <span className="mt-[1px] text-[#0b1f5e]">
                  <CheckIcon />
                </span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
