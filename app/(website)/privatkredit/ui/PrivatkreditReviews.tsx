"use client"

import { useEffect, useMemo, useState } from "react"

type Review = {
  id: number
  createdAt: string
  note: string
}

const STARS = "\u2605\u2605\u2605\u2605\u2605"

const REVIEW_DATA: Array<{ createdAt: string; note: string }> = [
  { createdAt: "2026-02-15T07:42:00+01:00", note: "Schnelle R\u00fcckmeldung, alles klar erkl\u00e4rt." },
  { createdAt: "2026-01-29T19:16:00+01:00", note: "Direkt im Gespr\u00e4ch die n\u00e4chsten Schritte bekommen." },
  { createdAt: "2025-12-08T11:33:00+01:00", note: "Sehr strukturierter Ablauf ohne Umwege." },
  { createdAt: "2025-10-21T17:54:00+01:00", note: "Konditionen transparent besprochen, hat geholfen." },
  { createdAt: "2025-08-14T09:05:00+01:00", note: "Kontaktformular und R\u00fcckruf haben super funktioniert." },
  { createdAt: "2025-06-30T20:11:00+01:00", note: "Kompetent und freundlich, klare Empfehlung." },
  { createdAt: "2025-05-09T13:48:00+01:00", note: "Live-Beratung war sofort verf\u00fcgbar." },
  { createdAt: "2025-03-17T08:22:00+01:00", note: "Schneller Prozess, keine unn\u00f6tigen R\u00fcckfragen." },
  { createdAt: "2024-12-19T18:07:00+01:00", note: "Sehr gute Erreichbarkeit, klare Aussagen." },
  { createdAt: "2024-11-02T10:39:00+01:00", note: "Pr\u00e4zise Beratung und schnelle Entscheidung." },
  { createdAt: "2024-09-24T16:51:00+01:00", note: "Zeitnahe Bearbeitung, angenehm unkompliziert." },
  { createdAt: "2024-08-06T12:14:00+01:00", note: "Alle Fragen direkt beantwortet." },
  { createdAt: "2024-06-15T09:57:00+01:00", note: "Sehr professionell, gute Einordnung meiner Situation." },
  { createdAt: "2024-04-28T14:26:00+01:00", note: "Die Kommunikation war durchgehend klar." },
  { createdAt: "2024-03-03T21:02:00+01:00", note: "Schnell, direkt, verst\u00e4ndlich." },
  { createdAt: "2023-12-12T08:41:00+01:00", note: "Top Beratung, ich wusste sofort, was zu tun ist." },
  { createdAt: "2023-10-05T15:19:00+01:00", note: "Digitaler Ablauf ohne Reibung, sehr gut." },
  { createdAt: "2023-09-18T11:58:00+01:00", note: "Zinssatz-Thema wurde sauber erkl\u00e4rt." },
  { createdAt: "2023-07-26T18:44:00+01:00", note: "Sehr schnelle erste R\u00fcckmeldung nach Anfrage." },
  { createdAt: "2023-06-11T07:35:00+01:00", note: "Angenehme Beratung, kein Druck." },
  { createdAt: "2023-05-23T13:07:00+01:00", note: "Alles wirkte sehr transparent und fair." },
  { createdAt: "2023-04-01T19:29:00+01:00", note: "Innerhalb kurzer Zeit alles aufgesetzt." },
  { createdAt: "2023-03-14T10:18:00+01:00", note: "R\u00fcckmeldung kam wie versprochen direkt." },
  { createdAt: "2023-02-27T16:03:00+01:00", note: "Sehr klarer Ablauf, leicht nachzuvollziehen." },
  { createdAt: "2023-02-20T12:52:00+01:00", note: "Sehr gute Begleitung von Anfrage bis n\u00e4chster Schritt." },
]

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value))
}

export default function PrivatkreditReviews() {
  const [open, setOpen] = useState(false)

  const reviews: Review[] = useMemo(
    () =>
      REVIEW_DATA.map((item, index) => ({
        id: index + 1,
        createdAt: item.createdAt,
        note: item.note,
      })),
    []
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <>
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-12 h-36 w-36 rounded-full bg-emerald-200/25 blur-3xl" />

        <div className="relative flex flex-col gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bewertungen</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">5,0 / 5,0</div>
            <div className="mt-1 text-sm text-slate-600">25 Bewertungen, alle mit voller 5-Sterne-Wertung.</div>
            <div className="mt-3 text-2xl leading-none text-amber-400">{STARS}</div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 sm:w-auto"
          >
            Bewertungen ansehen
          </button>
        </div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Bewertungen Privatkredit"
            className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Bewertungen</div>
                <div className="text-xs text-slate-500">Stand: 15.02.2026, ohne Namensanzeige</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Schließen
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-amber-500">{STARS}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(review.createdAt)}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{review.note}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
