import "server-only"

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const WEBSITE_REVIEW_CATEGORIES = ["baufi", "privatkredit"] as const

export type WebsiteReviewCategory = (typeof WEBSITE_REVIEW_CATEGORIES)[number]
export type WebsiteReviewTab = WebsiteReviewCategory | "overall"

export type WebsiteReview = {
  id: string
  category: WebsiteReviewCategory
  rating: number
  quote: string
  reviewerInitials: string
  reviewerCity: string
  reviewedOn: string
  createdAt: string | null
}

export type WebsiteReviewStats = {
  count: number
  average: number | null
  fiveStarCount: number
  fourStarCount: number
  latestReviewedOn: string | null
}

export type WebsiteReviewSummarySet = {
  overall: WebsiteReviewStats
  baufi: WebsiteReviewStats
  privatkredit: WebsiteReviewStats
}

type ReviewRow = {
  id: string
  category: string
  rating: number | string
  quote: string
  reviewer_initials: string
  reviewer_city: string
  reviewed_on: string
  created_at: string | null
  is_published: boolean
}

function toCategory(value: string): WebsiteReviewCategory | null {
  if (value === "baufi" || value === "privatkredit") return value
  return null
}

function toNumber(value: number | string) {
  if (typeof value === "number") return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compareReviews(a: WebsiteReview, b: WebsiteReview) {
  const byDate = b.reviewedOn.localeCompare(a.reviewedOn)
  if (byDate !== 0) return byDate
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
}

function buildStats(reviews: WebsiteReview[]): WebsiteReviewStats {
  if (!reviews.length) {
    return {
      count: 0,
      average: null,
      fiveStarCount: 0,
      fourStarCount: 0,
      latestReviewedOn: null,
    }
  }

  const total = reviews.reduce((sum, item) => sum + item.rating, 0)
  const latestReviewedOn = reviews
    .map((item) => item.reviewedOn)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null

  return {
    count: reviews.length,
    average: total / reviews.length,
    fiveStarCount: reviews.filter((item) => item.rating === 5).length,
    fourStarCount: reviews.filter((item) => item.rating === 4).length,
    latestReviewedOn,
  }
}

export function buildWebsiteReviewSummarySet(reviews: WebsiteReview[]): WebsiteReviewSummarySet {
  const baufi = reviews.filter((item) => item.category === "baufi")
  const privatkredit = reviews.filter((item) => item.category === "privatkredit")

  return {
    overall: buildStats(reviews),
    baufi: buildStats(baufi),
    privatkredit: buildStats(privatkredit),
  }
}

export async function getPublishedWebsiteReviewSummarySet(): Promise<WebsiteReviewSummarySet> {
  const reviews = await getPublishedWebsiteReviews()
  return buildWebsiteReviewSummarySet(reviews)
}

export async function getPublishedWebsiteReviews(): Promise<WebsiteReview[]> {
  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from("website_reviews")
      .select(
        "id,category,rating,quote,reviewer_initials,reviewer_city,reviewed_on,created_at,is_published",
      )
      .eq("is_published", true)
      .order("reviewed_on", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.warn("[websiteReviews] query failed:", error.message)
      return []
    }

    const rows = Array.isArray(data) ? (data as ReviewRow[]) : []
    return rows
      .map((row) => {
        const category = toCategory(row.category)
        if (!category) return null
        return {
          id: row.id,
          category,
          rating: toNumber(row.rating),
          quote: row.quote,
          reviewerInitials: row.reviewer_initials,
          reviewerCity: row.reviewer_city,
          reviewedOn: row.reviewed_on,
          createdAt: row.created_at,
        } satisfies WebsiteReview
      })
      .filter((item): item is WebsiteReview => item !== null)
      .sort(compareReviews)
  } catch (error) {
    console.warn(
      "[websiteReviews] unexpected error:",
      error instanceof Error ? error.message : "unknown",
    )
    return []
  }
}
