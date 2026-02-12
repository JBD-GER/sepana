import { redirect } from "next/navigation"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

export default async function SignatureRedirectPage({
  searchParams,
}: {
  searchParams?: { caseId?: string }
}) {
  const caseId = String(searchParams?.caseId || "").trim()
  if (!caseId) redirect("/app")

  const { user, role, passwordSetAt } = await getUserAndRole()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/signatur?caseId=${caseId}`)}`)
  }

  if (!passwordSetAt) {
    redirect("/einladung?mode=invite")
  }

  const focusParam = "focus=signatures"
  if (role === "advisor") redirect(`/advisor/faelle/${caseId}?${focusParam}#unterschriften`)
  if (role === "admin") redirect(`/admin/faelle/${caseId}?${focusParam}#unterschriften`)
  redirect(`/app/faelle/${caseId}?${focusParam}#unterschriften`)
}
