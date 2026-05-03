import type { SupabaseClient } from '@supabase/supabase-js'
import { migrateRecipe } from '@/lib/recipe-migrations'
import { SAVED_RECIPE_DETAIL_SELECT } from '@/lib/recipe-select'
import { listRecipeSnapshots } from '@/lib/recipe-snapshots'
import type { RecipeWithAdjustment, SavedRecipe, SavedRecipeDetail } from '@/types/recipe'

type SavedRecipeRow = SavedRecipe & {
  creator?: {
    display_name?: string | null
  } | null
}

function isMissingFavoritesTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes("Could not find the table 'public.recipe_user_favorites'")
}

export async function getSavedRecipeDetail(
  supabase: SupabaseClient,
  recipeId: string,
  userId: string,
): Promise<SavedRecipeDetail | null> {
  const { data: recipeRow, error } = await supabase
    .from('recipes')
    .select(SAVED_RECIPE_DETAIL_SELECT)
    .eq('id', recipeId)
    .eq('user_id', userId)
    .eq('archived', false)
    .single()

  if (error || !recipeRow) {
    return null
  }

  const savedRecipeRow = recipeRow as unknown as SavedRecipeRow
  const [snapshots, favoriteResult] = await Promise.all([
    listRecipeSnapshots(supabase, recipeId),
    supabase
      .from('recipe_user_favorites')
      .select('recipe_id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .maybeSingle(),
  ])
  const liveSnapshot = savedRecipeRow.live_snapshot_id
    ? snapshots.find(snapshot => snapshot.id === savedRecipeRow.live_snapshot_id) ?? null
    : null

  if (favoriteResult.error && !isMissingFavoritesTableError(favoriteResult.error)) {
    throw new Error(favoriteResult.error.message)
  }

  return {
    ...savedRecipeRow,
    creator_display_name: savedRecipeRow.creator?.display_name ?? null,
    current_recipe_json: migrateRecipe(
      liveSnapshot?.snapshot_recipe_json ?? savedRecipeRow.current_recipe_json,
      savedRecipeRow.schema_version,
    ),
    original_recipe_json: migrateRecipe(
      savedRecipeRow.original_recipe_json as RecipeWithAdjustment,
      savedRecipeRow.schema_version,
    ),
    is_favorite: Boolean(favoriteResult.data),
    snapshots: snapshots.map(snapshot => ({
      ...snapshot,
      snapshot_recipe_json: migrateRecipe(
        snapshot.snapshot_recipe_json,
        savedRecipeRow.schema_version,
      ),
    })),
  }
}
