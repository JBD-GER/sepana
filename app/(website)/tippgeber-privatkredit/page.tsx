import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Tippgeber Privatkredit | Partnerprogramm | SEPANA",
  description:
    "Tippgeber für Privatkredit: Empfehlungen digital einreichen, Status transparent verfolgen und Provisionen über das SEPANA Tippgeber-Dashboard verwalten.",
  alternates: { canonical: "/tippgeber-privatkredit" },
}

const BENEFITS = [
  {
    title: "Digitales Tippgeber-Dashboard",
    text: "Empfehlungen für Privatkredit direkt online einreichen, Status verfolgen und Provisionen transparent einsehen.",
  },
  {
    title: "Schnelle Übergabe an Berater",
    text: "SEPANA übernimmt den Fall nach Zuweisung, kontaktiert den Kunden und begleitet die Anfrage strukturiert weiter.",
  },
  {
    title: "Klare Provisionslogik",
    text: "Nur bei Bankzusage wird die Provision automatisch vorgemerkt und im Dashboard sichtbar gemacht.",
  },
  {
    title: "Saubere Dokumentation",
    text: "Empfehlung, Status, Gutschrift und Auszahlungsfreigabe laufen sauber über das System.",
  },
]

const FLOW = [
  {
    title: "1. Einladung durch SEPANA",
    text: "Wir legen Ihr Tippgeber-Profil an und senden Ihnen eine Einladung zum System.",
  },
  {
    title: "2. Zugang aktivieren",
    text: "Sie vergeben ein Passwort und landen direkt im Tippgeber-Dashboard.",
  },
  {
    title: "3. Privatkredit-Tipp einreichen",
    text: "Sie erfassen die Kontaktdaten des Kunden sowie Anlass, Finanzierungswunsch und wichtige Eckdaten.",
  },
  {
    title: "4. SEPANA übernimmt",
    text: "Wir weisen den Tipp einem Berater zu, kontaktieren den Kunden und prüfen die passende Kreditstrecke.",
  },
  {
    title: "5. Status & Provision",
    text: "Bearbeitungsstand und Provisionsstatus bleiben im Dashboard sichtbar. Wichtige Updates kommen zusätzlich per E-Mail.",
  },
  {
    title: "6. Gutschrift & Auszahlung",
    text: "Nach interner Freigabe wird die Gutschrift bereitgestellt und die Auszahlung als bezahlt markiert.",
  },
]

const USE_CASES = [
  "PV-Anlagen und Wärmepumpen",
  "Küchenstudios",
  "Autohäuser",
  "Fotografen",
  "Medizinische Anbieter",
  "Hochzeitsplaner",
]

const DASHBOARD_ITEMS = [
  "Übersicht aller eingereichten Tipps",
  "Status pro Empfehlung",
  "Offene Provision (YTD)",
  "Ausgezahlte Provision (YTD)",
  "Direktes Formular für neue Privatkredit-Tipps",
  "Gutschriften und relevante Downloads",
]

const FAQS = [
  {
    q: "Wie werde ich Tippgeber für Privatkredit bei SEPANA?",
    a: "Das Tippgeber-Konto wird durch SEPANA erstellt und per Einladung freigeschaltet. Nach Annahme der Einladung vergeben Sie Ihr Passwort selbst.",
  },
  {
    q: "Welche Empfehlungen passen zu diesem Modell?",
    a: "Typisch sind Privatkredit-Fälle mit klarem Finanzierungsbedarf, zum Beispiel für PV-Anlagen, Wärmepumpen, Küchen, Fahrzeuge, medizinische Leistungen oder Hochzeitsplaner.",
  },
  {
    q: "Wie sehe ich meine Provisionen?",
    a: "Im Tippgeber-Dashboard sehen Sie Ihre Tipps, offene und ausgezahlte Provisionen sowie vorhandene Gutschriften.",
  },
  {
    q: "Wann erfolgt eine Auszahlung?",
    a: "Nur bei Bankzusage wird die Provision als offen vorgemerkt. Die Auszahlung erfolgt nach interner Freigabe und wird anschließend im Dashboard als bezahlt markiert.",
  },
]

type TippgeberTeamMember = {
  name: string
  role: string
  email: string
  imageSrc: string
  imageAlt: string
  focus: string
}

const PARTNER_CONTACT = {
  name: "Hr. Pfad",
  role: "Ansprechpartner Tippgeber-Partnerschaften",
  email: "c.pfad@sepana.de",
  phone: "05035 3169996",
  response: "Rückmeldung i. d. R. innerhalb von 48 Stunden",
  imageSrc: "/pfad.png",
  imageAlt: "Herr Pfad",
}

const TEAM_MEMBERS: TippgeberTeamMember[] = [
  {
    name: "Hr. Pfad",
    role: "Kreditexperte",
    email: "c.pfad@sepana.de",
    imageSrc: "/pfad.png",
    imageAlt: "Herr Pfad",
    focus: "Partnerbetreuung, Fallstruktur und Übergabe in die passende Privatkredit-Strecke.",
  },
  {
    name: "Hr. Wagner",
    role: "Kreditexperte",
    email: "m.wagner@sepana.de",
    imageSrc: "/wagner.png",
    imageAlt: "Herr Wagner",
    focus: "Privatkredit, Finanzierungszwecke mit Produktbezug und saubere Angebotsvorbereitung.",
  },
  {
    name: "Fr. Müller",
    role: "Kreditexpertin",
    email: "s.müller@sepana.de",
    imageSrc: "/mueller.png",
    imageAlt: "Frau Müller",
    focus: "Rückfragen, Statuskommunikation und strukturierte Prozessbegleitung.",
  },
]

function SectionHeadline({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string
  title: string
  text?: string
}) {
  return (
    <div className="mb-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {text ? <p className="mt-2 max-w-3xl text-sm text-slate-600">{text}</p> : null}
    </div>
  )
}

export default function TippgeberPrivatkreditPage() {
  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_18%,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_88%_8%,rgba(34,211,238,0.18),transparent_38%),linear-gradient(135deg,#0f172a_0%,#10243d_48%,#0f3b46_100%)] p-6 text-white shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:p-10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100/95">
                Partnerprogramm
              </span>
              <span className="inline-flex items-center rounded-full border border-emerald-200/30 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Tippgeber Privatkredit
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Privatkredit-Tipps digital einreichen. Transparente Provisionen im Dashboard.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              SEPANA bietet ein strukturiertes Tippgeber-System für Privatkredit: Einladung, Dashboard-Zugang,
              Tipp-Erfassung, Status-Updates und Provisionsübersicht in einem klaren Prozess.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-200">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">PV & Wärmepumpen</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Küchen & Fahrzeuge</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Provision & Gutschrift im Portal</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="mailto:info@sepana.de?subject=Tippgeber%20Privatkredit%20anfragen"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Tippgeber-Zugang anfragen
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Bereits eingeladen? Zum Login
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Provisionsmodell (aktuell)</div>
            <div className="mt-2 text-xl font-semibold">Klare Regeln statt Blackbox</div>
            <p className="mt-2 text-sm text-slate-200/90">
              Provisionen werden nur bei Bankzusage im System vorgemerkt und bis zur Auszahlungsfreigabe transparent angezeigt.
            </p>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-300">Schnelle Kontaktaufnahme</div>
                <div className="mt-1 text-lg font-semibold text-white">Innerhalb von 48 Stunden</div>
                <div className="mt-1 text-xs text-slate-200/80">Wir garantieren eine schnelle Kontaktaufnahme innerhalb von 48 Stunden nach Tipp-Eingabe.</div>
              </div>
              <div className="rounded-2xl border border-emerald-200/30 bg-emerald-300/10 p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-emerald-100">Bankstatus angenommen</div>
                <div className="mt-1 text-lg font-semibold text-white">25 % der SEPANA-Provision inkl. MwSt.</div>
                <div className="mt-1 text-xs text-slate-200/85">
                  Basis ist die intern erfasste SEPANA-Provision (inkl. MwSt.) nach Bankannahme. Freigabe und Auszahlung über den Admin-Prozess.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-slate-200/90">
              Hinweis: Auszahlungen erfolgen nach interner Freigabe und ueblicherweise nach Eingang der SEPANA-Provision.
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_18%_14%,rgba(34,211,238,0.12),transparent_42%),radial-gradient(circle_at_88%_12%,rgba(59,130,246,0.10),transparent_34%),linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#0f3a80_100%)] p-5 text-white shadow-[0_18px_50px_rgba(2,6,23,0.28)] sm:p-7">
        <div className="pointer-events-none absolute -left-16 -top-12 h-48 w-48 rounded-full bg-cyan-300/16 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-blue-300/16 blur-3xl" />

        <div className="relative grid gap-4 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
          <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/90">Ansprechpartner</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Direkter Kontakt für neue Tippgeber</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
              Wir klären Setup, Ablauf und Freischaltung persönlich mit Ihnen und begleiten den Start ins Dashboard.
            </p>

            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                  <Image src={PARTNER_CONTACT.imageSrc} alt={PARTNER_CONTACT.imageAlt} fill className="object-cover object-top" sizes="64px" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-white">{PARTNER_CONTACT.name}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">{PARTNER_CONTACT.role}</div>
                  <a
                    href={`mailto:${PARTNER_CONTACT.email}`}
                    className="mt-1 block truncate text-sm text-white/95 underline decoration-white/25 underline-offset-4 hover:decoration-white/60"
                  >
                    {PARTNER_CONTACT.email}
                  </a>
                  <a href={`tel:${PARTNER_CONTACT.phone.replace(/\s+/g, "")}`} className="text-sm text-slate-200/95">
                    {PARTNER_CONTACT.phone}
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Rückmeldung</div>
                <div className="mt-1 text-sm font-semibold text-white">{PARTNER_CONTACT.response}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Fokus</div>
                <div className="mt-1 text-sm font-semibold text-white">Privatkredit-Partner und strukturierte Fallübergabe</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="mailto:c.pfad@sepana.de?subject=Tippgeber%20Privatkredit%20Partnerschaft%20anfragen"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Ansprechpartner kontaktieren
              </a>
              <a
                href="mailto:info@sepana.de?subject=Tippgeber%20Privatkredit%20anfragen"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Zugang anfragen
              </a>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/90">Team</div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">Das SEPANA-Team hinter Ihren Tipps</h3>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                Privatkredit & Betreuung
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {TEAM_MEMBERS.map((member) => (
                <article key={member.email} className="overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                  <div className="relative h-36 bg-slate-900/40">
                    <Image
                      src={member.imageSrc}
                      alt={member.imageAlt}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 1280px) 50vw, 20vw"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/5 to-transparent" />
                  </div>
                  <div className="p-3.5">
                    <div className="text-sm font-semibold text-white">{member.name}</div>
                    <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">{member.role}</div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-200/90">{member.focus}</p>
                    <a
                      href={`mailto:${member.email}`}
                      className="mt-2 block truncate text-xs font-semibold text-white underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
                    >
                      {member.email}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BENEFITS.map((item) => (
          <article key={item.title} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeadline
          eyebrow="Anwendungsbereiche"
          title="Typische Privatkredit-Fälle für Tippgeber"
          text="Das Modell ist für Partner gedacht, die regelmäßig Kunden mit klarem Finanzierungsbedarf an SEPANA weitergeben."
        />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-700">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeadline
          eyebrow="Ablauf"
          title="So funktioniert das Tippgeber-System für Privatkredit"
          text="Von der Einladung bis zur Auszahlung läuft alles nachvollziehbar über feste Prozessschritte."
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {FLOW.map((step) => (
            <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-base font-semibold text-slate-900">{step.title}</div>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeadline
          eyebrow="Dashboard"
          title="Was Tippgeber im Portal sehen"
          text="Das Portal ist auf Übersicht, schnelle Erfassung und transparente Provisionsdarstellung ausgelegt."
        />
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
          <div className="text-sm font-semibold text-slate-900">Im Dashboard-Ueberblick</div>
          <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {DASHBOARD_ITEMS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeadline eyebrow="FAQ" title="Häufige Fragen zum Tippgeber-Modell" />
        <div className="grid gap-3">
          {FAQS.map((item) => (
            <div key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-sm font-semibold text-slate-900">{item.q}</div>
              <p className="mt-2 text-sm text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-gradient-to-br from-white via-emerald-50/70 to-cyan-50/80 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Anfrage</div>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Tippgeber-Zugang für Privatkredit anfragen</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Sie moechten Privatkredit-Empfehlungen digital einreichen und transparent abrechnen? Dann fordern Sie eine Einladung an.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:info@sepana.de?subject=Tippgeber%20Privatkredit%20anfragen"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Einladung anfragen
            </a>
            <Link
              href="/privatkredit"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Zum Privatkredit
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}


