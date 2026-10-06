import assert from "node:assert/strict"
import test from "node:test"
import { buildPowerComparisonUrl, CHECK24_ORIGIN, CHECK24_TRACKING_ID, isTrustedCheck24Message, isValidPowerComparison } from "../lib/energy/check24.ts"
import { hasMarketingConsent } from "../lib/ads/consent.ts"

const values = { zipcode: "01067", consumption: 3500, eco: false }

test("the affiliate comparison preserves leading zeroes and the correct partner attribution", () => {
  const url = new URL(buildPowerComparisonUrl(values, false))
  assert.equal(url.origin, CHECK24_ORIGIN)
  assert.equal(url.pathname, "/1164717/default/strom/")
  assert.equal(url.searchParams.get("zipcode"), "01067")
  assert.equal(url.searchParams.get("tracking_id"), CHECK24_TRACKING_ID)
  assert.equal(url.searchParams.get("totalconsumption"), "3500")
  assert.equal(url.searchParams.get("calculate"), "yes")
})

test("invalid location and consumption never create a partner request", () => {
  for (const invalid of [{ ...values, zipcode: "123" }, { ...values, consumption: 0 }, { ...values, consumption: Infinity }, { ...values, consumption: 3.5 }, { ...values, consumption: 100001 }]) {
    assert.equal(isValidPowerComparison(invalid), false)
    assert.throws(() => buildPowerComparisonUrl(invalid, false))
  }
})

test("mobile and eco choices reach CHECK24; invalid click IDs are omitted", () => {
  const mobile = new URL(buildPowerComparisonUrl({ ...values, eco: true }, true, "valid-click_123"))
  assert.equal(mobile.searchParams.get("deviceoutput"), "mobile")
  assert.equal(mobile.searchParams.get("eco"), "yes")
  assert.equal(mobile.searchParams.get("tracking_id"), `${CHECK24_TRACKING_ID}_GCLID:valid-click_123`)
  const invalid = new URL(buildPowerComparisonUrl(values, false, "<script>&fake=1"))
  assert.equal(invalid.searchParams.get("tracking_id"), CHECK24_TRACKING_ID)
})

test("conversion and resize messages require both the CHECK24 origin and the current iframe", () => {
  const frameWindow = {}
  assert.equal(isTrustedCheck24Message({ origin: CHECK24_ORIGIN, source: frameWindow }, frameWindow), true)
  assert.equal(isTrustedCheck24Message({ origin: "https://evil.example", source: frameWindow }, frameWindow), false)
  assert.equal(isTrustedCheck24Message({ origin: CHECK24_ORIGIN + ".evil.example", source: frameWindow }, frameWindow), false)
  assert.equal(isTrustedCheck24Message({ origin: CHECK24_ORIGIN, source: {} }, frameWindow), false)
  assert.equal(isTrustedCheck24Message({ origin: CHECK24_ORIGIN, source: null }, null), false)
})

test("marketing measurement requires an explicit stored marketing decision", () => {
  const previous = globalThis.window
  try {
    for (const [stored, expected] of [[null, false], ["broken", false], ["declined", false], [JSON.stringify({ version: 2, analytics: true, marketing: false }), false], [JSON.stringify({ version: 2, marketing: true }), true]]) {
      globalThis.window = { localStorage: { getItem: () => stored } }
      assert.equal(hasMarketingConsent(), expected)
    }
    globalThis.window = { localStorage: { getItem: () => { throw new Error("storage blocked") } } }
    assert.equal(hasMarketingConsent(), false)
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
})
