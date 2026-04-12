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
  const snapshots = await listRecipeSnapshots(supabase, recipeId)
  const liveSnapshot = savedRecipeRow.live_snapshot_id
    ? snapshots.find(snapshot => snapshot.id === savedRecipeRow.live_snapshot_id) ?? null
    : null

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
    snapshots: snapshots.map(snapshot => ({
      ...snapshot,
      snapshot_recipe_json: migrateRecipe(
        snapshot.snapshot_recipe_json,
        savedRecipeRow.schema_version,
      ),
    })),
  }
}
