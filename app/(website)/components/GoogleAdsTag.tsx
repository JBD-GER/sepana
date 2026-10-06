"use client"

import Script from "next/script"
import { useSyncExternalStore } from "react"
import { applyStoredConsentUpdate, hasMarketingConsent, subscribeMarketingConsent } from "@/lib/ads/consent"

export default function GoogleAdsTag({ id }: { id: string }) {
  const granted = useSyncExternalStore(subscribeMarketingConsent, hasMarketingConsent, () => false)
  if (!granted || !/^AW-\d+$/.test(id)) return null
  return <Script id={`google-tag-${id}`} src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" onReady={() => {
    // Apply the persisted choice before config, including when the script is cached.
    applyStoredConsentUpdate()
    if (!hasMarketingConsent()) return
    const win = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
    win.dataLayer ??= []
    win.gtag ??= function (...args) { win.dataLayer!.push(args) }
    win.gtag("js", new Date())
    win.gtag("config", id, { send_page_view: true })
  }} />
}
