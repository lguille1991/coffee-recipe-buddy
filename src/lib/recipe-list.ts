import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecipeListItem } from '@/types/recipe'
import { isManualRecipeCreated } from '@/lib/recipe-origin'

type FeedbackHistoryRow = Array<{ type?: string }>

type RecipeListSection = 'favorites' | 'my' | 'shared'

type OwnedRecipeListRow = {
  id: string
  user_id: string
  method: string
  bean_info: RecipeListItem['bean_info']
  image_url: string | null
  created_at: string
  schema_version: number
  archived: boolean
  current_recipe_json: {
    objective: string
    range_logic: {
      base_range: string
    }
  }
  feedback_history?: FeedbackHistoryRow
  parent_recipe_id?: string | null
}

type SharedMembershipRow = {
  recipe_id: string
  recipe: OwnedRecipeListRow | null
}

type FavoriteRow = {
  recipe_id: string
}

type ListUserRecipesParams = {
  userId: string
  section?: RecipeListSection
  method?: string
  q?: string
  archived?: boolean
  page?: number
  limit?: number
}

type ListUserRecipesResult = {
  recipes: RecipeListItem[]
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

function isMissingTableError(error: unknown, tableName: string) {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes(`Could not find the table 'public.${tableName}'`)
}

function sanitizeSearchTerm(query: string) {
  return query.replace(/[%_\\]/g, '\\$&')
}

function mapRecipeListItem(
  row: OwnedRecipeListRow,
  {
    isFavorite,
    source,
  }: {
    isFavorite: boolean
    source: 'owned' | 'shared'
  },
): RecipeListItem {
  const history = row.feedback_history ?? []
  const is_manual_created = isManualRecipeCreated(row.current_recipe_json)
  const has_manual_edits = history.some(entry => entry.type === 'manual_edit' || entry.type === 'auto_adjust')
  const has_feedback_adjustments = history.some(entry => !('type' in entry) || entry.type === 'feedback')
  const is_scaled = row.parent_recipe_id != null

  return {
    id: row.id,
    owner_user_id: row.user_id,
    method: row.method,
    bean_info: row.bean_info,
    image_url: row.image_url,
    created_at: row.created_at,
    schema_version: row.schema_version,
    archived: row.archived,
    is_favorite: isFavorite,
    source,
    can_delete: source === 'owned' && !isFavorite,
    can_archive: source === 'owned' && !isFavorite,
    can_remove_from_list: source === 'shared',
    is_manual_created,
    has_manual_edits,
    has_feedback_adjustments,
    is_scaled,
  }
}

async function getFavoriteIdsForUser(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('recipe_user_favorites')
    .select('recipe_id')
    .eq('user_id', userId)

  if (error && isMissingTableError(error, 'recipe_user_favorites')) {
    return new Set()
  }

  if (error) {
    throw new Error(error.message)
  }

  return new Set(((data ?? []) as FavoriteRow[]).map(row => row.recipe_id))
}

function applyRecipeSearchFilter(rows: OwnedRecipeListRow[], q?: string) {
  const term = q?.trim().toLowerCase()
  if (!term) return rows

  return rows.filter(row => {
    const beanName = row.bean_info.bean_name?.toLowerCase() ?? ''
    const origin = row.bean_info.origin?.toLowerCase() ?? ''
    const roaster = row.bean_info.roaster?.toLowerCase() ?? ''
    return beanName.includes(term) || origin.includes(term) || roaster.includes(term)
  })
}

function paginate<T>(rows: T[], page: number, limit: number) {
  const totalCount = rows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))
  const normalizedPage = Math.min(Math.max(1, page), totalPages)
  const from = (normalizedPage - 1) * limit
  const to = from + limit

  return {
    rows: rows.slice(from, to),
    page: normalizedPage,
    totalCount,
    totalPages,
  }
}

export async function listRecipesForUser(
  supabase: SupabaseClient,
  {
    userId,
    section = 'my',
    method,
    q,
    archived = false,
    page = 1,
    limit = 10,
  }: ListUserRecipesParams,
): Promise<ListUserRecipesResult> {
  const normalizedLimit = Math.min(Math.max(1, limit), 50)
  const normalizedPage = Math.max(1, page)
  const favoriteIdsPromise = getFavoriteIdsForUser(supabase, userId)

  if (section === 'my') {
    let query = supabase
      .from('recipes')
      .select('id, user_id, method, bean_info, image_url, created_at, schema_version, archived, current_recipe_json, feedback_history, parent_recipe_id')
      .eq('user_id', userId)
      .eq('archived', archived)
      .order('created_at', { ascending: false })

    if (method) {
      query = query.eq('method', method)
    }

    if (q) {
      const safe = sanitizeSearchTerm(q)
      query = query.or(
        `bean_info->>bean_name.ilike.%${safe}%,bean_info->>origin.ilike.%${safe}%,bean_info->>roaster.ilike.%${safe}%`,
      )
    }

    const [{ data, error }, favoriteIds] = await Promise.all([query, favoriteIdsPromise])

    if (error && isMissingTableError(error, 'recipe_share_memberships')) {
      return {
        recipes: [],
        page: 1,
        limit: normalizedLimit,
        totalCount: 0,
        totalPages: 1,
      }
    }

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as OwnedRecipeListRow[]
    const sortedRows = rows.toSorted((a, b) => {
      const aFavorite = favoriteIds.has(a.id)
      const bFavorite = favoriteIds.has(b.id)
      if (aFavorite !== bFavorite) return aFavorite ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    const paged = paginate(sortedRows, normalizedPage, normalizedLimit)

    return {
      recipes: paged.rows.map(row => mapRecipeListItem(row, { isFavorite: favoriteIds.has(row.id), source: 'owned' })),
      page: paged.page,
      limit: normalizedLimit,
      totalCount: paged.totalCount,
      totalPages: paged.totalPages,
    }
  }

  if (section === 'shared') {
    let sharedQuery = supabase
      .from('recipe_share_memberships')
      .select('recipe_id, recipe:recipes!recipe_share_memberships_recipe_id_fkey(id, user_id, method, bean_info, image_url, created_at, schema_version, archived, current_recipe_json, feedback_history, parent_recipe_id)')
      .eq('recipient_id', userId)
      .is('hidden_at', null)

    if (method) {
      sharedQuery = sharedQuery.eq('recipe.method', method)
    }

    const [{ data, error }, favoriteIds] = await Promise.all([sharedQuery, favoriteIdsPromise])

    if (error) {
      throw new Error(error.message)
    }

    const membershipRows = (data ?? []) as SharedMembershipRow[]
    const rows = membershipRows
      .map(row => row.recipe)
      .filter((row): row is OwnedRecipeListRow => Boolean(row) && !row.archived)

    const searchedRows = applyRecipeSearchFilter(rows, q)
    const sortedRows = searchedRows.toSorted((a, b) => {
      const aFavorite = favoriteIds.has(a.id)
      const bFavorite = favoriteIds.has(b.id)
      if (aFavorite !== bFavorite) return aFavorite ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    const paged = paginate(sortedRows, normalizedPage, normalizedLimit)

    return {
      recipes: paged.rows.map(row => mapRecipeListItem(row, { isFavorite: favoriteIds.has(row.id), source: 'shared' })),
      page: paged.page,
      limit: normalizedLimit,
      totalCount: paged.totalCount,
      totalPages: paged.totalPages,
    }
  }

  const [favoriteIds, ownedResponse, sharedResponse] = await Promise.all([
    favoriteIdsPromise,
    supabase
      .from('recipes')
      .select('id, user_id, method, bean_info, image_url, created_at, schema_version, archived, current_recipe_json, feedback_history, parent_recipe_id')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('recipe_share_memberships')
      .select('recipe_id, recipe:recipes!recipe_share_memberships_recipe_id_fkey(id, user_id, method, bean_info, image_url, created_at, schema_version, archived, current_recipe_json, feedback_history, parent_recipe_id)')
      .eq('recipient_id', userId)
      .is('hidden_at', null),
  ])

  if (ownedResponse.error) {
    throw new Error(ownedResponse.error.message)
  }

  if (sharedResponse.error && !isMissingTableError(sharedResponse.error, 'recipe_share_memberships')) {
    throw new Error(sharedResponse.error.message)
  }

  const ownedRows = (ownedResponse.data ?? []) as OwnedRecipeListRow[]
  const sharedRows = ((sharedResponse.data ?? []) as SharedMembershipRow[])
    .map(row => row.recipe)
    .filter((row): row is OwnedRecipeListRow => Boolean(row) && !row.archived)

  const byId = new Map<string, { row: OwnedRecipeListRow; source: 'owned' | 'shared' }>()

  for (const row of ownedRows) {
    if (!favoriteIds.has(row.id)) continue
    byId.set(row.id, { row, source: 'owned' })
  }

  for (const row of sharedRows) {
    if (!favoriteIds.has(row.id)) continue
    if (!byId.has(row.id)) {
      byId.set(row.id, { row, source: 'shared' })
    }
  }

  let rows = Array.from(byId.values())
  if (method) {
    rows = rows.filter(entry => entry.row.method === method)
  }

  rows = rows.filter(entry => {
    if (!q?.trim()) return true
    const term = q.trim().toLowerCase()
    const beanName = entry.row.bean_info.bean_name?.toLowerCase() ?? ''
    const origin = entry.row.bean_info.origin?.toLowerCase() ?? ''
    const roaster = entry.row.bean_info.roaster?.toLowerCase() ?? ''
    return beanName.includes(term) || origin.includes(term) || roaster.includes(term)
  })

  rows = rows.toSorted((a, b) => new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime())

  const paged = paginate(rows, normalizedPage, normalizedLimit)

  return {
    recipes: paged.rows.map(({ row, source }) => mapRecipeListItem(row, { isFavorite: true, source })),
    page: paged.page,
    limit: normalizedLimit,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
  }
}
