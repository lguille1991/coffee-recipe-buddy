import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecipeListItem } from '@/types/recipe'

type FeedbackHistoryRow = Array<{ type?: string }>

type RecipeListRow = {
  id: string
  method: string
  bean_info: RecipeListItem['bean_info']
  image_url: string | null
  created_at: string
  schema_version: number
  feedback_history?: FeedbackHistoryRow
  parent_recipe_id?: string | null
}

type ListUserRecipesParams = {
  userId: string
  method?: string
  q?: string
  page?: number
  limit?: number
  cumulative?: boolean
}

type ListUserRecipesResult = {
  recipes: RecipeListItem[]
  page: number
  limit: number
  hasMore: boolean
}

function sanitizeSearchTerm(query: string) {
  return query.replace(/[%_\\]/g, '\\$&')
}

function mapRecipeListItem(row: RecipeListRow): RecipeListItem {
  const history = row.feedback_history ?? []
  const has_manual_edits = history.some(entry => entry.type === 'manual_edit' || entry.type === 'auto_adjust')
  const has_feedback_adjustments = history.some(entry => !('type' in entry) || entry.type === 'feedback')
  const is_scaled = row.parent_recipe_id != null

  return {
    id: row.id,
    method: row.method,
    bean_info: row.bean_info,
    image_url: row.image_url,
    created_at: row.created_at,
    schema_version: row.schema_version,
    has_manual_edits,
    has_feedback_adjustments,
    is_scaled,
  }
}

export async function listRecipesForUser(
  supabase: SupabaseClient,
  {
    userId,
    method,
    q,
    page = 1,
    limit = 20,
    cumulative = false,
  }: ListUserRecipesParams,
): Promise<ListUserRecipesResult> {
  const normalizedPage = Math.max(1, page)
  const normalizedLimit = Math.min(Math.max(1, limit), 50)
  const visibleCount = cumulative ? normalizedPage * normalizedLimit : normalizedLimit
  const from = cumulative ? 0 : (normalizedPage - 1) * normalizedLimit
  const to = cumulative ? visibleCount : from + normalizedLimit

  let query = supabase
    .from('recipes')
    .select('id, method, bean_info, image_url, created_at, schema_version, feedback_history, parent_recipe_id')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (method) {
    query = query.eq('method', method)
  }

  if (q) {
    const safe = sanitizeSearchTerm(q)
    query = query.or(
      `bean_info->>bean_name.ilike.%${safe}%,bean_info->>origin.ilike.%${safe}%,bean_info->>roaster.ilike.%${safe}%`,
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as RecipeListRow[]
  const hasMore = rows.length > visibleCount
  const visibleRows = rows.slice(0, visibleCount)

  return {
    recipes: visibleRows.map(mapRecipeListItem),
    page: normalizedPage,
    limit: normalizedLimit,
    hasMore,
  }
}
