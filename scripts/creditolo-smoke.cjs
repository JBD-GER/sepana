// Official Creditolo test mode: first and last name are always exactly Test.
process.loadEnvFile(".env.local")
const fixture = require("./creditolo-fixture.cjs")
const { sendCreditolo } = require("../lib/creditolo/client.ts")
;(async () => {
  for (const variant of ["standard", "schufa_free"]) {
    const result = await sendCreditolo(fixture(variant), variant)
    console.log(
      JSON.stringify({ variant, code: result.code, testPassed: result.code === 50, fields: result.fields }),
    )
    if (result.code !== 50) process.exitCode = 1
  }
})().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
