const test = require("node:test")
const assert = require("node:assert/strict")
const fixture = require("./creditolo-fixture.cjs")
const { validateCreditoloPayload, normalizeCreditoloPhone } = require("../lib/creditolo/mapper.ts")
const { parseCreditoloResponse, sendCreditolo } = require("../lib/creditolo/client.ts")
const notificationPath = require.resolve("../lib/creditolo/notifications.ts")
require.cache[notificationPath] = {
  id: notificationPath,
  filename: notificationPath,
  loaded: true,
  exports: { notifyCreditoloConfirmation: async () => {} },
}
const { processCreditoloDelivery } = require("../lib/creditolo/service.ts")

function deliveryDatabase() {
  const row = { status: "pending", payload: fixture(), variant: "standard", lock_token: null }
  return {
    row,
    from() {
      const filters = []
      let patch = {}
      let selecting = false
      const q = {
        update(value) {
          patch = value
          return q
        },
        eq(key, value) {
          filters.push([key, value])
          return q
        },
        select() {
          selecting = true
          return q
        },
        maybeSingle() {
          return Promise.resolve(run())
        },
        then(resolve, reject) {
          return Promise.resolve(run()).then(resolve, reject)
        },
      }
      function run() {
        if (!filters.every(([key, value]) => row[key] === value)) return { data: null, error: null }
        Object.assign(row, patch)
        return { data: selecting ? { ...row } : null, error: null }
      }
      return q
    },
  }
}
test("direct delivery uses distinct standard and SCHUFA-free formats", () => {
  const standard = fixture()
  const free = fixture("schufa_free")
  assert.equal(standard[0].operation, "delivery")
  assert.equal(standard[2].schufa, "Ja")
  assert.equal(free[0].operation, undefined)
  assert.equal(free[2].schufa, undefined)
  assert.equal(free[3].wsei, undefined)
  assert.equal(free[1].selection, undefined)
  assert.equal(JSON.stringify(standard).includes("apikey"), false)
})
test("no data transfer without consent or complete mandatory information", () => {
  assert.throws(() => fixture("standard", { consent: false }), /Datenweitergabe/)
  assert.throws(() => fixture("standard", { schufaConsent: false }), /SCHUFA/)
  const p = fixture()
  p[4].iban = "DE00370400440532013000"
  assert.throws(() => validateCreditoloPayload(p, "standard"), /IBAN/)
  const q = fixture()
  q[1].ksum = "1500"
  assert.throws(() => validateCreditoloPayload(q, "standard"), /3.000/)
  const r = fixture()
  r[3].sang = "US"
  assert.throws(() => validateCreditoloPayload(r, "standard"), /Aufenthaltstitel/)
})
test("German international telephone numbers normalize without converting foreign numbers", () => {
  assert.equal(normalizeCreditoloPhone("+49 (151) 234-56789"), "015123456789")
  assert.equal(normalizeCreditoloPhone("004915123456789"), "015123456789")
  assert.equal(normalizeCreditoloPhone("+33123456789"), "+33123456789")
})
test("only confirmed lead creation counts as delivered; test and pending are distinct", () => {
  assert.equal(
    parseCreditoloResponse({
      result: true,
      code: 11,
      client: "123",
      loginlink: "https://www.creditolo.de/login/",
    }).delivered,
    true,
  )
  assert.equal(parseCreditoloResponse({ result: true, code: 50 }).delivered, false)
  assert.equal(parseCreditoloResponse({ result: false, code: 93 }).delivered, false)
  assert.equal(
    parseCreditoloResponse({ result: true, code: 11, loginlink: "https://creditolo.de.evil.example/" })
      .loginUrl,
    null,
  )
  assert.throws(() => parseCreditoloResponse({ result: true }), /invalid/)
})
test("HTTP client supplies credentials only during transmission and selects correct endpoint", async () => {
  process.env.CREDITOLO_API_KEY = "fake-test-key"
  process.env.CREDITOLO_PARTNER_ID = "6292"
  process.env.VERCEL_ENV = "preview"
  for (const variant of ["standard", "schufa_free"]) {
    const p = fixture(variant)
    const r = await sendCreditolo(p, variant, async (url, options) => {
      assert.equal(url.includes("webservice_kos"), variant === "schufa_free")
      assert.equal(options.method, "POST")
      const data = JSON.parse(options.body)
      assert.equal(data[0].apikey, "fake-test-key")
      assert.equal(data[0].affid, "6292")
      return new Response(JSON.stringify({ result: true, code: 50 }), {
        headers: { "content-type": "application/json" },
      })
    })
    assert.equal(r.code, 50)
    assert.equal(p[0].apikey, undefined)
  }
})
test("preview refuses real customer data before any provider request", async () => {
  const p = fixture()
  p[3].vorn = "Someone"
  await assert.rejects(
    () =>
      sendCreditolo(p, "standard", () => {
        throw new Error("must not fetch")
      }),
    /preview_requires_test_names/,
  )
})

test("atomic claim makes concurrent deliveries send once", async () => {
  const db = deliveryDatabase()
  db.row.case_id = "test-case"
  let sends = 0
  const original = global.fetch
  global.fetch = async () => {
    sends++
    await new Promise((resolve) => setTimeout(resolve, 10))
    return new Response(JSON.stringify({ result: true, code: 11, client: "123" }))
  }
  try {
    await Promise.all([processCreditoloDelivery(db, "test-case"), processCreditoloDelivery(db, "test-case")])
    assert.equal(sends, 1)
    assert.equal(db.row.status, "delivered")
    assert.equal(db.row.payload, null)
  } finally {
    global.fetch = original
  }
})

test("ambiguous delivery is held for review and never replayed automatically", async () => {
  const db = deliveryDatabase()
  db.row.case_id = "test-case"
  let sends = 0
  const original = global.fetch
  global.fetch = async () => {
    sends++
    throw new Error("network timeout")
  }
  try {
    await processCreditoloDelivery(db, "test-case")
    await processCreditoloDelivery(db, "test-case")
    assert.equal(sends, 1)
    assert.equal(db.row.status, "unknown")
  } finally {
    global.fetch = original
  }
})
