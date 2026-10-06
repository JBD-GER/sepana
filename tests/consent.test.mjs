import assert from "node:assert/strict"
import test from "node:test"
import { applyConsentUpdate, applyStoredConsentUpdate, DEFAULT_PREFERENCES, hasMarketingConsent, parseStoredConsent, toConsentPayload } from "../lib/ads/consent.ts"

test("all four v2 signals default to denied, with necessary storage granted", () => {
  const payload = toConsentPayload(DEFAULT_PREFERENCES)
  for (const name of ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"]) assert.equal(payload[name], "denied")
  assert.equal(payload.functionality_storage, "granted")
  assert.equal(payload.security_storage, "granted")
})

test("marketing consent allows measurement without requiring personalized advertising", () => {
  const payload = toConsentPayload({ analytics: false, marketing: true, personalization: false })
  assert.equal(payload.ad_storage, "granted")
  assert.equal(payload.ad_user_data, "granted")
  assert.equal(payload.ad_personalization, "denied")
  assert.equal(payload.analytics_storage, "denied")
  assert.equal(toConsentPayload({ analytics: true, marketing: false, personalization: true }).ad_personalization, "denied")
})

test("malformed or incomplete consent cannot silently authorize marketing", () => {
  for (const raw of [null, "null", "{}", "bad-json", JSON.stringify({ version: 2, marketing: true }), JSON.stringify({ version: 2, analytics: true, marketing: "true", personalization: true })]) assert.equal(parseStoredConsent(raw), null)
  assert.equal(parseStoredConsent("declined").marketing, false)
  assert.equal(parseStoredConsent("accepted").marketing, true)
})

test("an explicit decision and withdrawal update Google synchronously", () => {
  const previous = globalThis.window
  const commands = []
  try {
    globalThis.window = { gtag: (...args) => commands.push(args) }
    applyConsentUpdate({ analytics: true, marketing: true, personalization: true })
    assert.equal(commands.length, 1)
    assert.equal(commands[0][0], "consent")
    assert.equal(commands[0][1], "update")
    assert.equal(commands[0][2].ad_user_data, "granted")
    applyConsentUpdate(DEFAULT_PREFERENCES)
    assert.equal(commands.length, 2)
    assert.equal(commands[1][2].ad_storage, "denied")
    assert.equal(commands[1][2].ad_user_data, "denied")
    assert.equal(commands[1][2].ad_personalization, "denied")
    assert.equal(commands.some(command => command[1] === "default"), false)
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
})

test("a saved decision is applied before tag initialization; revoked storage denies consent", () => {
  const previous = globalThis.window
  const commands = []
  try {
    let raw = JSON.stringify({ version: 2, analytics: false, marketing: true, personalization: false })
    globalThis.window = { localStorage: { getItem: () => raw }, gtag: (...args) => commands.push(args) }
    assert.equal(hasMarketingConsent(), true)
    applyStoredConsentUpdate()
    assert.equal(commands[0][2].ad_user_data, "granted")
    assert.equal(commands[0][2].ad_personalization, "denied")
    raw = null
    assert.equal(hasMarketingConsent(), false)
    applyStoredConsentUpdate()
    assert.equal(commands[1][2].ad_user_data, "denied")
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
})
