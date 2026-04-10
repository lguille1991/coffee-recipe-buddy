import type { SupabaseClient } from '@supabase/supabase-js'

export type RecipeShareInfo = {
  shareToken: string | null
  commentCount: number | null
}

export async function getRecipeShareInfo(
  supabase: SupabaseClient,
  recipeId: string,
  ownerId: string,
): Promise<RecipeShareInfo> {
  const { data: sharedRecipe, error } = await supabase
    .from('shared_recipes')
    .select('share_token')
    .eq('recipe_id', recipeId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error || !sharedRecipe) {
    return {
      shareToken: null,
      commentCount: null,
    }
  }

  const { count } = await supabase
    .from('recipe_comments')
    .select('id', { count: 'exact', head: true })
    .eq('share_token', sharedRecipe.share_token)

  return {
    shareToken: sharedRecipe.share_token,
    commentCount: count ?? 0,
  }
}
