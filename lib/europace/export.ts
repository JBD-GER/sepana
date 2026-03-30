import { europaceGraphqlRequest } from "@/lib/europace/graphql"
import type { EuropaceExportResult } from "@/lib/europace/types"

const EXPORT_VORGANG_DOCUMENT = `
query ExportVorgang($vorgangsnummer: String!) {
  vorgang(vorgangsnummer: $vorgangsnummer) {
    vorgangsnummer
    letzteAenderungAm
    letztesEreignisAm
    kundenbetreuer {
      partnerId
    }
    bearbeiter {
      partnerId
    }
    antragsteller1 {
      id
      personendaten { vorname nachname }
    }
    antragsteller2 {
      id
      personendaten { vorname nachname }
    }
    haushalt {
      kinder {
        id
        name
        kindergeldFuer
        unterhaltseinnahmenMonatlich
      }
      verbindlichkeiten {
        ratenkredite {
          id
          rateMonatlich
          schlussrate
          datumLetzteRate
          restschuld
          urspruenglicherKreditbetrag
          datumErsteZahlung
          abloesen
          iban
          bic
          glaeubiger
        }
        sonstigeVerbindlichkeiten {
          id
          rateMonatlich
          schlussrate
          datumLetzteRate
          restschuld
          urspruenglicherKreditbetrag
          datumErsteZahlung
          abloesen
          iban
          bic
          glaeubiger
        }
        kreditkarten {
          id
          rateMonatlich
          zinssatz
          beanspruchterBetrag
          verfuegungsrahmen
          abloesen
          iban
          bic
          glaeubiger
        }
        dispositionskredite {
          id
          zinssatz
          beanspruchterBetrag
          verfuegungsrahmen
          abloesen
          iban
          bic
          glaeubiger
        }
        leasings {
          id
          rateMonatlich
          schlussrate
          datumLetzteRate
          glaeubiger
        }
      }
      immobilien {
        id
        bezeichnung
        immobilienart
        nutzungsart
        wert
        wohnflaeche
        vermieteteWohnflaeche
        mieteinnahmenKaltMonatlich
        mieteinnahmenWarmMonatlich
        nebenkostenMonatlich
        darlehen {
          restschuld
          zinsbindungBis
          rateMonatlich
        }
      }
      ausgaben {
        mietausgaben {
          id
          betragMonatlich
        }
      }
    }
    antraege {
      antragsnummer
      produktanbieterantragsnummer
      dokumente {
        name
        url
      }
      identifikationAntragsteller1 {
        antragstellername
        qesUrl
        referenznummer
        videolegitimationUrl
      }
      identifikationAntragsteller2 {
        antragstellername
        qesUrl
        referenznummer
        videolegitimationUrl
      }
      antragstellerstatus {
        status
        letzteAenderungAm
      }
      produktanbieterstatus {
        status
        letzteAenderungAm
        kommentar
        hinweise
      }
      provisionsforderungsstatus {
        status
        letzteAenderungAm
      }
    }
  }
}
`

export async function exportEuropaceVorgang(vorgangsnummer: string) {
  const data = await europaceGraphqlRequest<{ vorgang: EuropaceExportResult }>({
    api: "export",
    document: EXPORT_VORGANG_DOCUMENT,
    variables: { vorgangsnummer },
    scopes: "privatkredit:vorgang:lesen",
  })

  return data.vorgang
}
