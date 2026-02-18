"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  GOOGLE_ADS_BAUFINANZIERUNG_LEAD_SEND_TO,
  GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO,
  trackGoogleAdsConversion,
} from "@/lib/ads/googleAds"

const STORAGE_PREFIX = "sepana:ads-conversion:danke"

function normalizeSendTo(value: string | null) {
  const candidate = String(value ?? "").trim()
  if (!candidate) return null
  return /^AW-\d+\/[A-Za-z0-9_-]+$/.test(candidate) ? candidate : null
}

function fallbackSendTo(source: string | null) {
  if (source === "privatkredit") return GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO
  if (source === "baufi") return GOOGLE_ADS_BAUFINANZIERUNG_LEAD_SEND_TO
  return null
}

export default function GoogleAdsDankeConversion() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === "undefined") return

    const source = searchParams.get("source")
    const sendTo = normalizeSendTo(searchParams.get("conversion")) ?? fallbackSendTo(source)
    if (!sendTo) return

    const leadRef =
      searchParams.get("externalLeadId") || searchParams.get("leadId") || searchParams.get("lead") || "no-ref"
    const onceKey = `${STORAGE_PREFIX}:${source || "unknown"}:${sendTo}:${leadRef}`
    if (window.sessionStorage.getItem(onceKey) === "1") return

    const tracked = trackGoogleAdsConversion(sendTo)
    if (tracked) {
      window.sessionStorage.setItem(onceKey, "1")
    }
  }, [searchParams])

  return null
}

