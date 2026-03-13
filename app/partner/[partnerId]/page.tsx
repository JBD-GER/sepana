import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import FunnelTemplate from "@/app/(website)/funnel-vorlage/ui/FunnelTemplate"
import { getPublishedWebsiteReviews } from "@/lib/websiteReviews"
import { getActiveTippgeberProfileByUserId } from "@/lib/tippgeber/service"
import PartnerLegalFooter from "./PartnerLegalFooter"

const CONTACT_EMAIL = "info@sepana.de"
const CONTACT_PHONE = "05035 3169996"

const TEAM_MEMBERS = [
  {
    name: "Herr Pfad",
    imageSrc: "/pfad.png",
  },
  {
    name: "Herr Wagner",
    imageSrc: "/wagner.png",
  },
  {
    name: "Frau Müller",
    imageSrc: "/mueller.png",
  },
] as const

const BENEFITS = [
  {
    title: "Schnell gestartet",
    text: "Ihre Anfrage ist in wenigen Schritten erfasst und direkt bei SEPANA.",
  },
  {
    title: "Klar geführt",
    text: "Das Formular ist bewusst schlank aufgebaut und leicht auf dem Handy auszufüllen.",
  },
  {
    title: "Persönlich begleitet",
    text: "Nach dem Start begleiten wir Sie strukturiert und erreichbar durch die nächsten Schritte.",
  },
] as const

const FAQ_ITEMS = [
  {
    question: "Wie lange dauert die Anfrage?",
    answer:
      "Der Einstieg dauert nur wenige Minuten. Danach meldet sich SEPANA zeitnah mit einer ersten Einordnung und den nächsten Schritten.",
  },
  {
    question: "Ist die Anfrage für mich unverbindlich?",
    answer:
      "Ja. Mit der Anfrage starten Sie zunächst die Prüfung Ihres Vorhabens. Erst danach besprechen wir gemeinsam, welche Optionen sinnvoll sind.",
  },
  {
    question: "Kann ich die Anfrage auch mobil ausfüllen?",
    answer:
      "Ja. Die Strecke ist bewusst so aufgebaut, dass sie auf dem Smartphone genauso einfach funktioniert wie am Desktop.",
  },
  {
    question: "Was passiert nach dem Absenden?",
    answer:
      "Ihre Angaben werden geprüft und Sie erhalten eine Rückmeldung von SEPANA. Anschließend begleiten wir Sie strukturiert durch die weitere Finanzierung.",
  },
] as const

function partnerLogoUrl(path: string | null | undefined) {
  const clean = String(path ?? "").trim()
  if (!clean) return null
  return `/api/baufi/logo?bucket=tipgeber_logos&width=256&height=256&resize=contain&path=${encodeURIComponent(clean)}`
}

function partnerInitials(name: string | null | undefined) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "P"
  )
}

async function loadPartnerProfile(partnerId: string) {
  return getActiveTippgeberProfileByUserId(partnerId)
}

function StarRow({ className = "" }: { className?: string }) {
  return <div className={`text-base leading-none tracking-[0.18em] text-cyan-400 ${className}`}>★★★★★</div>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerId: string }>
}): Promise<Metadata> {
  const { partnerId } = await params
  const partner = await loadPartnerProfile(partnerId)

  return {
    title: partner ? `Kreditanfrage | ${partner.company_name} x SEPANA` : "Kreditanfrage | SEPANA",
    description: partner
      ? `Digitale Kreditanfrage von ${partner.company_name} in Kooperation mit SEPANA.`
      : "Digitale Kreditanfrage in Kooperation mit SEPANA.",
    robots: {
      index: false,
      follow: false,
    },
  }
}

function PartnerBadge({
  partnerName,
  partnerLogoPath,
}: {
  partnerName: string
  partnerLogoPath: string | null
}) {
  const logoUrl = partnerLogoUrl(partnerLogoPath)

  return (
    <div className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 shadow-sm">
          {logoUrl ? (
            <img src={logoUrl} alt={`${partnerName} Logo`} className="h-full w-full object-contain p-2.5" />
          ) : (
            <span className="text-lg font-semibold text-slate-700">{partnerInitials(partnerName)}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Empfohlen von</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{partnerName}</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Sie starten Ihre Anfrage direkt über diese Partnerseite und werden anschließend von SEPANA begleitet.
          </p>
        </div>
      </div>
    </div>
  )
}

function FaqSection() {
  return (
    <section className="rounded-[32px] border border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="max-w-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Häufige Fragen</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Fragen zur Kreditanfrage</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Die wichtigsten Punkte vor dem Start kurz und klar beantwortet.
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {FAQ_ITEMS.map((item) => (
          <article key={item.question} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">{item.question}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default async function PartnerLeadLandingPage({
  params,
}: {
  params: Promise<{ partnerId: string }>
}) {
  const { partnerId } = await params
  const partner = await loadPartnerProfile(partnerId)

  const reviews = await getPublishedWebsiteReviews()

  const featuredReviews = reviews.slice(0, 3)
  const partnerName = partner?.company_name?.trim() || "SEPANA Partner"
  const partnerLogoPath = partner?.logo_path ?? null
  const resolvedPartnerId = partner?.user_id ?? null
  const isResolvedPartner = Boolean(partner)
  const processSteps = isResolvedPartner
    ? [
        `Sie starten Ihre Anfrage direkt über ${partnerName}.`,
        "SEPANA prüft Ihre Angaben und meldet sich zeitnah bei Ihnen.",
        "Gemeinsam besprechen wir die passende Richtung für Ihre Finanzierung.",
        "Danach begleiten wir Sie strukturiert durch die nächsten Schritte.",
      ]
    : [
        "Sie starten Ihre Anfrage direkt bei SEPANA.",
        "Wir prüfen Ihre Angaben und melden uns zeitnah bei Ihnen.",
        "Gemeinsam besprechen wir passende Optionen für Ihr Vorhaben.",
        "Danach begleiten wir Sie strukturiert durch die nächsten Schritte.",
      ]

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 pb-10 sm:space-y-10">
      <FunnelTemplate
        variant="kreditanfrage"
        eyebrow={isResolvedPartner ? `Kreditanfrage mit ${partnerName}` : "Digitale Kreditanfrage"}
        heading="Finanzierung digital starten"
        description={
          isResolvedPartner
            ? `Starten Sie Ihre Anfrage direkt über ${partnerName}. In wenigen Schritten zur passenden Finanzierung, persönlich begleitet von SEPANA.`
            : "In wenigen Schritten zur passenden Finanzierung, persönlich begleitet von SEPANA."
        }
        heroImageSrc="/familie_kueche.jpg"
        heroImageAlt="Familie bei der Finanzierungsplanung"
        partnerId={resolvedPartnerId}
        partnerName={isResolvedPartner ? partnerName : null}
        partnerLogoPath={isResolvedPartner ? partnerLogoPath : null}
      />

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_18%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_88%_14%,rgba(16,185,129,0.14),transparent_28%),linear-gradient(135deg,#07162f_0%,#0b2143_56%,#123a57_100%)] p-6 text-white shadow-[0_28px_80px_rgba(2,6,23,0.24)] sm:p-8">
          <div className="pointer-events-none absolute -left-20 top-0 h-48 w-48 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-emerald-300/15 blur-3xl" />

          <div className="relative">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              {isResolvedPartner ? `Empfohlen von ${partnerName}` : "SEPANA Finanzierung"}
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">
              Digital anfragen. Persönlich beraten.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200 sm:text-base">
              Die erste Strecke bleibt bewusst einfach: Daten eingeben, absenden und anschließend mit SEPANA sauber weitergeführt werden.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-[26px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
              <div>
                <div className="flex items-end gap-2">
                  <div className="text-3xl font-semibold leading-none">4,9</div>
                  <div className="pb-0.5 text-sm text-slate-300">/ 5,0</div>
                </div>
                <StarRow className="mt-2 text-lg text-cyan-300" />
                <div className="mt-2 text-sm text-slate-200">100+ Bewertungen</div>
              </div>
              <div className="h-12 w-px bg-white/12" />
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {TEAM_MEMBERS.map((member) => (
                    <div
                      key={member.name}
                      className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-white/80 bg-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.28)]"
                    >
                      <Image src={member.imageSrc} alt={member.name} fill className="object-cover object-top" sizes="56px" />
                    </div>
                  ))}
                </div>
                <div className="text-sm text-slate-100">
                  <div className="font-semibold text-white">Ihre Ansprechpartner</div>
                  <div className="mt-0.5 text-slate-200">Persönlich erreichbar und klar in der Begleitung.</div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {BENEFITS.map((item) => (
                <article key={item.title} className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <PartnerBadge partnerName={partnerName} partnerLogoPath={partnerLogoPath} />

          <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="relative h-[320px]">
              <Image
                src="/familie_haus.jpg"
                alt="SEPANA begleitet Kreditanfragen"
                fill
                className="object-cover"
                sizes="(max-width: 1280px) 100vw, 34vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/78 via-slate-900/10 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/15 bg-white/12 p-4 text-white backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Einfacher Einstieg</div>
                <div className="mt-1 text-xl font-semibold">Anfrage senden, Rückmeldung erhalten, sicher weitergehen.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FaqSection />

      <section className="grid gap-5 lg:grid-cols-[1.04fr_0.96fr]">
        <div className="rounded-[32px] border border-slate-200/70 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Kundenstimmen</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Warum Kunden SEPANA vertrauen</h2>
            </div>
            <Link
              href="/bewertungen"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Alle Bewertungen ansehen
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {featuredReviews.map((review) => (
              <article key={review.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <StarRow className="text-sm text-cyan-600" />
                  <div className="text-xs text-slate-500">
                    {review.reviewerInitials} aus {review.reviewerCity}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-[15px]">{review.quote}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[32px] border border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">So geht es weiter</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Der Ablauf nach Ihrer Anfrage</h2>

            <div className="mt-5 space-y-3">
              {processSteps.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0b1f5e] text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="text-sm leading-relaxed text-slate-700">{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-900 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.16)] sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Kontakt</div>
            <div className="mt-2 text-2xl font-semibold">Jederzeit direkt erreichbar</div>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              Wenn Sie vorab Fragen haben, erreichen Sie uns direkt per E-Mail oder Telefon.
            </p>
            <div className="mt-5 space-y-2 text-sm text-slate-200">
              <div>
                E-Mail:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-white underline underline-offset-4">
                  {CONTACT_EMAIL}
                </a>
              </div>
              <div>
                Telefon:{" "}
                <a href={`tel:${CONTACT_PHONE.replace(/\s+/g, "")}`} className="font-semibold text-white underline underline-offset-4">
                  {CONTACT_PHONE}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PartnerLegalFooter />
    </div>
  )
}
