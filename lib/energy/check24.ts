export const CHECK24_PARTNER_ID = "1164717"
export const CHECK24_TRACKING_ID = "sepana_strom_funnel"
export const CHECK24_ORIGIN = "https://koop.energie.check24.de"
export const CHECK24_REFERRER = "https://www.sepana.de/stromvergleich"
export const CHECK24_WIDGET_SCRIPT = "https://files.check24.net/widgets/auto/1164717/sepana-strom-rechner/power-iframe.js"

export type PowerComparison = { zipcode: string; consumption: number; eco: boolean }

export function isValidPowerComparison(value: PowerComparison) {
  return /^\d{5}$/.test(value.zipcode) && Number.isInteger(value.consumption) && value.consumption >= 500 && value.consumption <= 100000
}

// These parameters and the conversion message are supplied by the generated
// CHECK24 widget. A direct iframe avoids its unconditional GCLID localStorage write.
export function isLivePowerHost(hostname: string) {
  return hostname === "www.sepana.de" || hostname === "sepana.de"
}

export function buildPowerComparisonUrl(value: PowerComparison, mobile: boolean, gclid?: string, testMode = false) {
  if (!isValidPowerComparison(value)) throw new Error("Invalid power comparison")
  const baseTrackingId = testMode ? `${CHECK24_TRACKING_ID}_test` : CHECK24_TRACKING_ID
  const trackingId = !testMode && gclid && /^[A-Za-z0-9_-]{1,250}$/.test(gclid)
    ? `${baseTrackingId}_GCLID:${gclid}` : baseTrackingId
  const url = new URL(`/${CHECK24_PARTNER_ID}/default/strom/`, CHECK24_ORIGIN)
  url.search = new URLSearchParams({
    tracking_id: trackingId, tracking_id2: "264", ref: CHECK24_REFERRER, zipcode: value.zipcode,
    totalconsumption: String(value.consumption), calculate: "yes",
    deviceoutput: mobile ? "mobile" : "desktop", considerdeposit: "no",
    considerdiscounts: "yes", paymentperiod: "month", priceguarantee: "yes",
    guidelinematch: "yes", packages: "no", eco: value.eco ? "yes" : "no", mode: "normal",
  }).toString()
  return url.toString()
}

export function isTrustedCheck24Message(event: Pick<MessageEvent, "origin" | "source">, frameWindow: Window | null) {
  return frameWindow !== null && event.source === frameWindow && event.origin === CHECK24_ORIGIN
}

export function buildPowerTrackingPixelUrl(comparisonUrl: string) {
  const comparison = new URL(comparisonUrl)
  if (comparison.origin !== CHECK24_ORIGIN || comparison.pathname !== `/${CHECK24_PARTNER_ID}/default/strom/`) {
    throw new Error("Invalid comparison origin")
  }
  const url = new URL("https://a.check24.net/misc/click.php")
  url.search = new URLSearchParams({
    pixel: "yes", cid: comparison.searchParams.get("eco") === "yes" ? "5" : "1",
    pid: CHECK24_PARTNER_ID, aid: "264", tid: comparison.searchParams.get("tracking_id") || CHECK24_TRACKING_ID,
  }).toString()
  return url.toString()
}
