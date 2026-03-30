import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Onlinekredit Antrag | SEPANA",
  robots: { index: false, follow: false },
}

type PageSearchParams = {
  caseId?: string
  caseRef?: string
  access?: string
  existing?: string
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function parseBoolParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

export default async function OnlinekreditApplicationPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  const caseId = trimOrNull(sp.caseId)
  const caseRef = trimOrNull(sp.caseRef)
  const accessToken = trimOrNull(sp.access)
  const existingAccount = parseBoolParam(sp.existing)
  if (caseId) params.set("caseId", caseId)
  if (caseRef) params.set("caseRef", caseRef)
  if (accessToken) params.set("access", accessToken)
  if (existingAccount) params.set("existing", "1")
  redirect(`/onlinekredit${params.size ? `?${params.toString()}` : ""}`)
}
