import type { SupabaseClient } from "@supabase/supabase-js"
import { loadEuropaceCaseDraft } from "@/lib/europace/case"
import { getEuropaceConfig, hasEuropaceConfig } from "@/lib/europace/config"
import { exportEuropaceVorgang } from "@/lib/europace/export"
import { importEuropaceVorgang } from "@/lib/europace/import"
import { firstEuropaceApplication, syncCaseEuropaceSnapshot } from "@/lib/europace/status"
import {
  buildEuropaceBeschaeftigungPayload,
  buildEuropaceFinanzierungswunschPayload,
  buildEuropaceFinanzierungszweckPayload,
  buildEuropaceHerkunftPayload,
  buildEuropaceImmobiliePayloads,
  buildEuropaceKindPayloads,
  buildEuropaceLiabilityPayloads,
  buildEuropaceKontoverbindungPayload,
  buildEuropaceMietausgabePayload,
  buildEuropacePersonendatenPayload,
  buildEuropaceSecondaryBeschaeftigungPayload,
  buildEuropaceSecondaryHerkunftPayload,
  buildEuropaceSecondaryPersonendatenPayload,
  buildEuropaceSecondaryWohnsituationPayload,
  buildEuropaceWohnsituationPayload,
} from "@/lib/europace/mapper"
import type { EuropaceExportResult, EuropaceImportResult } from "@/lib/europace/types"
import {
  addEuropaceMietausgabe,
  addEuropaceKind,
  addEuropaceRatenkredit,
  addEuropaceDispositionskredit,
  addEuropaceImmobilie,
  addEuropaceKreditkarte,
  addEuropaceLeasing,
  addEuropaceSonstigeVerbindlichkeit,
  addEuropaceAntragsteller,
  deleteEuropaceKind,
  deleteEuropaceRatenkredit,
  deleteEuropaceDispositionskredit,
  deleteEuropaceImmobilie,
  deleteEuropaceKreditkarte,
  deleteEuropaceLeasing,
  deleteEuropaceSonstigeVerbindlichkeit,
  deleteEuropaceMietausgabe,
  deleteEuropaceAntragsteller,
  normalizeEuropaceMessages,
  updateEuropaceBearbeiter,
  updateEuropaceBeschaeftigung,
  updateEuropaceFinanzierungswunsch,
  updateEuropaceFinanzierungszweck,
  updateEuropaceHerkunft,
  updateEuropaceKontoverbindung,
  updateEuropaceMietausgabe,
  updateEuropacePersonendaten,
  updateEuropaceWohnsituation,
} from "@/lib/europace/update"

type MinimalSupabase = Pick<SupabaseClient, "from" | "storage">

export type EuropaceSyncStep = {
  step: string
  status: "applied" | "skipped"
  message?: string | null
  details?: string[] | null
}

function getApplicantId(
  snapshot:
    | EuropaceImportResult
    | EuropaceExportResult
    | {
        antragsteller1?: { id?: string | null } | null
        antragsteller2?: { id?: string | null } | null
        kundendaten?: {
          antragsteller1?: { id?: string | null } | null
          antragsteller2?: { id?: string | null } | null
        } | null
      }
    | null
    | undefined,
  number: 1 | 2
) {
  const key = number === 1 ? "antragsteller1" : "antragsteller2"
  const directSource = snapshot ? (snapshot as Record<string, { id?: string | null } | null | undefined>)[key] : null
  const direct = String(directSource?.id ?? "").trim()
  if (direct) return direct
  const nestedSource = snapshot?.kundendaten
    ? (snapshot.kundendaten as Record<string, { id?: string | null } | null | undefined>)[key]
    : null
  const nested = String(nestedSource?.id ?? "").trim()
  return nested || null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function withEuropacePermissionHint(message: string) {
  if (!message.toLowerCase().includes("insufficient permissions")) {
    return message
  }

  try {
    const config = getEuropaceConfig()
    if (!trimOrNull(config.clientPartnerId)) {
      return `${message} Hinweis: EUROPACE_CLIENT_PARTNER_ID fehlt; OAuth-Impersonation ist dadurch deaktiviert. Wenn der Client auf einer Organisationsplakette liegt, muss EUROPACE_CLIENT_PARTNER_ID auf den Client-Actor gesetzt werden.`
    }
  } catch {
    return message
  }

  return message
}

function hasSecondaryApplicantIdentity(
  applicant:
    | {
        firstName?: string | null
        lastName?: string | null
      }
    | null
    | undefined
) {
  return Boolean(trimOrNull(applicant?.firstName) && trimOrNull(applicant?.lastName))
}

function hasPayload(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0
  return true
}

async function logSyncEvent(admin: MinimalSupabase, input: {
  caseId: string
  direction: "outbound" | "inbound"
  operation: string
  requestPayload?: unknown
  responsePayload?: unknown
  success: boolean
  errorMessage?: string | null
}) {
  await admin.from("case_europace_sync_events").insert({
    case_id: input.caseId,
    direction: input.direction,
    operation: input.operation,
    request_payload: input.requestPayload ?? null,
    response_payload: input.responsePayload ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
  })
}

async function upsertCaseEuropaceFromImport(
  admin: MinimalSupabase,
  caseId: string,
  importResult: EuropaceImportResult,
  importPayload: Record<string, unknown>
) {
  const config = getEuropaceConfig()
  const now = new Date().toISOString()
  const vorgangsnummer = String(importResult.vorgangsnummer ?? "").trim() || null
  if (!vorgangsnummer) {
    throw new Error("Europace Import lieferte keine vorgangsnummer zurueck.")
  }

  const { error } = await admin.from("case_europace").upsert(
    {
      case_id: caseId,
      vorgangsnummer,
      datenkontext: config.datenkontext,
      kundenbetreuer_partner_id: config.privatkreditPartnerId,
      bearbeiter_partner_id: config.privatkreditBearbeiterPartnerId,
      leadquelle: config.privatkreditLeadquelle,
      sync_status: "imported",
      last_sync_at: now,
      last_error: null,
      last_import_payload: importPayload,
      updated_at: now,
    },
    { onConflict: "case_id" }
  )
  if (error) throw error

  return vorgangsnummer
}

async function upsertApplicantMapping(
  admin: MinimalSupabase,
  caseId: string,
  caseApplicantId: string,
  antragstellerNummer: 1 | 2,
  europaceApplicantId: string | null | undefined
) {
  const applicantId = String(europaceApplicantId ?? "").trim()
  if (!applicantId) return
  const now = new Date().toISOString()
  const { error } = await admin.from("case_europace_applicants").upsert(
    {
      case_id: caseId,
      case_applicant_id: caseApplicantId,
      antragsteller_nummer: antragstellerNummer,
      europace_antragsteller_id: applicantId,
      last_sync_at: now,
      updated_at: now,
    },
    { onConflict: "case_id,antragsteller_nummer" }
  )
  if (error) throw error
}

async function deleteApplicantMapping(admin: MinimalSupabase, caseId: string, antragstellerNummer: 1 | 2) {
  const { error } = await admin
    .from("case_europace_applicants")
    .delete()
    .eq("case_id", caseId)
    .eq("antragsteller_nummer", antragstellerNummer)
  if (error) throw error
}

async function markEuropaceSyncError(admin: MinimalSupabase, caseId: string, message: string) {
  const now = new Date().toISOString()
  await admin.from("case_europace").upsert(
    {
      case_id: caseId,
      sync_status: "error",
      last_error: message,
      updated_at: now,
    },
    { onConflict: "case_id" }
  )
}

async function persistConfiguredPartnerIds(
  admin: MinimalSupabase,
  caseId: string,
  input: {
    kundenbetreuerPartnerId?: string | null
    bearbeiterPartnerId?: string | null
    leadquelle?: string | null
  }
) {
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    updated_at: now,
  }

  if (input.kundenbetreuerPartnerId !== undefined) {
    payload.kundenbetreuer_partner_id = trimOrNull(input.kundenbetreuerPartnerId)
  }
  if (input.bearbeiterPartnerId !== undefined) {
    payload.bearbeiter_partner_id = trimOrNull(input.bearbeiterPartnerId)
  }
  if (input.leadquelle !== undefined) {
    payload.leadquelle = trimOrNull(input.leadquelle)
  }

  const { error } = await admin
    .from("case_europace")
    .update(payload)
    .eq("case_id", caseId)
  if (error) throw error
}

async function applyUpdateStep<TPayload>(opts: {
  admin: MinimalSupabase
  localCaseId: string
  europaceCaseId: string
  step: string
  payload: TPayload | null
  run: (payload: TPayload) => Promise<unknown>
}) {
  if (!hasPayload(opts.payload)) {
    return {
      step: opts.step,
      status: "skipped" as const,
      message: "Keine passenden SEPANA-Daten vorhanden.",
      details: null,
    }
  }

  try {
    const response = await opts.run(opts.payload as TPayload)
    const messages = normalizeEuropaceMessages(response)
    await logSyncEvent(opts.admin, {
      caseId: opts.localCaseId,
      direction: "outbound",
      operation: opts.step,
      requestPayload: { vorgangsnummer: opts.europaceCaseId, payload: opts.payload },
      responsePayload: response,
      success: true,
    })

    return {
      step: opts.step,
      status: "applied" as const,
      message: messages.length ? messages.join(" | ") : null,
      details: messages.length ? messages : null,
    }
  } catch (error) {
    const message = withEuropacePermissionHint(error instanceof Error ? error.message : `${opts.step} failed`)
    await logSyncEvent(opts.admin, {
      caseId: opts.localCaseId,
      direction: "outbound",
      operation: opts.step,
      requestPayload: { vorgangsnummer: opts.europaceCaseId, payload: opts.payload },
      responsePayload: null,
      success: false,
      errorMessage: message,
    })
    throw new Error(`${opts.step}: ${message}`)
  }
}

async function ensureEuropaceBearbeiterState(
  admin: MinimalSupabase,
  caseId: string,
  europaceCaseId: string,
  snapshot: EuropaceExportResult,
  targetPartnerId: string | null
) {
  const currentBearbeiterPartnerId = trimOrNull(snapshot.bearbeiter?.partnerId)
  const currentKundenbetreuerPartnerId = trimOrNull(snapshot.kundenbetreuer?.partnerId)
  const nextBearbeiterPartnerId = trimOrNull(targetPartnerId)

  await persistConfiguredPartnerIds(admin, caseId, {
    kundenbetreuerPartnerId: currentKundenbetreuerPartnerId,
    bearbeiterPartnerId: currentBearbeiterPartnerId,
  })

  if (!nextBearbeiterPartnerId) {
    return {
      snapshot,
      step: {
        step: "updateBearbeiter",
        status: "skipped" as const,
        message: "Kein Bearbeiter-Partner konfiguriert.",
      },
    }
  }

  if (currentBearbeiterPartnerId === nextBearbeiterPartnerId) {
    return {
      snapshot,
      step: {
        step: "updateBearbeiter",
        status: "skipped" as const,
        message: `Bearbeiter bereits auf ${nextBearbeiterPartnerId}.`,
      },
    }
  }

  try {
    const response = await updateEuropaceBearbeiter({
      vorgangsnummer: europaceCaseId,
      partnerId: nextBearbeiterPartnerId,
    })

    await logSyncEvent(admin, {
      caseId,
      direction: "outbound",
      operation: "updateBearbeiter",
      requestPayload: {
        vorgangsnummer: europaceCaseId,
        partnerId: nextBearbeiterPartnerId,
        currentBearbeiterPartnerId,
        currentKundenbetreuerPartnerId,
      },
      responsePayload: response,
      success: true,
    })

    const refreshedSnapshot = await exportEuropaceVorgang(europaceCaseId)
    await syncCaseEuropaceSnapshot(admin, caseId, refreshedSnapshot)

    return {
      snapshot: refreshedSnapshot,
      step: {
        step: "updateBearbeiter",
        status: "applied" as const,
        message: `Bearbeiter auf ${nextBearbeiterPartnerId} gesetzt.`,
        details: normalizeEuropaceMessages(response),
      },
    }
  } catch (error) {
    const message = withEuropacePermissionHint(error instanceof Error ? error.message : "updateBearbeiter failed")
    await logSyncEvent(admin, {
      caseId,
      direction: "outbound",
      operation: "updateBearbeiter",
      requestPayload: {
        vorgangsnummer: europaceCaseId,
        partnerId: nextBearbeiterPartnerId,
        currentBearbeiterPartnerId,
        currentKundenbetreuerPartnerId,
      },
      responsePayload: null,
      success: false,
      errorMessage: message,
    })
    throw new Error(`updateBearbeiter: ${message}`)
  }
}

async function ensureSecondaryApplicantState(
  admin: MinimalSupabase,
  caseId: string,
  europaceCaseId: string,
  draft: Awaited<ReturnType<typeof loadEuropaceCaseDraft>>,
  snapshot: EuropaceExportResult
) {
  const localSecondary = hasSecondaryApplicantIdentity(draft.secondaryApplicant) ? draft.secondaryApplicant : null
  const remoteSecondaryId = getApplicantId(snapshot, 2)

  if (localSecondary && remoteSecondaryId) {
    await upsertApplicantMapping(admin, caseId, localSecondary.caseApplicantId, 2, remoteSecondaryId)
    return {
      snapshot,
      secondaryApplicantId: remoteSecondaryId,
      step: {
        step: "syncAntragsteller2",
        status: "skipped" as const,
        message: "Antragsteller 2 existiert bereits.",
      },
    }
  }

  if (localSecondary && !remoteSecondaryId) {
    const antragstellerPayload = {
      personendaten: buildEuropaceSecondaryPersonendatenPayload(draft) ?? {
        vorname: localSecondary.firstName,
        nachname: localSecondary.lastName,
      },
    }

    const response = await addEuropaceAntragsteller({
      vorgangsnummer: europaceCaseId,
      antragsteller: antragstellerPayload,
    })

    await logSyncEvent(admin, {
      caseId,
      direction: "outbound",
      operation: "addAntragsteller",
      requestPayload: { vorgangsnummer: europaceCaseId, antragsteller: antragstellerPayload },
      responsePayload: response,
      success: true,
    })

    const refreshedSnapshot = await exportEuropaceVorgang(europaceCaseId)
    await syncCaseEuropaceSnapshot(admin, caseId, refreshedSnapshot)
    const refreshedSecondaryId = getApplicantId(refreshedSnapshot, 2)
    if (!refreshedSecondaryId) {
      throw new Error("Europace hat Antragsteller 2 angelegt, aber keine antragsteller2.id geliefert.")
    }
    await upsertApplicantMapping(admin, caseId, localSecondary.caseApplicantId, 2, refreshedSecondaryId)

    return {
      snapshot: refreshedSnapshot,
      secondaryApplicantId: refreshedSecondaryId,
      step: {
        step: "syncAntragsteller2",
        status: "applied" as const,
        message: "Antragsteller 2 wurde in Europace angelegt.",
      },
    }
  }

  if (!localSecondary && remoteSecondaryId) {
    const response = await deleteEuropaceAntragsteller({
      vorgangsnummer: europaceCaseId,
      id: remoteSecondaryId,
    })

    await logSyncEvent(admin, {
      caseId,
      direction: "outbound",
      operation: "deleteAntragsteller",
      requestPayload: { vorgangsnummer: europaceCaseId, id: remoteSecondaryId },
      responsePayload: response,
      success: true,
    })

    await deleteApplicantMapping(admin, caseId, 2)
    const refreshedSnapshot = await exportEuropaceVorgang(europaceCaseId)
    await syncCaseEuropaceSnapshot(admin, caseId, refreshedSnapshot)

    return {
      snapshot: refreshedSnapshot,
      secondaryApplicantId: null,
      step: {
        step: "syncAntragsteller2",
        status: "applied" as const,
        message: "Antragsteller 2 wurde aus Europace entfernt.",
      },
    }
  }

  await deleteApplicantMapping(admin, caseId, 2)
  return {
    snapshot,
    secondaryApplicantId: null,
    step: {
      step: "syncAntragsteller2",
      status: "skipped" as const,
      message: "Kein synchronisierbarer Co-Antragsteller vorhanden.",
    },
  }
}

function firstMietausgabeId(snapshot: EuropaceExportResult | null | undefined) {
  const rows = Array.isArray(snapshot?.haushalt?.ausgaben?.mietausgaben) ? snapshot.haushalt?.ausgaben?.mietausgaben : []
  return trimOrNull(rows[0]?.id)
}

function kindIds(snapshot: EuropaceExportResult | null | undefined) {
  const rows = Array.isArray(snapshot?.haushalt?.kinder) ? snapshot.haushalt?.kinder : []
  return rows.map((row) => trimOrNull(row?.id)).filter(Boolean) as string[]
}

function liabilityIds(
  snapshot: EuropaceExportResult | null | undefined,
  key: "ratenkredite" | "sonstigeVerbindlichkeiten" | "kreditkarten" | "dispositionskredite" | "leasings"
) {
  const rows = Array.isArray(snapshot?.haushalt?.verbindlichkeiten?.[key])
    ? snapshot?.haushalt?.verbindlichkeiten?.[key]
    : []
  return rows.map((row) => trimOrNull(row?.id)).filter(Boolean) as string[]
}

function immobilieIds(snapshot: EuropaceExportResult | null | undefined) {
  const rows = Array.isArray(snapshot?.haushalt?.immobilien) ? snapshot.haushalt?.immobilien : []
  return rows.map((row) => trimOrNull(row?.id)).filter(Boolean) as string[]
}

async function syncEuropaceMietausgabeState(opts: {
  admin: MinimalSupabase
  localCaseId: string
  europaceCaseId: string
  snapshot: EuropaceExportResult
  payload: Record<string, unknown> | null
}) {
  const existingId = firstMietausgabeId(opts.snapshot)

  if (!hasPayload(opts.payload) && !existingId) {
    return {
      snapshot: opts.snapshot,
      step: {
        step: "syncMietausgabe",
        status: "skipped" as const,
        message: "Keine Mietausgabe zu synchronisieren.",
      },
    }
  }

  if (!hasPayload(opts.payload) && existingId) {
    try {
      const response = await deleteEuropaceMietausgabe({
        vorgangsnummer: opts.europaceCaseId,
        id: existingId,
      })
      await logSyncEvent(opts.admin, {
        caseId: opts.localCaseId,
        direction: "outbound",
        operation: "deleteMietausgabe",
        requestPayload: { vorgangsnummer: opts.europaceCaseId, id: existingId },
        responsePayload: response,
        success: true,
      })
      const refreshedSnapshot = await exportEuropaceVorgang(opts.europaceCaseId)
      await syncCaseEuropaceSnapshot(opts.admin, opts.localCaseId, refreshedSnapshot)
      return {
        snapshot: refreshedSnapshot,
        step: {
          step: "syncMietausgabe",
          status: "applied" as const,
          message: "Mietausgabe wurde in Europace entfernt.",
          details: normalizeEuropaceMessages(response),
        },
      }
    } catch (error) {
      const message = withEuropacePermissionHint(error instanceof Error ? error.message : "deleteMietausgabe failed")
      await logSyncEvent(opts.admin, {
        caseId: opts.localCaseId,
        direction: "outbound",
        operation: "deleteMietausgabe",
        requestPayload: { vorgangsnummer: opts.europaceCaseId, id: existingId },
        responsePayload: null,
        success: false,
        errorMessage: message,
      })
      throw new Error(`deleteMietausgabe: ${message}`)
    }
  }

  if (existingId && opts.payload) {
    return {
      snapshot: opts.snapshot,
      step: await applyUpdateStep({
        admin: opts.admin,
        localCaseId: opts.localCaseId,
        europaceCaseId: opts.europaceCaseId,
        step: "updateMietausgabe",
        payload: opts.payload,
        run: (payload) =>
          updateEuropaceMietausgabe({
            vorgangsnummer: opts.europaceCaseId,
            id: existingId,
            mietausgabe: payload as Record<string, unknown>,
          }),
      }),
    }
  }

  try {
    const response = await addEuropaceMietausgabe({
      vorgangsnummer: opts.europaceCaseId,
      mietausgabe: opts.payload as Record<string, unknown>,
    })
    await logSyncEvent(opts.admin, {
      caseId: opts.localCaseId,
      direction: "outbound",
      operation: "addMietausgabe",
      requestPayload: { vorgangsnummer: opts.europaceCaseId, mietausgabe: opts.payload },
      responsePayload: response,
      success: true,
    })
    const refreshedSnapshot = await exportEuropaceVorgang(opts.europaceCaseId)
    await syncCaseEuropaceSnapshot(opts.admin, opts.localCaseId, refreshedSnapshot)
    return {
      snapshot: refreshedSnapshot,
      step: {
        step: "syncMietausgabe",
        status: "applied" as const,
        message: "Mietausgabe wurde in Europace angelegt.",
        details: normalizeEuropaceMessages(response),
      },
    }
  } catch (error) {
    const message = withEuropacePermissionHint(error instanceof Error ? error.message : "addMietausgabe failed")
    await logSyncEvent(opts.admin, {
      caseId: opts.localCaseId,
      direction: "outbound",
      operation: "addMietausgabe",
      requestPayload: { vorgangsnummer: opts.europaceCaseId, mietausgabe: opts.payload },
      responsePayload: null,
      success: false,
      errorMessage: message,
    })
    throw new Error(`addMietausgabe: ${message}`)
  }
}

async function syncEuropaceKindState(opts: {
  admin: MinimalSupabase
  localCaseId: string
  europaceCaseId: string
  snapshot: EuropaceExportResult
  payloads: Array<Record<string, unknown>>
}) {
  const existingIds = kindIds(opts.snapshot)

  for (const id of existingIds) {
    const response = await deleteEuropaceKind({
      vorgangsnummer: opts.europaceCaseId,
      id,
    })

    await logSyncEvent(opts.admin, {
      caseId: opts.localCaseId,
      direction: "outbound",
      operation: "deleteKind",
      requestPayload: { vorgangsnummer: opts.europaceCaseId, id },
      responsePayload: response,
      success: true,
    })
  }

  for (const payload of opts.payloads) {
    const response = await addEuropaceKind({
      vorgangsnummer: opts.europaceCaseId,
      kind: payload,
    })

    await logSyncEvent(opts.admin, {
      caseId: opts.localCaseId,
      direction: "outbound",
      operation: "addKind",
      requestPayload: { vorgangsnummer: opts.europaceCaseId, kind: payload },
      responsePayload: response,
      success: true,
    })
  }

  return {
    step: {
      step: "syncKinder",
      status: existingIds.length || opts.payloads.length ? ("applied" as const) : ("skipped" as const),
      message:
        existingIds.length || opts.payloads.length
          ? `${opts.payloads.length} Kinder nach Europace gespiegelt.`
          : "Keine Kinder zu synchronisieren.",
    },
  }
}

async function syncEuropaceLiabilityState(opts: {
  admin: MinimalSupabase
  localCaseId: string
  europaceCaseId: string
  snapshot: EuropaceExportResult
  payloads: ReturnType<typeof buildEuropaceLiabilityPayloads>
}) {
  const configs = [
    {
      exportKey: "ratenkredite" as const,
      deleteOperation: "deleteRatenkredit",
      addOperation: "addRatenkredit",
      payloads: opts.payloads.ratenkredit,
      remove: (id: string) => deleteEuropaceRatenkredit({ vorgangsnummer: opts.europaceCaseId, id }),
      add: (payload: Record<string, unknown>) => addEuropaceRatenkredit({ vorgangsnummer: opts.europaceCaseId, ratenkredit: payload }),
    },
    {
      exportKey: "dispositionskredite" as const,
      deleteOperation: "deleteDispositionskredit",
      addOperation: "addDispositionskredit",
      payloads: opts.payloads.dispositionskredit,
      remove: (id: string) => deleteEuropaceDispositionskredit({ vorgangsnummer: opts.europaceCaseId, id }),
      add: (payload: Record<string, unknown>) =>
        addEuropaceDispositionskredit({ vorgangsnummer: opts.europaceCaseId, dispositionskredit: payload }),
    },
    {
      exportKey: "kreditkarten" as const,
      deleteOperation: "deleteKreditkarte",
      addOperation: "addKreditkarte",
      payloads: opts.payloads.kreditkarte,
      remove: (id: string) => deleteEuropaceKreditkarte({ vorgangsnummer: opts.europaceCaseId, id }),
      add: (payload: Record<string, unknown>) => addEuropaceKreditkarte({ vorgangsnummer: opts.europaceCaseId, kreditkarte: payload }),
    },
    {
      exportKey: "leasings" as const,
      deleteOperation: "deleteLeasing",
      addOperation: "addLeasing",
      payloads: opts.payloads.privates_leasing,
      remove: (id: string) => deleteEuropaceLeasing({ vorgangsnummer: opts.europaceCaseId, id }),
      add: (payload: Record<string, unknown>) => addEuropaceLeasing({ vorgangsnummer: opts.europaceCaseId, leasing: payload }),
    },
    {
      exportKey: "sonstigeVerbindlichkeiten" as const,
      deleteOperation: "deleteSonstigeVerbindlichkeit",
      addOperation: "addSonstigeVerbindlichkeit",
      payloads: opts.payloads.sonstige_verbindlichkeit,
      remove: (id: string) => deleteEuropaceSonstigeVerbindlichkeit({ vorgangsnummer: opts.europaceCaseId, id }),
      add: (payload: Record<string, unknown>) =>
        addEuropaceSonstigeVerbindlichkeit({ vorgangsnummer: opts.europaceCaseId, sonstigeVerbindlichkeit: payload }),
    },
  ]

  let deletedCount = 0
  let addedCount = 0

  for (const config of configs) {
    const existingIds = liabilityIds(opts.snapshot, config.exportKey)

    for (const id of existingIds) {
      try {
        const response = await config.remove(id)
        await logSyncEvent(opts.admin, {
          caseId: opts.localCaseId,
          direction: "outbound",
          operation: config.deleteOperation,
          requestPayload: { vorgangsnummer: opts.europaceCaseId, id },
          responsePayload: response,
          success: true,
        })
        deletedCount += 1
      } catch (error) {
        const message = withEuropacePermissionHint(error instanceof Error ? error.message : `${config.deleteOperation} failed`)
        await logSyncEvent(opts.admin, {
          caseId: opts.localCaseId,
          direction: "outbound",
          operation: config.deleteOperation,
          requestPayload: { vorgangsnummer: opts.europaceCaseId, id },
          responsePayload: null,
          success: false,
          errorMessage: message,
        })
        throw new Error(`${config.deleteOperation}: ${message}`)
      }
    }

    for (const payload of config.payloads) {
      try {
        const response = await config.add(payload)
        await logSyncEvent(opts.admin, {
          caseId: opts.localCaseId,
          direction: "outbound",
          operation: config.addOperation,
          requestPayload: { vorgangsnummer: opts.europaceCaseId, payload },
          responsePayload: response,
          success: true,
        })
        addedCount += 1
      } catch (error) {
        const message = withEuropacePermissionHint(error instanceof Error ? error.message : `${config.addOperation} failed`)
        await logSyncEvent(opts.admin, {
          caseId: opts.localCaseId,
          direction: "outbound",
          operation: config.addOperation,
          requestPayload: { vorgangsnummer: opts.europaceCaseId, payload },
          responsePayload: null,
          success: false,
          errorMessage: message,
        })
        throw new Error(`${config.addOperation}: ${message}`)
      }
    }
  }

  return {
    step: {
      step: "syncVerbindlichkeiten",
      status: deletedCount || addedCount ? ("applied" as const) : ("skipped" as const),
      message:
        deletedCount || addedCount
          ? `${addedCount} Verbindlichkeiten nach Europace gespiegelt.`
          : "Keine Verbindlichkeiten zu synchronisieren.",
    },
  }
}

async function syncEuropaceImmobilieState(opts: {
  admin: MinimalSupabase
  localCaseId: string
  europaceCaseId: string
  snapshot: EuropaceExportResult
  payloads: Array<Record<string, unknown>>
}) {
  const existingIds = immobilieIds(opts.snapshot)
  let deletedCount = 0
  let addedCount = 0

  for (const id of existingIds) {
    try {
      const response = await deleteEuropaceImmobilie({
        vorgangsnummer: opts.europaceCaseId,
        id,
      })
      await logSyncEvent(opts.admin, {
        caseId: opts.localCaseId,
        direction: "outbound",
        operation: "deleteImmobilie",
        requestPayload: { vorgangsnummer: opts.europaceCaseId, id },
        responsePayload: response,
        success: true,
      })
      deletedCount += 1
    } catch (error) {
      const message = withEuropacePermissionHint(error instanceof Error ? error.message : "deleteImmobilie failed")
      await logSyncEvent(opts.admin, {
        caseId: opts.localCaseId,
        direction: "outbound",
        operation: "deleteImmobilie",
        requestPayload: { vorgangsnummer: opts.europaceCaseId, id },
        responsePayload: null,
        success: false,
        errorMessage: message,
      })
      throw new Error(`deleteImmobilie: ${message}`)
    }
  }

  for (const payload of opts.payloads) {
    try {
      const response = await addEuropaceImmobilie({
        vorgangsnummer: opts.europaceCaseId,
        immobilie: payload,
      })
      await logSyncEvent(opts.admin, {
        caseId: opts.localCaseId,
        direction: "outbound",
        operation: "addImmobilie",
        requestPayload: { vorgangsnummer: opts.europaceCaseId, payload },
        responsePayload: response,
        success: true,
      })
      addedCount += 1
    } catch (error) {
      const message = withEuropacePermissionHint(error instanceof Error ? error.message : "addImmobilie failed")
      await logSyncEvent(opts.admin, {
        caseId: opts.localCaseId,
        direction: "outbound",
        operation: "addImmobilie",
        requestPayload: { vorgangsnummer: opts.europaceCaseId, payload },
        responsePayload: null,
        success: false,
        errorMessage: message,
      })
      throw new Error(`addImmobilie: ${message}`)
    }
  }

  return {
    step: {
      step: "syncImmobilien",
      status: deletedCount || addedCount ? ("applied" as const) : ("skipped" as const),
      message:
        deletedCount || addedCount
          ? `${addedCount} Immobilien nach Europace gespiegelt.`
          : "Keine Immobilien zu synchronisieren.",
    },
  }
}

export async function syncEuropaceCase(admin: MinimalSupabase, caseId: string) {
  if (!hasEuropaceConfig()) {
    throw new Error("Europace-Konfiguration fehlt. Bitte EUROPACE_* Variablen setzen.")
  }

  const config = getEuropaceConfig()
  const draft = await loadEuropaceCaseDraft(admin, caseId)
  const steps: EuropaceSyncStep[] = []

  try {
    const { data: existingMapping, error: mappingError } = await admin
      .from("case_europace")
      .select("case_id,vorgangsnummer")
      .eq("case_id", caseId)
      .maybeSingle()
    if (mappingError) throw mappingError

    let europaceCaseId = String(existingMapping?.vorgangsnummer ?? "").trim() || null

    if (!europaceCaseId) {
      const importPayload = {
        kundenbetreuer: {
          partnerId: config.privatkreditPartnerId,
        },
        ...(config.privatkreditBearbeiterPartnerId
          ? {
              bearbeiter: {
                partnerId: config.privatkreditBearbeiterPartnerId,
              },
            }
          : {}),
        ...(config.privatkreditLeadquelle
          ? {
              leadquelle: config.privatkreditLeadquelle,
            }
          : {}),
        antragsteller1: {
          personendaten: {
            vorname: draft.primaryApplicant.firstName,
            nachname: draft.primaryApplicant.lastName,
          },
        },
      }

      const imported = await importEuropaceVorgang({
        partnerId: config.privatkreditPartnerId,
        bearbeiterPartnerId: config.privatkreditBearbeiterPartnerId,
        leadquelle: config.privatkreditLeadquelle,
        firstName: draft.primaryApplicant.firstName,
        lastName: draft.primaryApplicant.lastName,
      })

      europaceCaseId = await upsertCaseEuropaceFromImport(admin, caseId, imported, importPayload)
      await upsertApplicantMapping(admin, caseId, draft.primaryApplicant.caseApplicantId, 1, getApplicantId(imported, 1))
      await logSyncEvent(admin, {
        caseId,
        direction: "outbound",
        operation: "importVorgang",
        requestPayload: {
          url: config.importUrl,
          datenkontext: config.datenkontext,
          payload: importPayload,
        },
        responsePayload: imported,
        success: true,
      })
      steps.push({
        step: "importVorgang",
        status: "applied",
        message: europaceCaseId,
      })
    } else {
      steps.push({
        step: "importVorgang",
        status: "skipped",
        message: "Vorgang existiert bereits.",
      })
    }

    await persistConfiguredPartnerIds(admin, caseId, {
      kundenbetreuerPartnerId: config.privatkreditPartnerId,
      bearbeiterPartnerId: config.privatkreditBearbeiterPartnerId,
      leadquelle: config.privatkreditLeadquelle,
    })

    const exportedBefore = await exportEuropaceVorgang(europaceCaseId)
    await syncCaseEuropaceSnapshot(admin, caseId, exportedBefore)
    const bearbeiterState = await ensureEuropaceBearbeiterState(
      admin,
      caseId,
      europaceCaseId,
      exportedBefore,
      config.privatkreditBearbeiterPartnerId
    )
    steps.push(bearbeiterState.step)

    const preparedBeforeUpdates = bearbeiterState.snapshot
    const primaryApplicantId = getApplicantId(preparedBeforeUpdates, 1)
    if (!primaryApplicantId) {
      throw new Error("Europace lieferte keine antragsteller1.id zurueck.")
    }
    await upsertApplicantMapping(admin, caseId, draft.primaryApplicant.caseApplicantId, 1, primaryApplicantId)
    const secondaryState = await ensureSecondaryApplicantState(admin, caseId, europaceCaseId, draft, preparedBeforeUpdates)
    const preparedSnapshot = secondaryState.snapshot
    const secondaryApplicantId = secondaryState.secondaryApplicantId
    await logSyncEvent(admin, {
      caseId,
      direction: "inbound",
      operation: "exportVorgang.beforeUpdates",
      requestPayload: { vorgangsnummer: europaceCaseId },
      responsePayload: preparedSnapshot,
      success: true,
    })
    steps.push(secondaryState.step)

    steps.push(
      await applyUpdateStep({
        admin,
        localCaseId: caseId,
        europaceCaseId,
        step: "updatePersonendaten",
        payload: buildEuropacePersonendatenPayload(draft),
        run: (payload) =>
          updateEuropacePersonendaten({
            vorgangsnummer: europaceCaseId as string,
            antragstellerId: primaryApplicantId,
            personendaten: payload as Record<string, unknown>,
        }),
      })
    )

    if (secondaryApplicantId && draft.secondaryApplicant) {
      steps.push(
        await applyUpdateStep({
          admin,
          localCaseId: caseId,
          europaceCaseId,
          step: "updatePersonendaten.antragsteller2",
          payload: buildEuropaceSecondaryPersonendatenPayload(draft),
          run: (payload) =>
            updateEuropacePersonendaten({
              vorgangsnummer: europaceCaseId as string,
              antragstellerId: secondaryApplicantId,
              personendaten: payload as Record<string, unknown>,
            }),
        })
      )

      steps.push(
        await applyUpdateStep({
          admin,
          localCaseId: caseId,
          europaceCaseId,
          step: "updateBeschaeftigung.antragsteller2",
          payload: buildEuropaceSecondaryBeschaeftigungPayload(draft),
          run: (payload) =>
            updateEuropaceBeschaeftigung({
              vorgangsnummer: europaceCaseId as string,
              antragstellerId: secondaryApplicantId,
              beschaeftigung: payload as Record<string, unknown>,
            }),
        })
      )

      steps.push(
        await applyUpdateStep({
          admin,
          localCaseId: caseId,
          europaceCaseId,
          step: "updateHerkunft.antragsteller2",
          payload: buildEuropaceSecondaryHerkunftPayload(draft),
          run: (payload) =>
            updateEuropaceHerkunft({
              vorgangsnummer: europaceCaseId as string,
              antragstellerId: secondaryApplicantId,
              herkunft: payload as Record<string, unknown>,
            }),
        })
      )

      steps.push(
        await applyUpdateStep({
          admin,
          localCaseId: caseId,
          europaceCaseId,
          step: "updateWohnsituation.antragsteller2",
          payload: buildEuropaceSecondaryWohnsituationPayload(draft),
          run: (payload) =>
            updateEuropaceWohnsituation({
              vorgangsnummer: europaceCaseId as string,
              antragstellerId: secondaryApplicantId,
              wohnsituation: payload as Record<string, unknown>,
            }),
        })
      )
    }

    steps.push(
      await applyUpdateStep({
        admin,
        localCaseId: caseId,
        europaceCaseId,
        step: "updateHerkunft",
        payload: buildEuropaceHerkunftPayload(draft),
        run: (payload) =>
          updateEuropaceHerkunft({
            vorgangsnummer: europaceCaseId as string,
            antragstellerId: primaryApplicantId,
            herkunft: payload as Record<string, unknown>,
          }),
      })
    )

    const mietausgabeState = await syncEuropaceMietausgabeState({
      admin,
      localCaseId: caseId,
      europaceCaseId,
      snapshot: preparedSnapshot,
      payload: buildEuropaceMietausgabePayload(
        draft,
        [primaryApplicantId, secondaryApplicantId].filter(Boolean) as string[]
      ),
    })
    steps.push(mietausgabeState.step)

    const kindState = await syncEuropaceKindState({
      admin,
      localCaseId: caseId,
      europaceCaseId,
      snapshot: preparedSnapshot,
      payloads: buildEuropaceKindPayloads(draft, {
        primaryApplicantId,
        secondaryApplicantId,
      }),
    })
    steps.push(kindState.step)

    steps.push(
      await applyUpdateStep({
        admin,
        localCaseId: caseId,
        europaceCaseId,
        step: "updateWohnsituation",
        payload: buildEuropaceWohnsituationPayload(draft),
        run: (payload) =>
          updateEuropaceWohnsituation({
            vorgangsnummer: europaceCaseId as string,
            antragstellerId: primaryApplicantId,
            wohnsituation: payload as Record<string, unknown>,
          }),
      })
    )

    steps.push(
      await applyUpdateStep({
        admin,
        localCaseId: caseId,
        europaceCaseId,
        step: "updateBeschaeftigung",
        payload: buildEuropaceBeschaeftigungPayload(draft),
        run: (payload) =>
          updateEuropaceBeschaeftigung({
            vorgangsnummer: europaceCaseId as string,
            antragstellerId: primaryApplicantId,
            beschaeftigung: payload as Record<string, unknown>,
          }),
      })
    )

    steps.push(
      await applyUpdateStep({
        admin,
        localCaseId: caseId,
        europaceCaseId,
        step: "updateKontoverbindung",
        payload: buildEuropaceKontoverbindungPayload(draft, primaryApplicantId),
        run: (payload) =>
          updateEuropaceKontoverbindung({
            vorgangsnummer: europaceCaseId as string,
            kontoverbindung: payload as Record<string, unknown>,
          }),
      })
    )

    steps.push(
      await applyUpdateStep({
        admin,
        localCaseId: caseId,
        europaceCaseId,
        step: "updateFinanzierungszweck",
        payload: buildEuropaceFinanzierungszweckPayload(draft),
        run: (payload) =>
          updateEuropaceFinanzierungszweck({
            vorgangsnummer: europaceCaseId as string,
            finanzierungszweck: payload as string,
          }),
      })
    )

    steps.push(
      await applyUpdateStep({
        admin,
        localCaseId: caseId,
        europaceCaseId,
        step: "updateFinanzierungswunsch",
        payload: buildEuropaceFinanzierungswunschPayload(draft),
        run: (payload) =>
          updateEuropaceFinanzierungswunsch({
            vorgangsnummer: europaceCaseId as string,
            finanzierungswunsch: payload as Record<string, unknown>,
        }),
      })
    )

    const liabilityState = await syncEuropaceLiabilityState({
      admin,
      localCaseId: caseId,
      europaceCaseId,
      snapshot: preparedSnapshot,
      payloads: buildEuropaceLiabilityPayloads(draft, {
        primaryApplicantId,
        secondaryApplicantId,
      }),
    })
    steps.push(liabilityState.step)

    const immobilieState = await syncEuropaceImmobilieState({
      admin,
      localCaseId: caseId,
      europaceCaseId,
      snapshot: preparedSnapshot,
      payloads: buildEuropaceImmobiliePayloads(draft, {
        primaryApplicantId,
        secondaryApplicantId,
      }),
    })
    steps.push(immobilieState.step)

    const exportedAfter = await exportEuropaceVorgang(europaceCaseId)
    await syncCaseEuropaceSnapshot(admin, caseId, exportedAfter)
    await upsertApplicantMapping(admin, caseId, draft.primaryApplicant.caseApplicantId, 1, getApplicantId(exportedAfter, 1))
    if (draft.secondaryApplicant && getApplicantId(exportedAfter, 2)) {
      await upsertApplicantMapping(admin, caseId, draft.secondaryApplicant.caseApplicantId, 2, getApplicantId(exportedAfter, 2))
    } else {
      await deleteApplicantMapping(admin, caseId, 2)
    }
    await logSyncEvent(admin, {
      caseId,
      direction: "inbound",
      operation: "exportVorgang.afterUpdates",
      requestPayload: { vorgangsnummer: europaceCaseId },
      responsePayload: exportedAfter,
      success: true,
    })

    return {
      ok: true as const,
      europaceCaseId,
      exportSnapshot: exportedAfter,
      primaryApplicantId: getApplicantId(exportedAfter, 1),
      application: firstEuropaceApplication(exportedAfter),
      steps,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace sync failed"
    await markEuropaceSyncError(admin, caseId, message)
    await logSyncEvent(admin, {
      caseId,
      direction: "outbound",
      operation: "syncEuropaceCase",
      requestPayload: { caseId },
      responsePayload: { steps },
      success: false,
      errorMessage: message,
    })
    throw error
  }
}
