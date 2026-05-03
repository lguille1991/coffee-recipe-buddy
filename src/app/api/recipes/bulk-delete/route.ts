import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const BulkDeleteRecipesRequestSchema = z.object({
  recipe_ids: z.array(z.string().uuid()).min(1).max(2000),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = BulkDeleteRecipesRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const recipeIds = Array.from(new Set(parsed.data.recipe_ids))

  const { data: favoriteRows, error: favoriteLookupError } = await supabase
    .from('recipe_user_favorites')
    .select('recipe_id')
    .eq('user_id', user.id)
    .in('recipe_id', recipeIds)

  if (favoriteLookupError) {
    return NextResponse.json({ error: favoriteLookupError.message }, { status: 500 })
  }

  const blockedFavoriteIds = new Set(((favoriteRows ?? []) as Array<{ recipe_id: string }>).map(row => row.recipe_id))
  const deletableIds = recipeIds.filter(id => !blockedFavoriteIds.has(id))

  if (deletableIds.length === 0) {
    return NextResponse.json({
      success: true,
      archived_ids: [],
      archived_count: 0,
      requested_count: recipeIds.length,
      blocked_recipe_ids: Array.from(blockedFavoriteIds),
    })
  }

  const { data, error } = await supabase
    .from('recipes')
    .update({ archived: true })
    .eq('user_id', user.id)
    .in('id', deletableIds)
    .eq('archived', false)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const archivedIds = ((data ?? []) as Array<{ id: string }>).map(row => row.id)

  return NextResponse.json({
    success: true,
    archived_ids: archivedIds,
    archived_count: archivedIds.length,
    requested_count: recipeIds.length,
    blocked_recipe_ids: Array.from(blockedFavoriteIds),
  })
}
