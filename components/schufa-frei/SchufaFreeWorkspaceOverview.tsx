import { translateCaseStatus } from "@/lib/caseStatus"
import { getSkagStatusMeta } from "@/lib/skag/status"
import { getSchufaFreeProvisionStatusLabel, isSchufaFreeProvisionPaid } from "@/lib/schufa-frei/provisionInvoice"

type SyncRow = {
  skag_credit_id?: string | null
  last_status_alias?: string | null
  last_status_description?: string | null
  last_submit_at?: string | null
  last_document_upload_at?: string | null
  postident_url?: string | null
  postident_added_at?: string | null
  postident_notified_at?: string | null
} | null

type InvoiceRow = {
  id: string
  status?: string | null
  sent_at?: string | null
  paid_at?: string | null
  refunded_at?: string | null
} | null

type PushRow = {
  status_alias?: string | null
  status_description?: string | null
  created_at?: string | null
}

type RequestRow = {
  id: string
  required?: boolean | null
}

type DocumentRow = {
  request_id?: string | null
}

type SignatureField = {
  owner?: "advisor" | "customer" | string | null
}

type SignatureRow = {
  status?: string | null
  requires_wet_signature?: boolean | null
  advisor_signed_at?: string | null
  customer_signed_at?: string | null
  fields?: SignatureField[] | null
}

function hasAdvisorFields(fields: SignatureField[] | null | undefined) {
  return (fields ?? []).some((field) => String(field?.owner ?? "").trim().toLowerCase() !== "customer")
}

function hasCustomerFields(fields: SignatureField[] | null | undefined) {
  return (fields ?? []).some((field) => String(field?.owner ?? "").trim().toLowerCase() === "customer")
}

function isSignatureCompleted(item: SignatureRow) {
  if (String(item.status ?? "").trim().toLowerCase() === "completed") return true
  const advisorRequired = hasAdvisorFields(item.fields)
  const customerRequired = hasCustomerFields(item.fields) || Boolean(item.requires_wet_signature)
  return (!advisorRequired || Boolean(item.advisor_signed_at)) && (!customerRequired || Boolean(item.customer_signed_at))
}

function stepState(current: number, step: number, complete: boolean) {
  if (complete) return "done"
  if (current === step) return "current"
  return "upcoming"
}

function stepBadgeClass(state: "done" | "current" | "upcoming") {
  if (state === "done") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (state === "current") return "border-slate-900 bg-slate-900 text-white"
  return "border-slate-200 bg-white text-slate-600"
}

export default function SchufaFreeWorkspaceOverview({
  mode,
  caseRef,
  caseStatus,
  sync,
  invoice,
  pushEvents,
  requests,
  documents,
  signatures,
  chatCount,
  counterpartName,
}: {
  mode: "customer" | "advisor"
  caseRef: string | null
  caseStatus: string | null | undefined
  sync: SyncRow
  invoice: InvoiceRow
  pushEvents: PushRow[]
  requests: RequestRow[]
  documents: DocumentRow[]
  signatures: SignatureRow[]
  chatCount: number
  counterpartName?: string | null
}) {
  const latestPush = pushEvents[0] ?? null
  const statusMeta =
    sync?.last_status_alias || latestPush?.status_alias
      ? getSkagStatusMeta(
          sync?.last_status_alias ?? latestPush?.status_alias,
          sync?.last_status_description ?? latestPush?.status_description
        )
      : null

  const requiredRequestIds = new Set(
    requests.filter((request) => Boolean(request.required)).map((request) => String(request.id ?? "").trim()).filter(Boolean)
  )
  const uploadedRequiredRequestIds = new Set(
    documents.map((document) => String(document.request_id ?? "").trim()).filter((requestId) => requiredRequestIds.has(requestId))
  )
  const openRequiredCount = Array.from(requiredRequestIds).filter((requestId) => !uploadedRequiredRequestIds.has(requestId)).length
  const completedSignatureCount = signatures.filter(isSignatureCompleted).length
  const openSignatureCount = Math.max(0, signatures.length - completedSignatureCount)

  const submittedToSkag = Boolean(sync?.skag_credit_id || sync?.last_submit_at)
  const normalizedAlias = String(sync?.last_status_alias ?? latestPush?.status_alias ?? "").trim().toLowerCase()
  const invoiceStatus = String(invoice?.status ?? "").trim().toLowerCase()
  const caseCancelled = String(caseStatus ?? "").trim().toLowerCase() === "cancelled" || invoiceStatus === "cancelled"
  const provisionRequested = Boolean(invoice?.id)
  const provisionPaid = isSchufaFreeProvisionPaid(invoiceStatus)
  const postidentLinkReady = Boolean(String(sync?.postident_url ?? "").trim())
  const payoutReached = normalizedAlias === "credit_payout" || String(caseStatus ?? "").trim().toLowerCase() === "completed"
  const postidentCompleted = normalizedAlias === "postident_successfully_completed" || payoutReached

  const currentStep =
    caseCancelled
      ? 4
      : !submittedToSkag
      ? 2
      : openRequiredCount > 0
        ? 3
        : !provisionPaid
          ? 4
          : signatures.length === 0 || openSignatureCount > 0
            ? 5
            : !postidentCompleted
              ? 6
              : 7

  const nextAction = caseCancelled ? (mode === "advisor" ? "Der Vorgang wurde storniert. Es sind keine weiteren Schritte mehr offen." : "Deine Kreditanfrage wurde storniert. Es sind keine weiteren Schritte mehr erforderlich.") : !submittedToSkag
    ? mode === "advisor"
      ? "Prüfen Sie die finalen Angaben und übermitteln Sie den Fall an SEPANA."
      : "Vervollständige deine finalen Angaben und sende den Antrag an SEPANA."
    : openRequiredCount > 0
      ? mode === "advisor"
        ? "Fordern Sie fehlende Unterlagen an oder prüfen Sie neue Uploads im Dokumentenbereich."
        : "Lade die noch fehlenden Unterlagen hoch, damit der Fall weiterbearbeitet werden kann."
      : !provisionPaid
        ? mode === "advisor"
          ? provisionRequested
            ? "Die Vorauszahlungsrechnung wurde versendet. Bestätigen Sie den Zahlungseingang, bevor der Vertrag freigegeben wird."
            : "Senden Sie jetzt die Vorauszahlungsrechnung. Erst nach bestätigtem Zahlungseingang geht der Fall in den Vertragsprozess."
          : provisionRequested
            ? "Es geht erst weiter, wenn die Vorauszahlung bei uns eingegangen ist."
            : "Wir bereiten gerade die Vorauszahlungsrechnung für den nächsten Schritt vor."
        : signatures.length === 0
          ? mode === "advisor"
            ? "Laden Sie jetzt den Kreditvertrag hoch und setzen Sie die Signatur- und Checkbox-Felder."
            : "Sobald dein Vertrag bereitsteht, erscheint er unten im Signaturbereich."
          : openSignatureCount > 0
            ? mode === "advisor"
              ? "Der Vertrag läuft aktuell im Signaturprozess. Behalten Sie Vertrag, Rückfragen und Chat im Blick."
              : "Dein Vertrag ist bereit. Prüfe das Dokument und unterschreibe es unten digital."
            : !postidentCompleted
              ? mode === "advisor"
                ? postidentLinkReady
                  ? "Der PostIdent-Link ist hinterlegt. Behalten Sie jetzt Legitimation und Auszahlung im Blick."
                  : "Hinterlegen Sie jetzt den PostIdent-Link aus dem SKAG-Partnerbereich und benachrichtigen Sie den Kunden."
                : postidentLinkReady
                  ? "Dein PostIdent-Link ist bereit. Die Legitimation läuft über unseren Partner SKAG Vertriebs GmbH. Öffne den Link unten im Dashboard und schließe den Schritt ab."
                  : "Dein Vertrag ist abgeschlossen. Als Nächstes hinterlegen wir hier deinen PostIdent-Link über unseren Partner SKAG Vertriebs GmbH."
              : payoutReached
                ? "Die Auszahlung wurde bestätigt. Alle wesentlichen Schritte sind abgeschlossen."
                : mode === "advisor"
                  ? "PostIdent ist abgeschlossen. Verfolgen Sie jetzt nur noch den weiteren SEPANA-Status bis zur Auszahlung."
                  : "PostIdent ist abgeschlossen. Wir informieren dich hier über den weiteren Weg bis zur Auszahlung."

  const stepItems = [
    {
      number: 1,
      title: "Vorprüfung",
      text: "Fall angelegt und Eingang bestätigt.",
      state: stepState(currentStep, 1, true),
    },
    {
      number: 2,
      title: "SEPANA",
      text: submittedToSkag ? "An SEPANA übermittelt." : "Finale Übermittlung steht aus.",
      state: stepState(currentStep, 2, submittedToSkag),
    },
    {
      number: 3,
      title: "Unterlagen",
      text:
        requiredRequestIds.size > 0
          ? `${requiredRequestIds.size - openRequiredCount}/${requiredRequestIds.size} Pflichtaufgaben erledigt`
          : `${documents.length} Dokumente im Fall`,
      state: stepState(currentStep, 3, submittedToSkag && openRequiredCount === 0),
    },
    {
      number: 4,
      title: "Vorauszahlung",
      text: caseCancelled ? "Storniert" : provisionPaid
        ? "Zahlung bestätigt"
        : provisionRequested
          ? getSchufaFreeProvisionStatusLabel(invoiceStatus)
          : mode === "advisor"
            ? "Rechnung noch nicht versendet"
            : "Wird vorbereitet",
      state: stepState(currentStep, 4, provisionPaid),
    },
    {
      number: 5,
      title: "Vertrag",
      text: caseCancelled ? "Nicht mehr relevant" :
        signatures.length > 0
          ? `${completedSignatureCount}/${signatures.length} Signaturvorgänge abgeschlossen`
          : mode === "advisor"
            ? "Kreditvertrag noch nicht angelegt"
            : "Vertrag wird vorbereitet",
      state: stepState(currentStep, 5, !caseCancelled && provisionPaid && signatures.length > 0 && openSignatureCount === 0),
    },
    {
      number: 6,
      title: "PostIdent",
      text: caseCancelled ? "Nicht mehr relevant" : postidentCompleted
        ? "Legitimation abgeschlossen"
        : postidentLinkReady
          ? mode === "advisor"
            ? "Link an Kunden übermittelt"
            : "Link im Dashboard verfügbar"
          : mode === "advisor"
            ? "Link noch nicht hinterlegt"
            : "Wird vorbereitet",
      state: stepState(currentStep, 6, postidentCompleted),
    },
    {
      number: 7,
      title: "Auszahlung",
      text: caseCancelled ? "Storniert" : payoutReached ? "Ausgezahlt" : statusMeta?.title ?? translateCaseStatus(caseStatus),
      state: stepState(currentStep, 7, payoutReached),
    },
  ] as const

  const summaryItems =
    mode === "advisor"
      ? [
          {
            label: "SEPANA Credit ID",
            value: sync?.skag_credit_id ?? "-",
            hint: "",
          },
          {
            label: "Offene Pflichtunterlagen",
            value: String(openRequiredCount),
            hint: "",
          },
          {
            label: "Vorauszahlung",
            value: caseCancelled ? "Storniert" : getSchufaFreeProvisionStatusLabel(invoiceStatus),
            hint: "",
          },
          {
            label: "Vertrag / Signatur",
            value: signatures.length ? `${completedSignatureCount}/${signatures.length} erledigt` : "Noch nicht gestartet",
            hint: "",
          },
          {
            label: "PostIdent",
            value: payoutReached
              ? "Ausgezahlt"
              : postidentCompleted
                ? "Abgeschlossen"
                : postidentLinkReady
                  ? "Link hinterlegt"
                  : "Noch offen",
            hint: "",
          },
          {
            label: "Chat",
            value: `${chatCount} Nachrichten`,
            hint: "",
          },
        ]
      : [
          {
            label: "Unterlagen",
            value:
              caseCancelled
                ? "Vorgang storniert"
                : requiredRequestIds.size > 0
                ? `${uploadedRequiredRequestIds.size}/${requiredRequestIds.size} erledigt`
                : `${documents.length} Dokumente hochgeladen`,
            hint:
              caseCancelled
                ? "Es sind keine weiteren Uploads mehr erforderlich."
                : openRequiredCount > 0
                ? `${openRequiredCount} Pflichtunterlagen fehlen noch.`
                : "Alle aktuell angeforderten Unterlagen liegen vor.",
          },
          {
            label: "Vorauszahlung",
            value: caseCancelled ? "Storniert" : getSchufaFreeProvisionStatusLabel(invoiceStatus),
            hint: caseCancelled ? "Die Rechnung wurde aufgehoben und die Kreditanfrage beendet." : !provisionRequested
              ? "Sobald alle Unterlagen geprüft sind, erscheint hier die nächste Freigabe."
              : provisionPaid
                ? "Zahlung bestätigt. Der Fall geht jetzt in den Vertragsbereich."
                : "Es geht weiter, sobald der Zahlungseingang bestätigt ist.",
          },
          {
            label: "Vertrag",
            value: caseCancelled ? "Nicht mehr relevant" : !provisionPaid
              ? "Wartet auf Vorauszahlung"
              : signatures.length === 0
                ? "Wird vorbereitet"
                : openSignatureCount > 0
                  ? `${completedSignatureCount}/${signatures.length} Schritte erledigt`
                  : "Abgeschlossen",
            hint: caseCancelled ? "Der Vertragsprozess wurde mit der Stornierung beendet." : !provisionPaid
              ? "Der Vertrag wird erst nach bestätigter Vorauszahlung freigeschaltet."
              : signatures.length === 0
                ? "Ihr Berater bereitet den Vertrag für Sie vor."
                : openSignatureCount > 0
                  ? "Prüfen Sie den Vertrag und unterschreiben Sie digital."
                  : "Der Vertrag ist unterschrieben.",
          },
          {
            label: "PostIdent",
            value: caseCancelled ? "Nicht mehr relevant" : payoutReached
              ? "Ausgezahlt"
              : postidentCompleted
                ? "Abgeschlossen"
                : postidentLinkReady
                  ? "Link ist bereit"
                  : "Wird vorbereitet",
            hint: caseCancelled ? "Mit der Stornierung entfaellt auch der weitere Legitimationprozess." : payoutReached
              ? "Die wesentlichen Schritte sind abgeschlossen."
              : postidentCompleted
                ? "Die Legitimation ist erledigt."
                : postidentLinkReady
                  ? "Ihr Link liegt im Fall bereit und führt zur Legitimation über unseren Partner SKAG Vertriebs GmbH."
                  : "Der Link über unseren Partner SKAG Vertriebs GmbH folgt nach dem Vertragsabschluss.",
          },
        ]

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_right,rgba(14,165,233,0.14),transparent_26%),linear-gradient(135deg,#f8fafc,#ffffff)] p-5 shadow-sm sm:rounded-[36px] sm:p-7">
      <div className="pointer-events-none absolute -right-12 top-0 h-36 w-36 rounded-full bg-cyan-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-emerald-100/70 blur-3xl" />

      <div className="relative space-y-5">
        {mode === "advisor" ? (
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                SEPANA Berater-Workspace - Kredit ohne Schufa
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Fall {caseRef || "Schufa-frei"} im klaren Ablauf von Unterlagen bis Auszahlung.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Diese Ansicht bündelt Status, Dokumente, Vorauszahlung, Vertrag, PostIdent und Auszahlung in einem klaren operativen Ablauf.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Aktueller Status</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{statusMeta?.title ?? translateCaseStatus(caseStatus)}</div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600">
                  {statusMeta?.advisorMessage ?? statusMeta?.customerMessage ?? "Der Fall wird aktuell bearbeitet."}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Nächster Schritt</div>
                <div className="mt-2 text-sm font-semibold leading-relaxed">{nextAction}</div>
                {counterpartName ? (
                  <div className="mt-3 text-xs text-slate-300">
                    Kunde: <span className="font-semibold text-white">{counterpartName}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[26px] border border-slate-200/80 bg-white/88 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ihr weiterer Ablauf</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">So geht es jetzt Schritt für Schritt weiter.</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Unterlagen, Vorauszahlung, Vertrag, PostIdent und Auszahlung werden hier ruhig und nacheinander angezeigt.
                </p>
                {counterpartName ? (
                  <div className="mt-3 text-sm text-slate-600">
                    Ihr Ansprechpartner: <span className="font-semibold text-slate-900">{counterpartName}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white shadow-sm lg:max-w-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Nächster Schritt</div>
                <div className="mt-2 text-sm font-semibold leading-relaxed">{nextAction}</div>
              </div>
            </div>
          </div>
        )}

        <div
          className={
            mode === "advisor"
              ? "grid gap-3 md:grid-cols-2 xl:grid-cols-6"
              : "grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          }
        >
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
              {item.hint ? <div className="mt-2 text-xs leading-relaxed text-slate-500">{item.hint}</div> : null}
            </div>
          ))}
        </div>

        {mode === "advisor" ? (
          <div className="grid gap-3 xl:grid-cols-7">
            {stepItems.map((item) => (
              <div key={item.number} className={`rounded-2xl border px-4 py-4 shadow-sm ${stepBadgeClass(item.state)}`}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">Schritt {item.number}</div>
                <div className="mt-2 text-base font-semibold">{item.title}</div>
                <div className="mt-2 text-sm leading-relaxed opacity-90">{item.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stepItems.map((item) => (
              <div
                key={item.number}
                className={`rounded-2xl border px-4 py-4 shadow-sm ${stepBadgeClass(item.state)} min-h-[132px]`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/70 text-sm font-semibold">
                    {item.number}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">Schritt {item.number}</div>
                    <div className="mt-1 text-base font-semibold">{item.title}</div>
                    <div className="mt-2 text-sm leading-relaxed opacity-90">{item.text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { href: "#schufa-dokumente", label: "Dokumente" },
            { href: "#schufa-vorauszahlung", label: "Vorauszahlung" },
            { href: "#schufa-signatur", label: "Vertrag & Signatur" },
            { href: "#schufa-postident", label: "PostIdent" },
            { href: "#schufa-chat", label: "Chat" },
          ].map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
            >
              {anchor.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
