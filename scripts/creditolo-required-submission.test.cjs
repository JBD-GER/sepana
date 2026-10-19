require("./creditolo-test-loader.cjs")
const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const Module = require("node:module")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
const { validateCreditoloApplication, getCreditoloApplicationErrors } = require("../lib/creditolo/application.ts")
const { emptyCreditoloExtra } = require("../lib/creditolo/fields.ts")
const { normalizeCreditPurpose, startOnlinekreditApplication, readOnlinekreditPrefill } = require("../lib/onlinekredit/prefill.ts")

function application() {
  return {
    primary: { first_name:"Test", last_name:"Test", email:"delivered@resend.dev", phone:"015123456789",
      salutation:"herr", birth_date:"1980-01-01", nationality:"DE", marital_status:"single",
      address_street:"Teststraße", address_house_no:"1", address_zip:"10115", address_city:"Berlin",
      housing_status:"rent", employment_since:"2010-01-01", employer_name:"Test GmbH",
      employer_address_zip:"10115", employer_address_city:"Berlin", net_income_monthly:2500 },
    baufi:{purpose:"freie_verwendung",loan_amount_requested:5000,term_months:48},
    additional:{birth_place:"Berlin",address_since:"2010-01-01",current_warm_rent:500,bank_iban:"DE89370400440532013000"},
    creditolo:{...emptyCreditoloExtra(),profession:"Angestellter Privatwirtschaft",taxClass:"1",adults:"1",consent:true,schufaConsent:true},
    children:[], co:[], liabilities:[], realEstateAssets:[],
  }
}

test("the shared client/server gate blocks every provider-required missing field", () => {
  assert.doesNotThrow(() => validateCreditoloApplication(application()))
  for (const [group, field] of [["primary","net_income_monthly"],["primary","employment_since"],["primary","employer_name"],
    ["additional","bank_iban"],["additional","address_since"],["baufi","term_months"],
    ["creditolo","profession"],["creditolo","taxClass"],["creditolo","adults"],["creditolo","consent"],["creditolo","schufaConsent"]]) {
    const input = application()
    delete input[group][field]
    assert.ok(getCreditoloApplicationErrors(input).length, `${group}.${field} must block submission`)
  }
  for (const input of [null, {}, {primary:[]}, {...application(),children:{}}]) {
    assert.throws(() => validateCreditoloApplication(input), /Vollständiger Kreditantrag/)
  }
})

test("handoff preserves term and personal data in this tab, without putting personal data or consent in a URL", () => {
  const stored = new Map()
  let target
  global.window = {sessionStorage:{setItem:(k,v)=>stored.set(k,v),getItem:k=>stored.get(k),removeItem:k=>stored.delete(k)},location:{assign:url=>{target=url}}}
  try {
    const input = {purpose:normalizeCreditPurpose("autokredit"),loanAmount:5000,termMonths:48,primary:application().primary}
    startOnlinekreditApplication(input)
    assert.equal(target,"/onlinekredit#onlinekredit-wizard")
    assert.deepEqual(readOnlinekreditPrefill(),input)
    assert.equal(input.purpose,"auto")
    assert.equal(JSON.stringify(readOnlinekreditPrefill()).includes("schufaConsent"),false)
  } finally { delete global.window }
})

const operations = []
function mock(file, exports) {
  const filename = require.resolve(file)
  require.cache[filename] = {id:filename,filename,loaded:true,exports}
}
const db = {from:table=>{
  const q={insert:()=>{operations.push(`insert:${table}`);return q},update:()=>q,eq:()=>q,select:()=>q,
    single:async()=>({data:{id:"lead-id",external_lead_id:123},error:null}),then:resolve=>resolve({error:null})}
  return q
}}
mock("../lib/supabase/supabaseAdmin.ts",{supabaseAdmin:()=>db})
mock("../lib/admin/leads.ts",{ensureCustomerAccount:async()=>({userId:"customer-id",existingAccount:false}),pickStickyAdvisorId:async()=>null,
  createCaseFromLead:async()=>({caseId:"case-id",caseRef:"PK-TEST"})})
mock("../lib/notifications/notify.ts",{buildEmailHtml:()=>"test",sanitizeNotificationRecipients:()=>["info@sepana.de"],sendEmail:async()=>({ok:true})})
mock("../lib/tippgeber/service.ts",{getActiveTippgeberProfileByUserId:async()=>null})
mock("../lib/onlinekredit/publicAccess.ts",{createPublicCaseAccessToken:()=>"test-access"})
mock("../lib/live/caseRoute.ts",{POST:async req=>{const body=await req.json();operations.push({saved:body});return Response.json({ok:true,warnings:[]})}})
mock("../lib/creditolo/service.ts",{enqueueCreditolo:async(_db,id,_req,extra)=>{operations.push({delivered:id,extra});return {status:"test_ok",code:50}}})
const { POST } = require("../app/api/privatkredit/request/route.ts")
const request = body => new Request("https://www.sepana.de/api/privatkredit/request",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})

test("partial contact requests are rejected before creating a lead", async () => {
  operations.length=0
  const res=await POST(request({requestType:"contact",firstName:"Test",lastName:"Test",email:"delivered@resend.dev",phone:"015123456789"}))
  assert.equal(res.status,400)
  assert.deepEqual(operations,[])
})

test("a complete request saves all fields and dispatches to Creditolo in the same server request", async () => {
  operations.length=0
  const input=application()
  const res=await POST(request({requestType:"contact",application:input}))
  const json=await res.json()
  assert.equal(res.status,200,JSON.stringify(json))
  assert.deepEqual(json.creditolo,{status:"test_ok",code:50})
  assert.equal(operations.filter(o=>o.delivered).length,1)
  const saved=operations.find(o=>o.saved).saved
  assert.equal(saved.baufi.term_months,48)
  assert.equal(saved.primary.net_income_monthly,2500)
  assert.equal(saved.additional.bank_iban,input.additional.bank_iban)
  assert.ok(operations.findIndex(o=>o.saved)<operations.findIndex(o=>o.delivered))
})
