import { hasMarketingConsent } from "./consent"

// Created in the user's SEPANA account (ocid 7998331857), not CHECK24 AFF.
export const ENERGY_GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_ENERGY_GOOGLE_ADS_ID || "AW-17928656455"
export const ENERGY_CONVERSION_SEND_TO = process.env.NEXT_PUBLIC_ENERGY_CONVERSION_SEND_TO || "AW-17928656455/ceDECKums5MdEMeshuVC"

export function trackEnergyEvent(name: "strom_vergleich_start" | "strom_antrag_abgeschlossen", transactionId?: string) {
  if (!hasMarketingConsent()) return false
  const win = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
  win.dataLayer ??= []
  win.gtag ??= function (...args) { win.dataLayer!.push(args) }
  win.gtag("event", name, { event_category: "stromvergleich", partner: "check24", send_to: ENERGY_GOOGLE_ADS_ID })
  if (name === "strom_antrag_abgeschlossen" && /^AW-\d+\/[A-Za-z0-9_-]+$/.test(ENERGY_CONVERSION_SEND_TO)) {
    win.gtag("event", "conversion", { send_to: ENERGY_CONVERSION_SEND_TO, transaction_id: transactionId })
  }
  return true
}
