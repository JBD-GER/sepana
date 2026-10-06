"use client"

import Script from "next/script"
import { useSyncExternalStore } from "react"
import { hasMarketingConsent, subscribeMarketingConsent } from "@/lib/ads/consent"

export default function GoogleAdsTag({ id }: { id: string }) {
  const granted = useSyncExternalStore(subscribeMarketingConsent, hasMarketingConsent, () => false)
  if (!granted || !/^AW-\d+$/.test(id)) return null
  return <Script id={`google-tag-${id}`} src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" onReady={() => {
    if (!hasMarketingConsent()) return
    const win = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
    win.dataLayer ??= []
    win.gtag ??= function (...args) { win.dataLayer!.push(args) }
    win.gtag("js", new Date())
    win.gtag("config", id, { send_page_view: true })
  }} />
}
