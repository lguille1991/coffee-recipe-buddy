import type { SupabaseClient } from '@supabase/supabase-js'
import { createRecipeSnapshot, mirrorRecipeLiveSnapshot } from '@/lib/recipe-snapshots'
import { CURRENT_SCHEMA_VERSION } from '@/lib/recipe-migrations'
import type { AnyFeedbackRound, BeanProfile, Recipe, RecipeWithAdjustment } from '@/types/recipe'
import type { GenerationContext } from '@/types/coffee-profile'

export type SaveRecipeInput = {
  userId: string
  bean_info: BeanProfile
  method: string
  original_recipe_json: Recipe
  current_recipe_json: RecipeWithAdjustment
  feedback_history?: AnyFeedbackRound[]
  image_url?: string | null
  notes?: string | null
  parent_recipe_id?: string | null
  scale_factor?: number | null
  coffee_profile_id?: string | null
  coffee_profile_user_id?: string | null
  generation_context?: GenerationContext | null
}

export async function saveRecipeWithSnapshot(
  supabase: SupabaseClient,
  input: SaveRecipeInput,
) {
  const feedback_history = input.feedback_history ?? []

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: input.userId,
      schema_version: CURRENT_SCHEMA_VERSION,
      bean_info: input.bean_info,
      method: input.method,
      original_recipe_json: input.original_recipe_json,
      current_recipe_json: input.current_recipe_json,
      feedback_history,
      image_url: input.image_url ?? null,
      notes: input.notes ?? null,
      parent_recipe_id: input.parent_recipe_id ?? null,
      scale_factor: input.scale_factor ?? null,
      live_snapshot_id: null,
      coffee_profile_id: input.coffee_profile_id ?? null,
      coffee_profile_user_id: input.coffee_profile_user_id ?? null,
      generation_context: input.generation_context ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save recipe')
  }

  try {
    const snapshot = await createRecipeSnapshot({
      supabase,
      recipeId: data.id,
      userId: input.userId,
      snapshotKind: input.parent_recipe_id ? 'clone' : 'initial',
      snapshotRecipeJson: input.current_recipe_json,
      changeSummary: [],
    })

    const mirrored = await mirrorRecipeLiveSnapshot({
      supabase,
      recipeId: data.id,
      liveSnapshotId: snapshot.id,
      currentRecipeJson: input.current_recipe_json,
      feedbackHistory: feedback_history,
    })

    return mirrored
  } catch (snapshotError) {
    await supabase
      .from('recipes')
      .delete()
      .eq('id', data.id)

    throw new Error(
      snapshotError instanceof Error
        ? snapshotError.message
        : 'Failed to create recipe snapshot',
    )
  }
}
