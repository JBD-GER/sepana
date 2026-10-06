"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Image from "next/image"
import { buildPowerComparisonUrl, buildPowerTrackingPixelUrl, CHECK24_ORIGIN, isTrustedCheck24Message, isValidPowerComparison, type PowerComparison } from "@/lib/energy/check24"
import { hasMarketingConsent } from "@/lib/ads/consent"
import { trackEnergyEvent } from "@/lib/ads/energy"
import styles from "./strom.module.css"

const HOUSEHOLDS = [{ people: 1, kwh: 2000 }, { people: 2, kwh: 3500 }, { people: 3, kwh: 4250 }, { people: 4, kwh: 5000 }]

function ComparisonFrame({ url, onEdit }: { url: string; onEdit: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const conversionSent = useRef(false)
  const transactionId = useRef<string | null>(null)
  const [height, setHeight] = useState(1100)
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000)
    function handleMessage(event: MessageEvent) {
      if (!isTrustedCheck24Message(event, iframeRef.current?.contentWindow ?? null)) return
      if (event.data === "funnel=conversion" && !conversionSent.current) {
        transactionId.current ??= crypto.randomUUID()
        conversionSent.current = trackEnergyEvent("strom_antrag_abgeschlossen", transactionId.current)
      }
      if ((typeof event.data === "string" && /^\d+$/.test(event.data)) || typeof event.data === "number") {
        const nextHeight = Number(event.data)
        if (Number.isFinite(nextHeight) && nextHeight >= 450 && nextHeight <= 20000) {
          setHeight(nextHeight + 10)
          setLoaded(true)
          window.clearTimeout(timer)
        }
      }
    }
    window.addEventListener("message", handleMessage)
    return () => { window.clearTimeout(timer); window.removeEventListener("message", handleMessage) }
  }, [])

  return <section className={styles.comparison} id="tarifvergleich" aria-labelledby="comparison-title">
    <div className={styles.comparisonHead}>
      <div><span className={styles.eyebrow}>DEIN STROMVERGLEICH</span><h2 id="comparison-title">Jetzt deinen passenden Tarif finden.</h2></div>
      <button type="button" onClick={onEdit} className={styles.editButton}>Angaben ändern</button>
    </div>
    {!loaded && <p role="status" className={styles.loading}>Dein CHECK24-Vergleich wird geladen …</p>}
    {slow && !loaded && <p className={styles.fallback}>Der Rechner lädt länger als erwartet. <a href={url} target="_blank" rel="noopener sponsored">Vergleich direkt bei CHECK24 öffnen</a></p>}
    <iframe ref={iframeRef} src={url} title="CHECK24 Stromtarife vergleichen und online beantragen" style={{ width: "100%", height, border: 0 }} onLoad={() => {
      iframeRef.current?.contentWindow?.postMessage(window.location.origin, CHECK24_ORIGIN)
    }} />
    <Image src={buildPowerTrackingPixelUrl(url)} width={1} height={1} alt="" unoptimized className={styles.trackingPixel} />
    <p className={styles.partnerNote}>Vergleich und Antrag werden durch CHECK24 bereitgestellt. Tarifdetails und Vertragsbedingungen findest du im jeweiligen Angebot.</p>
  </section>
}

export default function PowerFunnel() {
  const [zipcode, setZipcode] = useState("")
  const [consumption, setConsumption] = useState("3500")
  const [household, setHousehold] = useState<number | null>(2)
  const [eco, setEco] = useState(false)
  const [error, setError] = useState("")
  const [comparisonUrl, setComparisonUrl] = useState<string | null>(null)
  const startRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const plzRef = useRef<HTMLInputElement>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values: PowerComparison = { zipcode: zipcode.trim(), consumption: Number(consumption), eco }
    if (!/^\d{5}$/.test(values.zipcode)) { setError("Bitte gib eine fünfstellige deutsche Postleitzahl ein."); plzRef.current?.focus(); return }
    if (!isValidPowerComparison(values)) { setError("Bitte gib einen Jahresverbrauch zwischen 500 und 100.000 kWh ein."); return }
    setError("")
    const gclid = hasMarketingConsent() ? new URLSearchParams(window.location.search).get("gclid") ?? undefined : undefined
    setComparisonUrl(buildPowerComparisonUrl(values, window.innerWidth < 760, gclid))
    trackEnergyEvent("strom_vergleich_start")
    requestAnimationFrame(() => { resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); resultRef.current?.focus({ preventScroll: true }) })
  }

  return <>
    <div ref={startRef} className={styles.startCard} id="strom-start">
      <div className={styles.cardTop}><span className={styles.cardTag}>DEIN TARIF-CHECK</span><span className={styles.freeBadge}>Kostenlos & unverbindlich</span></div>
      <h2>Was kostet Strom bei dir?</h2>
      <p className={styles.cardIntro}>Zwei Angaben. Dein persönlicher Vergleich.</p>
      <form onSubmit={submit} noValidate>
        <label className={styles.fieldLabel} htmlFor="strom-plz">Deine Postleitzahl</label>
        <input ref={plzRef} id="strom-plz" name="zipcode" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="z. B. 10115" value={zipcode} onChange={e => { setZipcode(e.target.value.replace(/\D/g, "")); setError("") }} aria-invalid={!!error && !/^\d{5}$/.test(zipcode)} aria-describedby={error ? "strom-error" : undefined} className={styles.textInput} required />
        <fieldset className={styles.household}><legend>Wie viele Personen leben bei dir?</legend><div className={styles.peopleChoices}>
          {HOUSEHOLDS.map(item => <label key={item.people} className={household === item.people ? styles.personSelected : styles.personChoice}>
            <input type="radio" name="household" value={item.people} checked={household === item.people} onChange={() => { setHousehold(item.people); setConsumption(String(item.kwh)) }} />
            <span aria-hidden="true" className={styles.peopleIcon}>{Array.from({ length: item.people }, (_, i) => <svg key={i} viewBox="0 0 12 24"><circle cx="6" cy="4" r="3" fill="currentColor" /><path d="M2 12a4 4 0 0 1 8 0v5H8v6H4v-6H2z" fill="currentColor" /></svg>)}</span>
            <span>{item.people === 4 ? "4+" : item.people}</span><span className={styles.srOnly}>{item.people === 1 ? " Person" : " Personen"}</span>
          </label>)}
        </div></fieldset>
        <div className={styles.consumptionLabel}><label className={styles.fieldLabel} htmlFor="strom-kwh">Verbrauch pro Jahr</label><span>Schätzung – frei anpassbar</span></div>
        <div className={styles.unitInput}><input id="strom-kwh" name="consumption" type="number" inputMode="numeric" min={500} max={100000} step={1} value={consumption} onChange={e => { setConsumption(e.target.value); setHousehold(null) }} required /><span>kWh</span></div>
        <label className={styles.ecoChoice}><input type="checkbox" checked={eco} onChange={e => setEco(e.target.checked)} />Nur Ökostrom-Tarife anzeigen</label>
        {error && <p id="strom-error" className={styles.error} role="alert">{error}</p>}
        <button type="submit" className={styles.primaryButton}>Jetzt Stromtarife vergleichen</button>
        <p className={styles.formFootnote}>Ohne E-Mail oder Telefonnummer starten.</p>
        <p className={styles.dataNotice}>Mit dem Start wird der CHECK24-Rechner geladen und deine Eingabe an CHECK24 übermittelt. <a href="/datenschutz">Datenschutz</a></p>
      </form>
      <div className={styles.cardPartner}><span>Vergleichstechnologie von</span><strong>CHECK24</strong></div>
    </div>
    {comparisonUrl && <div className={styles.resultWrap} ref={resultRef} tabIndex={-1}><ComparisonFrame key={comparisonUrl} url={comparisonUrl} onEdit={() => {
      setComparisonUrl(null)
      startRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      plzRef.current?.focus({ preventScroll: true })
    }} /></div>}
  </>
}
