type RecommendedBy = {
  referral_id: string
  company_name: string
  logo_path: string | null
}

function tippgeberLogoUrl(path: string | null | undefined) {
  const clean = String(path ?? "").trim()
  if (!clean) return null
  return `/api/baufi/logo?bucket=tipgeber_logos&width=192&height=192&resize=contain&path=${encodeURIComponent(clean)}`
}

export default function RecommendedByCard({
  recommendedBy,
}: {
  recommendedBy: RecommendedBy | null | undefined
}) {
  if (!recommendedBy) return null
  const logoUrl = tippgeberLogoUrl(recommendedBy.logo_path)

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-contain p-1.5" />
          ) : (
            <span className="text-[10px] text-slate-400">Logo</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Empfohlen von</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{recommendedBy.company_name}</div>
          <div className="mt-1 text-xs text-slate-500">Tippgeber-ID: {recommendedBy.referral_id.slice(0, 8)}</div>
        </div>
      </div>
    </div>
  )
}
