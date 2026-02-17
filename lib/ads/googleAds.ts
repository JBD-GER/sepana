type ConversionParams = {
  send_to: string
  value?: number
  currency?: string
}

type GtagEventFn = (command: "event", eventName: "conversion", params: ConversionParams) => void
type AdsWindow = Window & { gtag?: GtagEventFn }

export const GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO = "AW-17928656455/EYB-CLGemfobEMeshuVC"

export function trackPrivatkreditLeadConversion() {
  if (typeof window === "undefined") return false
  const adsWindow = window as AdsWindow
  if (typeof adsWindow.gtag !== "function") return false

  adsWindow.gtag("event", "conversion", {
    send_to: GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO,
    value: 1.0,
    currency: "EUR",
  })

  return true
}

