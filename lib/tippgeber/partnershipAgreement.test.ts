import assert from "node:assert/strict"
import { test } from "node:test"
import { createHash } from "node:crypto"
import { PDFDocument } from "pdf-lib"
import { buildPartnershipAgreement, isValidSignerName, normalizeSignerName, validateSignature, type SignatureStroke } from "./partnershipAgreement"
import { renderPartnershipAgreementPdf } from "./partnershipAgreementPdf"
import { AgreementError, agreementForProfile, hashAgreement, readAgreementBody, checkAgreementOrigin } from "./partnershipAgreementServer"
import type { TippgeberProfileRow } from "./service"

const profile: TippgeberProfileRow = {
  user_id: "10000000-0000-4000-8000-000000000001", company_name: "Müller & Söhne Immobilien GmbH",
  address_street: "Musterstraße", address_house_number: "12a", address_zip: "30159", address_city: "Hannover",
  tippgeber_kind: "classic", email: "partner@example.com", phone: null, logo_path: null, is_active: true,
}
const signature: SignatureStroke[] = [[
  { x: 0.1, y: 0.7 }, { x: 0.16, y: 0.2 }, { x: 0.2, y: 0.7 }, { x: 0.25, y: 0.4 },
  { x: 0.3, y: 0.65 }, { x: 0.38, y: 0.4 }, { x: 0.44, y: 0.65 }, { x: 0.6, y: 0.4 },
]]

test("full personal names are normalized without losing umlauts", () => {
  assert.equal(normalizeSignerName("  Jörg   Müller  "), "Jörg Müller")
  assert.ok(isValidSignerName("Jörg Müller"))
  assert.ok(isValidSignerName("Anne-Marie de Vries"))
  for (const value of ["", "Max", "A 2", "Max \u0000Muster", "A".repeat(121)]) assert.equal(isValidSignerName(value), false)
})

test("signature requires meaningful bounded strokes", () => {
  assert.ok(validateSignature(signature))
  for (const value of [null, [], [[{ x: 0, y: 0 }]], [Array(8).fill({ x: 0.1, y: 0.1 })], [[{ x: Infinity, y: 0 }, { x: 0, y: 0 }]]]) {
    assert.equal(validateSignature(value), false)
  }
  assert.equal(validateSignature([[...signature[0], { x: 1.1, y: 0 }]]), false)
  assert.equal(validateSignature(Array(101).fill(signature[0])), false)
})

test("review hash binds name, company, address and exact terms", () => {
  const document = agreementForProfile(profile, "Jörg Müller", "partner@example.com")
  const hash = hashAgreement(document)
  assert.equal(hash.length, 64)
  assert.equal(hashAgreement(agreementForProfile(profile, "Jörg Müller", "partner@example.com")), hash)
  for (const changed of [
    { ...profile, company_name: "Andere GmbH" },
    { ...profile, address_street: "Andere Straße" },
  ]) assert.notEqual(hashAgreement(agreementForProfile(changed, "Jörg Müller", "partner@example.com")), hash)
  assert.notEqual(hashAgreement(agreementForProfile(profile, "Erika Musterfrau", "partner@example.com")), hash)
  const edited = structuredClone(document)
  edited.sections[2].paragraphs[0] = "Andere Vergütung"
  assert.notEqual(hashAgreement(edited), hash)
  assert.equal(document.partner.companyName, profile.company_name)
  assert.throws(() => agreementForProfile({ ...profile, address_street: "" }, "Jörg Müller", "partner@example.com"), AgreementError)
})

test("request input is bounded and same-origin submission is required", async () => {
  assert.deepEqual(await readAgreementBody(new Request("https://example.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"action":"preview"}' })), { action: "preview" })
  await assert.rejects(readAgreementBody(new Request("https://example.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: " ".repeat(750001) })), /zu groß/)
  await assert.rejects(readAgreementBody(new Request("https://example.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: "[]" })), /Ungültige/)
  assert.doesNotThrow(() => checkAgreementOrigin(new Request("https://example.com", { headers: { origin: "https://example.com" } })))
  assert.throws(() => checkAgreementOrigin(new Request("https://example.com", { headers: { origin: "https://other.example" } })), AgreementError)
})

test("signed PDF includes embedded fonts and multiple complete pages", async () => {
  const document = buildPartnershipAgreement(agreementForProfile(profile, "Jörg Müller", "partner@example.com").partner)
  const bytes = await renderPartnershipAgreementPdf({ document, signedAt: "2026-09-07T10:00:00.000Z", documentHash: hashAgreement(document), signature })
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-")
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getTitle(), document.title)
  assert.ok(pdf.getPageCount() >= 3 && pdf.getPageCount() <= 6)
  assert.ok(bytes.length > 20000)
  assert.equal(createHash("sha256").update(bytes).digest("hex").length, 64)
})
