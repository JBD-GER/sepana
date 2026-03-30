import { europaceGraphqlRequest } from "@/lib/europace/graphql"
import type { EuropaceOfferSummary } from "@/lib/europace/types"

const OFFERS_DOCUMENT = `
query Angebote($vorgangsnummer: String!) {
  angebote(
    vorgangsnummer: $vorgangsnummer
    options: {
      includeVollstaendigkeitsstatus: [VOLLSTAENDIG, UNVOLLSTAENDIG]
      includeMachbarkeitsstatus: [MACHBAR, MACHBAR_UNTER_VORBEHALT, NICHT_MACHBAR]
      vertriebskanal: B2B2C
    }
  ) {
    id
    machbarkeit {
      status
      messages {
        text
      }
    }
    vollstaendigkeit {
      status
      messages {
        text
        property
        category
        reason
        identifier {
          type
          ids
        }
      }
    }
    gesamtkonditionen {
      sollzins
      effektivzins
      gesamtkreditbetrag
      nettokreditbetrag
      auszahlungsbetrag
      rateMonatlich
      laufzeitInMonaten
    }
    ratenkredit {
      produktanbieter {
        name
        logo {
          svg
        }
      }
      produktbezeichnung
    }
    sofortkredit
    digitalisierungsmerkmale {
      accountCheck {
        modus
      }
    }
    vorhersage {
      machbarkeit {
        score
      }
    }
  }
}
`

const ACCEPT_OFFER_DOCUMENT = `
mutation AngebotAnnehmen($vorgangsnummer: String!, $angebotId: String!) {
  angebotAnnehmen(vorgangsnummer: $vorgangsnummer, angebotId: $angebotId) {
    jobId
  }
}
`

const ANNAHME_JOB_DOCUMENT = `
query AnnahmeJob($jobId: String!) {
  annahmeJob(jobId: $jobId) {
    status
    antrag {
      antragsnummer
      produktanbieterantragsnummer
      gesamtkonditionen {
        sollzins
        effektivzins
        laufzeitInMonaten
        gesamtkreditbetrag
        nettokreditbetrag
        rateMonatlich
      }
    }
  }
}
`

export async function getEuropaceOffers(vorgangsnummer: string) {
  const data = await europaceGraphqlRequest<{ angebote: EuropaceOfferSummary[] | null }>({
    api: "angebote",
    document: OFFERS_DOCUMENT,
    variables: { vorgangsnummer },
    scopes: "privatkredit:angebot:ermitteln",
  })

  return data.angebote ?? []
}

export async function acceptEuropaceOffer(vorgangsnummer: string, angebotId: string) {
  const data = await europaceGraphqlRequest<{
    angebotAnnehmen: {
      jobId?: string | null
    } | null
  }>({
    api: "angebote",
    document: ACCEPT_OFFER_DOCUMENT,
    variables: { vorgangsnummer, angebotId },
    scopes: "privatkredit:antrag:schreiben",
  })

  return data.angebotAnnehmen ?? null
}

export async function getEuropaceAnnahmeJob(jobId: string) {
  const data = await europaceGraphqlRequest<{
    annahmeJob: {
      status?: string | null
      antrag?: {
        antragsnummer?: string | null
        produktanbieterantragsnummer?: string | null
        gesamtkonditionen?: {
          sollzins?: number | null
          effektivzins?: number | null
          laufzeitInMonaten?: number | null
          gesamtkreditbetrag?: number | null
          nettokreditbetrag?: number | null
          rateMonatlich?: number | null
        } | null
      } | null
    } | null
  }>({
    api: "angebote",
    document: ANNAHME_JOB_DOCUMENT,
    variables: { jobId },
    scopes: "privatkredit:angebot:ermitteln",
  })

  return data.annahmeJob ?? null
}
