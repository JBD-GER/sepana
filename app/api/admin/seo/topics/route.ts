export const runtime = "nodejs"

import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { slugify } from "@/lib/ratgeber/utils"

type SaveTopicBody = {
  categorySlug?: unknown
  slug?: unknown
  name?: unknown
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asPositiveInt(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as SaveTopicBody

    const categorySlug = asString(body.categorySlug)
    const name = asString(body.name)
    const slug = slugify(asString(body.slug) || name)

    if (!categorySlug || !name || !slug) {
      return NextResponse.json(
        { ok: false, error: "Kategorie, Name und Slug der Unterkategorie sind erforderlich." },
        { status: 400 },
      )
    }

    const admin = supabaseAdmin()
    const { data: category, error: categoryError } = await admin
      .from("ratgeber_categories")
      .select("id,name")
      .eq("slug", categorySlug)
      .maybeSingle()

    if (categoryError) throw categoryError
    if (!category?.id) {
      return NextResponse.json({ ok: false, error: "Kategorie nicht gefunden." }, { status: 404 })
    }

    const { data: latest } = await admin
      .from("ratgeber_topics")
      .select("sort_order")
      .eq("category_id", category.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const sortOrder = asPositiveInt(latest?.sort_order, 0) + 1
    const categoryName = category.name

    const patch = {
      category_id: category.id,
      slug,
      name,
      description: `Beitraege zu ${name.toLowerCase()} im SEPANA Ratgeber.`,
      hero_title: `${name} im Ratgeber sauber einordnen.`,
      hero_text: `In dieser Unterkategorie sammelt SEPANA kuenftig Beitraege rund um ${name.toLowerCase()} und die wichtigsten Entscheidungen vor der Anfrage.`,
      seo_title: `${name} Ratgeber | SEPANA`,
      seo_description: `Unterkategorie ${name} im SEPANA Ratgeber mit eigenen Beitraegen und klarer interner Verlinkung.`,
      sort_order: sortOrder,
      is_published: true,
      hero_image_path: null,
      hero_image_alt: `${name} im SEPANA Ratgeber`,
    }

    const { data: existing, error: existingError } = await admin
      .from("ratgeber_topics")
      .select("id")
      .eq("category_id", category.id)
      .eq("slug", slug)
      .maybeSingle()

    if (existingError) throw existingError

    const query = existing?.id
      ? admin.from("ratgeber_topics").update(patch).eq("id", existing.id)
      : admin.from("ratgeber_topics").insert(patch)

    const { error } = await query
    if (error) throw error

    const topicPath = `/ratgeber/${categorySlug}/${slug}`
    revalidatePath("/ratgeber")
    revalidatePath(`/ratgeber/${categorySlug}`)
    revalidatePath(topicPath)
    revalidatePath("/sitemap.xml")
    revalidatePath("/sitemap-index.xml")

    return NextResponse.json({
      ok: true,
      categorySlug,
      categoryName,
      slug,
      name,
      created: !existing?.id,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Serverfehler" },
      { status: 500 },
    )
  }
}
