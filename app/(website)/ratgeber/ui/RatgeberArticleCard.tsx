import Image from "next/image"
import Link from "next/link"

type RatgeberArticleCardProps = {
  href: string
  title: string
  excerpt: string
  imageSrc: string | null
  imageAlt: string
  topicName: string
  categoryName?: string
  publishedAt: string
  readingTimeMinutes: number
}

const publishedDateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })

export default function RatgeberArticleCard({
  href,
  title,
  excerpt,
  imageSrc,
  imageAlt,
  topicName,
  categoryName,
  publishedAt,
  readingTimeMinutes,
}: RatgeberArticleCardProps) {
  const publishedLabel = publishedDateFormatter.format(new Date(publishedAt))
  const topicLabel = categoryName ? `${categoryName}, ${topicName}` : topicName

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(145deg,#e2e8f0_0%,#f8fafc_100%)]">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover object-center transition duration-500 group-hover:scale-[1.02]"
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
          />
        ) : <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(148,163,184,0.18),transparent_35%),linear-gradient(145deg,#e2e8f0_0%,#f8fafc_100%)]" />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/18 to-transparent" />
      </div>

      <div className="p-5 sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{topicLabel}</div>
        <h3 className="mt-2 text-xl font-semibold leading-tight text-slate-900 sm:text-2xl">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{excerpt}</p>

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            {"Ver\u00F6ffentlicht am"} {publishedLabel}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            {readingTimeMinutes} Min. Lesezeit
          </span>
        </div>
      </div>
    </Link>
  )
}
