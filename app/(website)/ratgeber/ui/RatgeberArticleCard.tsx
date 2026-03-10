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
      className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="relative h-[220px] bg-slate-200">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover object-center"
            sizes="(max-width: 1280px) 100vw, 50vw"
            unoptimized
          />
        ) : null}
      </div>

      <div className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{topicLabel}</div>
        <h3 className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{excerpt}</p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            {"Ver\u00F6ffentlicht am"} {publishedLabel}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            {readingTimeMinutes} Min. Lesezeit
          </span>
        </div>
      </div>
    </Link>
  )
}
