import Link from "next/link"
import { requireTippgeber } from "@/lib/tippgeber/requireTippgeber"
import { getTippgeberProfileByUserId } from "@/lib/tippgeber/service"
import { normalizeTippgeberKind } from "@/lib/tippgeber/kinds"
import { getPartnershipAgreementStatus } from "@/lib/tippgeber/partnershipAgreementServer"
import PartnershipAgreement from "../ui/PartnershipAgreement"

export default async function TippgeberSettingsPage() {
  const { user, role } = await requireTippgeber()
  if (role === "admin") return <p>Partner verwalten Sie unter <Link href="/admin/tippgeber" className="underline">Admin → Tippgeber</Link>.</p>
  const profile = await getTippgeberProfileByUserId(user.id)
  const isBaufi = profile && normalizeTippgeberKind(profile.tippgeber_kind) === "classic"
  const status = isBaufi ? await getPartnershipAgreementStatus(user.id) : null
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1><p className="mt-2 text-sm text-slate-600">Ihre Partnerdaten und Dokumente zur Zusammenarbeit.</p></div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Partnerdaten</h2>
        {profile ? <div className="mt-4 space-y-1 text-sm text-slate-700"><p className="font-semibold">{profile.company_name}</p><p>{profile.address_street} {profile.address_house_number}</p><p>{profile.address_zip} {profile.address_city}</p><p>{profile.email || user.email}</p>{profile.phone ? <p>{profile.phone}</p> : null}</div> : <p className="mt-3 text-sm text-slate-600">Die Partnerdaten konnten nicht geladen werden.</p>}
        <p className="mt-4 text-sm text-slate-500">Für Änderungen Ihrer Firmendaten wenden Sie sich bitte an <a href="mailto:info@sepana.de" className="underline underline-offset-4">info@sepana.de</a>.</p>
      </section>
      {status && profile ? <PartnershipAgreement initialStatus={status} companyName={profile.company_name} /> : null}
    </div>
  )
}
