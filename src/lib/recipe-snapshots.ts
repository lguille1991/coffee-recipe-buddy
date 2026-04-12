import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AnyFeedbackRound,
  RecipeChange,
  RecipeSnapshot,
  RecipeSnapshotKind,
  RecipeWithAdjustment,
} from '@/types/recipe'

type RecipeSnapshotRow = {
  id: string
  recipe_id: string
  user_id: string
  snapshot_index: number
  snapshot_kind: RecipeSnapshotKind
  snapshot_recipe_json: RecipeWithAdjustment
  change_summary: RecipeChange[] | null
  created_at: string
  source_snapshot_id?: string | null
}

type SnapshotInsertArgs = {
  supabase: SupabaseClient
  recipeId: string
  userId: string
  snapshotKind: RecipeSnapshotKind
  snapshotRecipeJson: RecipeWithAdjustment
  changeSummary?: RecipeChange[]
  sourceSnapshotId?: string | null
}

type MirrorArgs = {
  supabase: SupabaseClient
  recipeId: string
  liveSnapshotId: string
  currentRecipeJson: RecipeWithAdjustment
  feedbackHistory?: AnyFeedbackRound[]
}

export function mapRecipeSnapshotRow(row: RecipeSnapshotRow): RecipeSnapshot {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    user_id: row.user_id,
    snapshot_index: row.snapshot_index,
    snapshot_kind: row.snapshot_kind,
    snapshot_recipe_json: row.snapshot_recipe_json,
    change_summary: row.change_summary ?? [],
    created_at: row.created_at,
    source_snapshot_id: row.source_snapshot_id ?? null,
  }
}

export async function listRecipeSnapshots(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<RecipeSnapshot[]> {
  const { data, error } = await supabase
    .from('recipe_snapshots')
    .select('id, recipe_id, user_id, snapshot_index, snapshot_kind, snapshot_recipe_json, change_summary, created_at, source_snapshot_id')
    .eq('recipe_id', recipeId)
    .order('snapshot_index', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RecipeSnapshotRow[]).map(mapRecipeSnapshotRow)
}

export async function createRecipeSnapshot({
  supabase,
  recipeId,
  userId,
  snapshotKind,
  snapshotRecipeJson,
  changeSummary = [],
  sourceSnapshotId = null,
}: SnapshotInsertArgs): Promise<RecipeSnapshot> {
  const { data: existingSnapshots, error: selectError } = await supabase
    .from('recipe_snapshots')
    .select('snapshot_index')
    .eq('recipe_id', recipeId)
    .order('snapshot_index', { ascending: false })
    .limit(1)

  if (selectError) {
    throw new Error(selectError.message)
  }

  const nextIndex = (((existingSnapshots ?? []) as Array<{ snapshot_index: number }>)[0]?.snapshot_index ?? 0) + 1

  const { data, error } = await supabase
    .from('recipe_snapshots')
    .insert({
      recipe_id: recipeId,
      user_id: userId,
      snapshot_index: nextIndex,
      snapshot_kind: snapshotKind,
      snapshot_recipe_json: snapshotRecipeJson,
      change_summary: changeSummary,
      source_snapshot_id: sourceSnapshotId,
    })
    .select('id, recipe_id, user_id, snapshot_index, snapshot_kind, snapshot_recipe_json, change_summary, created_at, source_snapshot_id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create recipe snapshot')
  }

  return mapRecipeSnapshotRow(data as RecipeSnapshotRow)
}

export async function mirrorRecipeLiveSnapshot({
  supabase,
  recipeId,
  liveSnapshotId,
  currentRecipeJson,
  feedbackHistory,
}: MirrorArgs) {
  const update: {
    live_snapshot_id: string
    current_recipe_json: RecipeWithAdjustment
    feedback_history?: AnyFeedbackRound[]
  } = {
    live_snapshot_id: liveSnapshotId,
    current_recipe_json: currentRecipeJson,
  }

  if (feedbackHistory) {
    update.feedback_history = feedbackHistory
  }

  const { data, error } = await supabase
    .from('recipes')
    .update(update)
    .eq('id', recipeId)
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update live recipe snapshot')
  }

  return data
}
