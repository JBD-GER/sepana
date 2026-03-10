import { requireAdmin } from "@/lib/admin/requireAdmin"
import { getRatgeberAdminState } from "@/lib/ratgeber/adminServer"
import SeoArticleEditor from "./ui/SeoArticleEditor"

export default async function AdminSeoPage() {
  await requireAdmin()
  const state = await getRatgeberAdminState()

  return (
    <SeoArticleEditor
      dbReady={state.dbReady}
      categories={state.categories}
      topics={state.topics}
      articles={state.articles}
    />
  )
}
