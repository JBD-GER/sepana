// Local-only end-to-end test using disposable Test/Test cases and Creditolo's official test mode.
process.loadEnvFile(".env.local")
if (process.env.VERCEL_ENV !== "preview") throw new Error("E2E requires preview/test configuration")
require("./creditolo-test-loader.cjs")
const { createClient } = require("@supabase/supabase-js")
const { createPublicCaseAccessToken } = require("../lib/onlinekredit/publicAccess.ts")
const { emptyCreditoloExtra } = require("../lib/creditolo/fields.ts")
const assert = require("node:assert/strict")
const { randomUUID } = require("node:crypto")
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const ids = []
let testUserId=null
async function insert(table, data) {
  const r = await admin.from(table).insert(data)
  if (r.error) throw new Error(table + ": " + r.error.message)
}
;(async () => {
  try {
    const account=await admin.auth.admin.createUser({email:`creditolo-e2e-${randomUUID()}@example.com`,email_confirm:true,user_metadata:{first_name:"Test",last_name:"Test",creditolo_test:true}})
    if(account.error) throw new Error("Test account: "+account.error.message)
    testUserId=account.data.user.id
    for (const kind of ["konsum", "schufa_frei"]) {
      const id = randomUUID()
      ids.push(id)
      const ref = "CREDITOLO-TEST-" + id.slice(0, 8)
      await insert("cases", { id, case_ref: ref, case_type: kind, status: "draft",customer_id:testUserId })
      const primary = {
        case_id: id,
        role: "primary",
        first_name: "Test",
        last_name: "Test",
        email: account.data.user.email,
        phone: "015123456789",
        birth_date: "1980-01-01",
        nationality: "DE",
        salutation: "herr",
        marital_status: "single",
        address_street: "Teststraße",
        address_house_no: "1",
        address_zip: "10115",
        address_city: "Berlin",
        housing_status: "rent",
        employment_type: "employed",
        employment_since: "2010-01-01",
        employer_name: "Test GmbH",
        employer_address_zip: "10115",
        employer_address_city: "Berlin",
        net_income_monthly: 2500,
      }
      await insert("case_applicants", primary)
      if (kind === "konsum") {
        await insert("case_baufi_details", {
          case_id: id,
          loan_amount_requested: 5000,
          term_months: 48,
          purpose: "hochzeitskredit",
        })
        await insert("case_additional_details", {
          case_id: id,
          birth_place: "Berlin",
          residence_since: "2010-01-01",
          warm_rent_monthly: 500,
          bank_iban: "DE89370400440532013000",
        })
      } else
        await insert("case_schufa_free_details", {
          case_id: id,
          loan_amount_requested: 5000,
          term_months: 40,
          email: primary.email,
        })
      const token = createPublicCaseAccessToken({ caseId: id, caseRef: ref, customerId: testUserId })
      const extra = {
        ...emptyCreditoloExtra(),
        consent: true,
        schufaConsent: true,
        profession: "Angestellter Privatwirtschaft",
        taxClass: "1",
        adults: "1",
      }
      const form = {
        gender: 1,
        firstName: "Test",
        lastName: "Test",
        dateOfBirth: "1980-01-01",
        placeOfBirth: "Berlin",
        nationality: "DE",
        familySituation: 1,
        numberOfChildren: 0,
        street: "Teststraße",
        houseNumber: "1",
        zipcode: "10115",
        city: "Berlin",
        phonePrimary: primary.phone,
        email: primary.email,
        residenceType: 1,
        rentMonthly: 500,
        residentSince: "2010-01-01",
        taxClass: 1,
        profession: 2,
        professionBeginDate: "2010-01-01",
        employerName: "Test GmbH",
        employerZipcode: "10115",
        employerCity: "Berlin",
        netIncomeMonthly: 2500,
        additionalIncomeMonthly: 0,
        bankName: "Testbank",
        iban: "DE89370400440532013000",
      }
      const path = kind === "konsum" ? "/api/creditolo/submit" : "/api/schufa-frei/application"
      const body =
        kind === "konsum"
          ? { caseId: id, caseRef: ref, access: token, creditolo: extra }
          : { caseId: id, caseRef: ref, accessToken: token, creditolo: extra, form }
      const denied = await fetch("http://localhost:3000" + path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
        body: JSON.stringify({ ...body, creditolo: { ...extra, consent: false } }),
      })
      assert.equal(denied.status, 400)
      const response = await fetch("http://localhost:3000" + path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!result.ok) throw new Error(JSON.stringify(result))
      assert.equal(result.creditolo.status, "test_ok")
      assert.equal(result.creditolo.code, 50)
      const row = await admin
        .from("creditolo_deliveries")
        .select("status,response_code,payload,consent_at")
        .eq("case_id", id)
        .single()
      assert.equal(row.data.status, "test_ok")
      assert.equal(row.data.payload, null)
      assert.ok(row.data.consent_at)
      console.log(
        JSON.stringify({
          kind,
          httpStatus: response.status,
          providerCode: 50,
          databaseStatus: row.data.status,
          consentGuard: denied.status,
        }),
      )
    }
    const unauthorized = await fetch("http://localhost:3000/api/system/creditolo")
    assert.equal(unauthorized.status, 401)
    console.log("Cron authorization guard passed")
  } finally {
    // IDs are generated exclusively by this disposable test. No pre-existing data is touched.
    for (const id of ids) {
      const r = await admin.from("cases").delete().eq("id", id)
      if (r.error) throw new Error("Test cleanup failed: " + r.error.message)
    }
    if(testUserId){const deleted=await admin.auth.admin.deleteUser(testUserId);if(deleted.error)throw new Error("Test account cleanup failed: "+deleted.error.message)}
  }
})().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
