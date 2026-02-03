"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

type ConversionParams = {
  send_to: string
  value: number
  currency: string
}

type GtagEventFn = (command: "event", eventName: "conversion", params: ConversionParams) => void
type AdsWindow = Window & { gtag?: GtagEventFn }

const CONVERSION_ID = "AW-17928656455/etJbCJvh-fEbEMeshuVC"
const STORAGE_PREFIX = "sepana:ads-conversion:auswahl"

export default function GoogleAdsAuswahlConversion() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get("caseId") || "no-case"

  useEffect(() => {
    if (typeof window === "undefined") return
    const adsWindow = window as AdsWindow
    if (typeof adsWindow.gtag !== "function") return

    const onceKey = `${STORAGE_PREFIX}:${caseId}`
    if (window.sessionStorage.getItem(onceKey) === "1") return

    adsWindow.gtag("event", "conversion", {
      send_to: CONVERSION_ID,
      value: 1.0,
      currency: "EUR",
    })

    window.sessionStorage.setItem(onceKey, "1")
  }, [caseId])

  return null
}
