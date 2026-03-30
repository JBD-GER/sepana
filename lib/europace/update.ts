import { europaceGraphqlRequest } from "@/lib/europace/graphql"

type EuropaceUpdateResponse = {
  messages?: unknown[] | null
} | null

const UPDATE_BEARBEITER_DOCUMENT = `
mutation UpdateBearbeiter($vorgangsnummer: String!, $partnerId: String!) {
  updateBearbeiter(
    vorgangsnummer: $vorgangsnummer
    partnerId: $partnerId
  ) {
    messages
  }
}
`

const DELETE_ANTRAGSTELLER_DOCUMENT = `
mutation DeleteAntragsteller($vorgangsnummer: String!, $id: String!) {
  deleteAntragsteller(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const DELETE_MIETAUSGABE_DOCUMENT = `
mutation DeleteMietausgabe($vorgangsnummer: String!, $id: String!) {
  deleteMietausgabe(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const DELETE_KIND_DOCUMENT = `
mutation DeleteKind($vorgangsnummer: String!, $id: String!) {
  deleteKind(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const DELETE_RATENKREDIT_DOCUMENT = `
mutation DeleteRatenkredit($vorgangsnummer: String!, $id: String!) {
  deleteRatenkredit(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const DELETE_DISPOSITIONSKREDIT_DOCUMENT = `
mutation DeleteDispositionskredit($vorgangsnummer: String!, $id: String!) {
  deleteDispositionskredit(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const DELETE_KREDITKARTE_DOCUMENT = `
mutation DeleteKreditkarte($vorgangsnummer: String!, $id: String!) {
  deleteKreditkarte(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const DELETE_LEASING_DOCUMENT = `
mutation DeleteLeasing($vorgangsnummer: String!, $id: String!) {
  deleteLeasing(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const DELETE_SONSTIGE_VERBINDLICHKEIT_DOCUMENT = `
mutation DeleteSonstigeVerbindlichkeit($vorgangsnummer: String!, $id: String!) {
  deleteSonstigeVerbindlichkeit(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const DELETE_IMMOBILIE_DOCUMENT = `
mutation DeleteImmobilie($vorgangsnummer: String!, $id: String!) {
  deleteImmobilie(
    vorgangsnummer: $vorgangsnummer
    id: $id
  ) {
    messages
  }
}
`

const ENUM_FIELD_NAMES = new Set([
  "anrede",
  "beschaeftigungsart",
  "befristung",
  "branche",
  "familienstand",
  "finanzierungszweck",
  "geburtsland",
  "immobilienart",
  "kindergeldFuer",
  "land",
  "nutzungsart",
  "staatsangehoerigkeit",
  "titel",
  "wohnart",
])

function lastFieldKey(path: string[]) {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const part = path[index]
    if (!/^\d+$/.test(part)) return part
  }
  return null
}

function toGraphqlLiteral(value: unknown, path: string[] = []): string {
  if (value === null) return "null"
  if (value === undefined) return "null"

  if (Array.isArray(value)) {
    return `[${value.map((entry) => toGraphqlLiteral(entry, path)).join(", ")}]`
  }

  if (typeof value === "string") {
    const key = lastFieldKey(path)
    if (key && ENUM_FIELD_NAMES.has(key)) {
      return value
    }
    return JSON.stringify(value)
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value)
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined)
    if (!entries.length) return "{}"
    return `{
${entries.map(([key, entry]) => `  ${key}: ${toGraphqlLiteral(entry, [...path, key])}`).join("\n")}
}`
  }

  return JSON.stringify(String(value))
}

function buildAddAntragstellerDocument(antragsteller: Record<string, unknown>) {
  return `
mutation AddAntragsteller($vorgangsnummer: String!) {
  addAntragsteller(
    vorgangsnummer: $vorgangsnummer
    antragsteller: ${toGraphqlLiteral(antragsteller, ["antragsteller"])}
  ) {
    messages
  }
}
`
}

function buildUpdatePersonendatenDocument(personendaten: Record<string, unknown>) {
  return `
mutation UpdatePersonendaten($vorgangsnummer: String!, $antragstellerId: String!) {
  updatePersonendaten(
    vorgangsnummer: $vorgangsnummer
    antragstellerId: $antragstellerId
    personendaten: ${toGraphqlLiteral(personendaten, ["personendaten"])}
  ) {
    messages
  }
}
`
}

function buildUpdateHerkunftDocument(herkunft: Record<string, unknown>) {
  return `
mutation UpdateHerkunft($vorgangsnummer: String!, $antragstellerId: String!) {
  updateHerkunft(
    vorgangsnummer: $vorgangsnummer
    antragstellerId: $antragstellerId
    herkunft: ${toGraphqlLiteral(herkunft, ["herkunft"])}
  ) {
    messages
  }
}
`
}

function buildUpdateWohnsituationDocument(wohnsituation: Record<string, unknown>) {
  return `
mutation UpdateWohnsituation($vorgangsnummer: String!, $antragstellerId: String!) {
  updateWohnsituation(
    vorgangsnummer: $vorgangsnummer
    antragstellerId: $antragstellerId
    wohnsituation: ${toGraphqlLiteral(wohnsituation, ["wohnsituation"])}
  ) {
    messages
  }
}
`
}

function buildUpdateBeschaeftigungDocument(beschaeftigung: Record<string, unknown>) {
  return `
mutation UpdateBeschaeftigung($vorgangsnummer: String!, $antragstellerId: String!) {
  updateBeschaeftigung(
    vorgangsnummer: $vorgangsnummer
    antragstellerId: $antragstellerId
    beschaeftigung: ${toGraphqlLiteral(beschaeftigung, ["beschaeftigung"])}
  ) {
    messages
  }
}
`
}

function buildUpdateKontoverbindungDocument(kontoverbindung: Record<string, unknown>) {
  return `
mutation UpdateKontoverbindung($vorgangsnummer: String!) {
  updateKontoverbindung(
    vorgangsnummer: $vorgangsnummer
    kontoverbindung: ${toGraphqlLiteral(kontoverbindung, ["kontoverbindung"])}
  ) {
    messages
  }
}
`
}

function buildUpdateFinanzierungszweckDocument(finanzierungszweck: string) {
  return `
mutation UpdateFinanzierungszweck($vorgangsnummer: String!) {
  updateFinanzierungszweck(
    vorgangsnummer: $vorgangsnummer
    finanzierungszweck: ${toGraphqlLiteral(finanzierungszweck, ["finanzierungszweck"])}
  ) {
    messages
  }
}
`
}

function buildUpdateFinanzierungswunschDocument(finanzierungswunsch: Record<string, unknown>) {
  return `
mutation UpdateFinanzierungswunsch($vorgangsnummer: String!) {
  updateFinanzierungswunsch(
    vorgangsnummer: $vorgangsnummer
    finanzierungswunsch: ${toGraphqlLiteral(finanzierungswunsch, ["finanzierungswunsch"])}
  ) {
    messages
  }
}
`
}

function buildAddMietausgabeDocument(mietausgabe: Record<string, unknown>) {
  return `
mutation AddMietausgabe($vorgangsnummer: String!) {
  addMietausgabe(
    vorgangsnummer: $vorgangsnummer
    mietausgabe: ${toGraphqlLiteral(mietausgabe, ["mietausgabe"])}
  ) {
    messages
    id
  }
}
`
}

function buildUpdateMietausgabeDocument(mietausgabe: Record<string, unknown>) {
  return `
mutation UpdateMietausgabe($vorgangsnummer: String!, $id: String!) {
  updateMietausgabe(
    vorgangsnummer: $vorgangsnummer
    id: $id
    mietausgabe: ${toGraphqlLiteral(mietausgabe, ["mietausgabe"])}
  ) {
    messages
  }
}
`
}

function buildAddKindDocument(kind: Record<string, unknown>) {
  return `
mutation AddKind($vorgangsnummer: String!) {
  addKind(
    vorgangsnummer: $vorgangsnummer
    kind: ${toGraphqlLiteral(kind, ["kind"])}
  ) {
    messages
    id
  }
}
`
}

function buildAddRatenkreditDocument(ratenkredit: Record<string, unknown>) {
  return `
mutation AddRatenkredit($vorgangsnummer: String!) {
  addRatenkredit(
    vorgangsnummer: $vorgangsnummer
    ratenkredit: ${toGraphqlLiteral(ratenkredit, ["ratenkredit"])}
  ) {
    messages
    id
  }
}
`
}

function buildAddDispositionskreditDocument(dispositionskredit: Record<string, unknown>) {
  return `
mutation AddDispositionskredit($vorgangsnummer: String!) {
  addDispositionskredit(
    vorgangsnummer: $vorgangsnummer
    dispositionskredit: ${toGraphqlLiteral(dispositionskredit, ["dispositionskredit"])}
  ) {
    messages
    id
  }
}
`
}

function buildAddKreditkarteDocument(kreditkarte: Record<string, unknown>) {
  return `
mutation AddKreditkarte($vorgangsnummer: String!) {
  addKreditkarte(
    vorgangsnummer: $vorgangsnummer
    kreditkarte: ${toGraphqlLiteral(kreditkarte, ["kreditkarte"])}
  ) {
    messages
    id
  }
}
`
}

function buildAddLeasingDocument(leasing: Record<string, unknown>) {
  return `
mutation AddLeasing($vorgangsnummer: String!) {
  addLeasing(
    vorgangsnummer: $vorgangsnummer
    leasing: ${toGraphqlLiteral(leasing, ["leasing"])}
  ) {
    messages
    id
  }
}
`
}

function buildAddSonstigeVerbindlichkeitDocument(sonstigeVerbindlichkeit: Record<string, unknown>) {
  return `
mutation AddSonstigeVerbindlichkeit($vorgangsnummer: String!) {
  addSonstigeVerbindlichkeit(
    vorgangsnummer: $vorgangsnummer
    sonstigeVerbindlichkeit: ${toGraphqlLiteral(sonstigeVerbindlichkeit, ["sonstigeVerbindlichkeit"])}
  ) {
    messages
    id
  }
}
`
}

function buildAddImmobilieDocument(immobilie: Record<string, unknown>) {
  return `
mutation AddImmobilie($vorgangsnummer: String!) {
  addImmobilie(
    vorgangsnummer: $vorgangsnummer
    immobilie: ${toGraphqlLiteral(immobilie, ["immobilie"])}
  ) {
    messages
    id
  }
}
`
}

export function normalizeEuropaceMessages(input: unknown) {
  if (!Array.isArray((input as { messages?: unknown[] | null } | null)?.messages)) return [] as string[]
  return ((input as { messages?: unknown[] | null }).messages ?? [])
    .map((entry) => {
      if (typeof entry === "string") return entry.trim()
      if (entry && typeof entry === "object") {
        const row = entry as { code?: unknown; text?: unknown }
        const text = String(row.text ?? "").trim()
        const code = String(row.code ?? "").trim()
        return text || code || ""
      }
      return ""
    })
    .filter(Boolean)
}

export async function addEuropaceAntragsteller(input: {
  vorgangsnummer: string
  antragsteller: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{ addAntragsteller: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildAddAntragstellerDocument(input.antragsteller),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addAntragsteller ?? null
}

export async function updateEuropaceBearbeiter(input: {
  vorgangsnummer: string
  partnerId: string
}) {
  const data = await europaceGraphqlRequest<{ updateBearbeiter: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: UPDATE_BEARBEITER_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updateBearbeiter ?? null
}

export async function deleteEuropaceAntragsteller(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteAntragsteller: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_ANTRAGSTELLER_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteAntragsteller ?? null
}

export async function deleteEuropaceMietausgabe(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteMietausgabe: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_MIETAUSGABE_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteMietausgabe ?? null
}

export async function deleteEuropaceKind(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteKind: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_KIND_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteKind ?? null
}

export async function deleteEuropaceRatenkredit(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteRatenkredit: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_RATENKREDIT_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteRatenkredit ?? null
}

export async function deleteEuropaceDispositionskredit(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteDispositionskredit: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_DISPOSITIONSKREDIT_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteDispositionskredit ?? null
}

export async function deleteEuropaceKreditkarte(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteKreditkarte: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_KREDITKARTE_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteKreditkarte ?? null
}

export async function deleteEuropaceLeasing(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteLeasing: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_LEASING_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteLeasing ?? null
}

export async function deleteEuropaceSonstigeVerbindlichkeit(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteSonstigeVerbindlichkeit: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_SONSTIGE_VERBINDLICHKEIT_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteSonstigeVerbindlichkeit ?? null
}

export async function deleteEuropaceImmobilie(input: {
  vorgangsnummer: string
  id: string
}) {
  const data = await europaceGraphqlRequest<{ deleteImmobilie: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: DELETE_IMMOBILIE_DOCUMENT,
    variables: input,
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.deleteImmobilie ?? null
}

export async function updateEuropacePersonendaten(input: {
  vorgangsnummer: string
  antragstellerId: string
  personendaten: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{ updatePersonendaten: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildUpdatePersonendatenDocument(input.personendaten),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
      antragstellerId: input.antragstellerId,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updatePersonendaten ?? null
}

export async function updateEuropaceHerkunft(input: {
  vorgangsnummer: string
  antragstellerId: string
  herkunft: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{ updateHerkunft: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildUpdateHerkunftDocument(input.herkunft),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
      antragstellerId: input.antragstellerId,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updateHerkunft ?? null
}

export async function updateEuropaceWohnsituation(input: {
  vorgangsnummer: string
  antragstellerId: string
  wohnsituation: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{ updateEuropaceWohnsituation: EuropaceUpdateResponse; updateWohnsituation: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildUpdateWohnsituationDocument(input.wohnsituation),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
      antragstellerId: input.antragstellerId,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updateWohnsituation ?? null
}

export async function updateEuropaceBeschaeftigung(input: {
  vorgangsnummer: string
  antragstellerId: string
  beschaeftigung: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{ updateBeschaeftigung: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildUpdateBeschaeftigungDocument(input.beschaeftigung),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
      antragstellerId: input.antragstellerId,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updateBeschaeftigung ?? null
}

export async function updateEuropaceKontoverbindung(input: {
  vorgangsnummer: string
  kontoverbindung: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{ updateKontoverbindung: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildUpdateKontoverbindungDocument(input.kontoverbindung),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updateKontoverbindung ?? null
}

export async function updateEuropaceFinanzierungszweck(input: {
  vorgangsnummer: string
  finanzierungszweck: string
}) {
  const data = await europaceGraphqlRequest<{ updateFinanzierungszweck: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildUpdateFinanzierungszweckDocument(input.finanzierungszweck),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updateFinanzierungszweck ?? null
}

export async function updateEuropaceFinanzierungswunsch(input: {
  vorgangsnummer: string
  finanzierungswunsch: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{ updateFinanzierungswunsch: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildUpdateFinanzierungswunschDocument(input.finanzierungswunsch),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updateFinanzierungswunsch ?? null
}

export async function addEuropaceMietausgabe(input: {
  vorgangsnummer: string
  mietausgabe: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{
    addMietausgabe: (EuropaceUpdateResponse & { id?: string | null }) | null
  }>({
    api: "vorgaenge",
    document: buildAddMietausgabeDocument(input.mietausgabe),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addMietausgabe ?? null
}

export async function updateEuropaceMietausgabe(input: {
  vorgangsnummer: string
  id: string
  mietausgabe: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{ updateMietausgabe: EuropaceUpdateResponse }>({
    api: "vorgaenge",
    document: buildUpdateMietausgabeDocument(input.mietausgabe),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
      id: input.id,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.updateMietausgabe ?? null
}

export async function addEuropaceKind(input: {
  vorgangsnummer: string
  kind: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{
    addKind: (EuropaceUpdateResponse & { id?: string | null }) | null
  }>({
    api: "vorgaenge",
    document: buildAddKindDocument(input.kind),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addKind ?? null
}

export async function addEuropaceRatenkredit(input: {
  vorgangsnummer: string
  ratenkredit: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{
    addRatenkredit: (EuropaceUpdateResponse & { id?: string | null }) | null
  }>({
    api: "vorgaenge",
    document: buildAddRatenkreditDocument(input.ratenkredit),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addRatenkredit ?? null
}

export async function addEuropaceDispositionskredit(input: {
  vorgangsnummer: string
  dispositionskredit: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{
    addDispositionskredit: (EuropaceUpdateResponse & { id?: string | null }) | null
  }>({
    api: "vorgaenge",
    document: buildAddDispositionskreditDocument(input.dispositionskredit),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addDispositionskredit ?? null
}

export async function addEuropaceKreditkarte(input: {
  vorgangsnummer: string
  kreditkarte: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{
    addKreditkarte: (EuropaceUpdateResponse & { id?: string | null }) | null
  }>({
    api: "vorgaenge",
    document: buildAddKreditkarteDocument(input.kreditkarte),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addKreditkarte ?? null
}

export async function addEuropaceLeasing(input: {
  vorgangsnummer: string
  leasing: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{
    addLeasing: (EuropaceUpdateResponse & { id?: string | null }) | null
  }>({
    api: "vorgaenge",
    document: buildAddLeasingDocument(input.leasing),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addLeasing ?? null
}

export async function addEuropaceSonstigeVerbindlichkeit(input: {
  vorgangsnummer: string
  sonstigeVerbindlichkeit: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{
    addSonstigeVerbindlichkeit: (EuropaceUpdateResponse & { id?: string | null }) | null
  }>({
    api: "vorgaenge",
    document: buildAddSonstigeVerbindlichkeitDocument(input.sonstigeVerbindlichkeit),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addSonstigeVerbindlichkeit ?? null
}

export async function addEuropaceImmobilie(input: {
  vorgangsnummer: string
  immobilie: Record<string, unknown>
}) {
  const data = await europaceGraphqlRequest<{
    addImmobilie: (EuropaceUpdateResponse & { id?: string | null }) | null
  }>({
    api: "vorgaenge",
    document: buildAddImmobilieDocument(input.immobilie),
    variables: {
      vorgangsnummer: input.vorgangsnummer,
    },
    scopes: "privatkredit:vorgang:schreiben",
  })
  return data.addImmobilie ?? null
}
