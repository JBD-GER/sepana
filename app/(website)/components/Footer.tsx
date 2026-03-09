import Link from "next/link"
import OpenConsentButton from "./OpenConsentButton"
import { BRAND_SLOGAN } from "./marketing/sections"

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200/70 bg-[radial-gradient(circle_at_12%_10%,rgba(34,211,238,0.08),transparent_34%),radial-gradient(circle_at_90%_8%,rgba(59,130,246,0.08),transparent_32%),linear-gradient(180deg,#07162f_0%,#081a38_100%)] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-3">
          <div className="text-sm font-semibold tracking-[0.08em] text-white/95">SEPANA</div>
          <p className="max-w-md text-sm leading-relaxed text-slate-200/90">{BRAND_SLOGAN}</p>
          <p className="max-w-md text-sm leading-relaxed text-slate-300/85">
            Baufinanzierung und Privatkredit mit klarem Einstieg über die Kreditanfrage - persönlich begleitet und modern umgesetzt.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-white/95">Start & Anfrage</div>
          <div className="grid gap-1 text-sm">
            <Link className="text-slate-300/90 transition hover:text-white" href="/">
              Startseite
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/kreditanfrage">
              Kreditanfrage
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/bewertungen">
              Bewertungen
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-white/95">Produkte</div>
          <div className="grid gap-1 text-sm">
            <Link className="text-slate-300/90 transition hover:text-white" href="/baufinanzierung">
              Baufinanzierung
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/baufinanzierung/anschlussfinanzierung">
              Anschlussfinanzierung
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/privatkredit">
              Privatkredit
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/baufinanzierung/auswahl">
              Vergleichsportal Baufinanzierung
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/tippgeber-baufinanzierung">
              Tippgeber Baufinanzierung
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/tippgeber-privatkredit">
              Tippgeber Privatkredit
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-white/95">Recht & Zugang</div>
          <div className="grid gap-1 text-sm">
            <Link className="text-slate-300/90 transition hover:text-white" href="/login">
              Login
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/registrieren">
              Registrieren
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/impressum">
              Impressum
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/datenschutz">
              Datenschutz
            </Link>
            <Link className="text-slate-300/90 transition hover:text-white" href="/agb">
              AGB
            </Link>
            <OpenConsentButton className="text-left text-slate-300/90 transition hover:text-white" />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-slate-300/85 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} SEPANA</span>
          <span>Konditionen sind bonitäts- und objektabhängig. Angaben auf der Website dienen der ersten Orientierung.</span>
        </div>
      </div>
    </footer>
  )
}

