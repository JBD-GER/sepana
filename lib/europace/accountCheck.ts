import { europaceGraphqlRequest } from "@/lib/europace/graphql"

const CREATE_ACCOUNT_CHECK_SESSION_DOCUMENT = `
mutation CreateAccountCheckSession($vorgangsnummer: String!) {
  createAccountCheckSession(vorgangsnummer: $vorgangsnummer) {
    wizardSessionKey
  }
}
`

export async function createEuropaceAccountCheckSession(vorgangsnummer: string) {
  const data = await europaceGraphqlRequest<{
    createAccountCheckSession?: {
      wizardSessionKey?: string | null
    } | null
  }>({
    api: "vorgaenge",
    document: CREATE_ACCOUNT_CHECK_SESSION_DOCUMENT,
    variables: { vorgangsnummer },
    scopes: "privatkredit:vorgang:schreiben",
  })

  return data.createAccountCheckSession ?? null
}
