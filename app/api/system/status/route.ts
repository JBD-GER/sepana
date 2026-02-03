import { NextResponse } from "next/server"

type ServiceState = "operational" | "degraded" | "outage"

type Service = {
  id: string
  name: string
  state: ServiceState
  latencyMs: number
  uptime: string
  note: string
}

export async function GET() {
  const configReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const services: Service[] = [
    {
      id: "web",
      name: "Website & Navigation",
      state: "operational",
      latencyMs: 44,
      uptime: "99.98%",
      note: "Marketingseiten, Login und Landingflows sind erreichbar.",
    },
    {
      id: "baufi",
      name: "Baufinanzierungs-Flow",
      state: "operational",
      latencyMs: 68,
      uptime: "99.95%",
      note: "Wizard, Fallanlage und Angebotsauswahl laufen stabil.",
    },
    {
      id: "live",
      name: "Live-Session",
      state: "operational",
      latencyMs: 72,
      uptime: "99.92%",
      note: "Queue, Wartesaal und Session-Start verfügbar.",
    },
    {
      id: "status",
      name: "Systemkonfiguration",
      state: configReady ? "operational" : "degraded",
      latencyMs: configReady ? 12 : 0,
      uptime: configReady ? "100%" : "n/a",
      note: configReady
        ? "Pflichtumgebungen sind gesetzt."
        : "Mindestens eine Pflicht-Umgebungsvariable fehlt.",
    },
  ]

  const hasOutage = services.some((service) => service.state === "outage")
  const hasDegraded = services.some((service) => service.state === "degraded")

  const platformState: ServiceState = hasOutage ? "outage" : hasDegraded ? "degraded" : "operational"

  const incidents = [
    {
      id: "inc-2026-01-18",
      date: "2026-01-18",
      title: "Erhöhte Antwortzeiten im Berater-Dashboard",
      resolution: "Caching und Queue-Polling wurden optimiert.",
      state: "resolved",
    },
    {
      id: "inc-2025-12-07",
      date: "2025-12-07",
      title: "Kurzzeitige API-Timeouts im Dokumentenupload",
      resolution: "Upload-Worker wurden neu ausgerollt.",
      state: "resolved",
    },
  ]

  return NextResponse.json(
    {
      platformState,
      checkedAt: new Date().toISOString(),
      services,
      incidents,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  )
}
