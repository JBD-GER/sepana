import WebsiteReviewsSectionClient from "./WebsiteReviewsSectionClient"
import {
  buildWebsiteReviewSummarySet,
  getPublishedWebsiteReviews,
  type WebsiteReview,
  type WebsiteReviewTab,
} from "@/lib/websiteReviews"

type WebsiteReviewsSectionProps = {
  initialTab?: WebsiteReviewTab
  expandAllTabsByDefault?: boolean
  eyebrow?: string
  title?: string
  description?: string
  ctaHref?: string | null
  ctaLabel?: string | null
  reviews?: WebsiteReview[]
}

export default async function WebsiteReviewsSection({
  initialTab = "overall",
  expandAllTabsByDefault = false,
  eyebrow,
  title,
  description,
  ctaHref = null,
  ctaLabel = null,
  reviews,
}: WebsiteReviewsSectionProps) {
  const resolvedReviews = reviews ?? (await getPublishedWebsiteReviews())
  if (!resolvedReviews.length) return null

  const summary = buildWebsiteReviewSummarySet(resolvedReviews)

  return (
    <WebsiteReviewsSectionClient
      reviews={resolvedReviews}
      summary={summary}
      initialTab={initialTab}
      expandAllTabsByDefault={expandAllTabsByDefault}
      eyebrow={eyebrow}
      title={title}
      description={description}
      ctaHref={ctaHref}
      ctaLabel={ctaLabel}
    />
  )
}
