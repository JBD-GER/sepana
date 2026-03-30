export type EuropaceApplicantRef = {
  id: string | null
  name?: {
    vorname?: string | null
    nachname?: string | null
  } | null
  personendaten?: {
    vorname?: string | null
    nachname?: string | null
  } | null
}

export type EuropacePartnerRef = {
  partnerId?: string | null
} | null

export type EuropaceImportResult = {
  vorgangsnummer: string | null
  antragsteller1?: EuropaceApplicantRef | null
  antragsteller2?: EuropaceApplicantRef | null
  kundendaten?: {
    antragsteller1?: EuropaceApplicantRef | null
    antragsteller2?: EuropaceApplicantRef | null
  } | null
}

export type EuropaceApplicationSummary = {
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  dokumente?:
    | Array<{
        name?: string | null
        url?: string | null
      }>
    | null
  identifikationAntragsteller1?: {
    antragstellername?: string | null
    qesUrl?: string | null
    referenznummer?: string | null
    videolegitimationUrl?: string | null
  } | null
  identifikationAntragsteller2?: {
    antragstellername?: string | null
    qesUrl?: string | null
    referenznummer?: string | null
    videolegitimationUrl?: string | null
  } | null
  antragstellerstatus?:
    | string
    | {
        status?: string | null
        letzteAenderungAm?: string | null
      }
    | null
  produktanbieterstatus?:
    | string
    | {
        status?: string | null
        letzteAenderungAm?: string | null
        kommentar?: string | null
        hinweise?: string[] | null
      }
    | null
  provisionsforderungsstatus?:
    | string
    | {
        status?: string | null
        letzteAenderungAm?: string | null
      }
    | null
}

export type EuropaceExportResult = {
  vorgangsnummer: string | null
  letzteAenderungAm?: string | null
  letztesEreignisAm?: string | null
  kundenbetreuer?: EuropacePartnerRef
  bearbeiter?: EuropacePartnerRef
  antragsteller1?: EuropaceApplicantRef | null
  antragsteller2?: EuropaceApplicantRef | null
  haushalt?: {
    kinder?: Array<{
      id?: string | null
      name?: string | null
      kindergeldFuer?: string | null
      unterhaltseinnahmenMonatlich?: number | null
    }> | null
    verbindlichkeiten?: {
      ratenkredite?: Array<{
        id?: string | null
        rateMonatlich?: number | null
        schlussrate?: number | null
        datumLetzteRate?: string | null
        restschuld?: number | null
        urspruenglicherKreditbetrag?: number | null
        datumErsteZahlung?: string | null
        abloesen?: boolean | null
        iban?: string | null
        bic?: string | null
        glaeubiger?: string | null
      }> | null
      sonstigeVerbindlichkeiten?: Array<{
        id?: string | null
        rateMonatlich?: number | null
        schlussrate?: number | null
        datumLetzteRate?: string | null
        restschuld?: number | null
        urspruenglicherKreditbetrag?: number | null
        datumErsteZahlung?: string | null
        abloesen?: boolean | null
        iban?: string | null
        bic?: string | null
        glaeubiger?: string | null
      }> | null
      kreditkarten?: Array<{
        id?: string | null
        rateMonatlich?: number | null
        zinssatz?: number | null
        beanspruchterBetrag?: number | null
        verfuegungsrahmen?: number | null
        abloesen?: boolean | null
        iban?: string | null
        bic?: string | null
        glaeubiger?: string | null
      }> | null
      dispositionskredite?: Array<{
        id?: string | null
        zinssatz?: number | null
        beanspruchterBetrag?: number | null
        verfuegungsrahmen?: number | null
        abloesen?: boolean | null
        iban?: string | null
        bic?: string | null
        glaeubiger?: string | null
      }> | null
      leasings?: Array<{
        id?: string | null
        rateMonatlich?: number | null
        schlussrate?: number | null
        datumLetzteRate?: string | null
        glaeubiger?: string | null
      }> | null
    } | null
    immobilien?: Array<{
      id?: string | null
      bezeichnung?: string | null
      immobilienart?: string | null
      nutzungsart?: string | null
      wert?: number | null
      wohnflaeche?: number | null
      vermieteteWohnflaeche?: number | null
      mieteinnahmenKaltMonatlich?: number | null
      mieteinnahmenWarmMonatlich?: number | null
      nebenkostenMonatlich?: number | null
      darlehen?: Array<{
        restschuld?: number | null
        zinsbindungBis?: string | null
        rateMonatlich?: number | null
      }> | null
    }> | null
    ausgaben?: {
      mietausgaben?: Array<{
        id?: string | null
        betragMonatlich?: number | null
      }> | null
    } | null
  } | null
  kundendaten?: {
    antragsteller1?: EuropaceApplicantRef | null
    antragsteller2?: EuropaceApplicantRef | null
  } | null
  antraege?: EuropaceApplicationSummary[] | null
}

export type EuropaceOfferSummary = {
  id?: string | null
  machbarkeit?: {
    status?: string | null
    messages?: Array<{ text?: string | null }> | null
  } | null
  vollstaendigkeit?: {
    status?: string | null
    messages?:
      | Array<{
          text?: string | null
          property?: string | null
          category?: string | null
          reason?: string | null
          identifier?: {
            type?: string | null
            ids?: string[] | null
          } | null
        }>
      | null
  } | null
  gesamtkonditionen?: {
    sollzins?: number | null
    effektivzins?: number | null
    gesamtkreditbetrag?: number | null
    nettokreditbetrag?: number | null
    auszahlungsbetrag?: number | null
    rateMonatlich?: number | null
    laufzeitInMonaten?: number | null
  } | null
  ratenkredit?: {
    produktanbieter?: {
      name?: string | null
      logo?: {
        svg?: string | null
      } | null
    } | null
    produktbezeichnung?: string | null
  } | null
  sofortkredit?: boolean | null
  digitalisierungsmerkmale?: {
    accountCheck?: {
      modus?: string | null
    } | null
  } | null
  vorhersage?: {
    machbarkeit?: {
      score?: number | null
    } | null
  } | null
}
