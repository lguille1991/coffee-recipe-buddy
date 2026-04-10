import { notFound, redirect } from 'next/navigation'
import { migrateRecipe } from '@/lib/recipe-migrations'
import { SAVED_RECIPE_DETAIL_SELECT } from '@/lib/recipe-select'
import { createClient } from '@/lib/supabase/server'
import type { RecipeWithAdjustment, SavedRecipe } from '@/types/recipe'
import AutoAdjustClient from './AutoAdjustClient'

type Params = { params: Promise<{ id: string }> }

export default async function AutoAdjustPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?returnTo=/recipes/${id}/auto-adjust`)
  }

  const { data: recipeRow, error } = await supabase
    .from('recipes')
    .select(SAVED_RECIPE_DETAIL_SELECT)
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (error || !recipeRow) {
    notFound()
  }

  const savedRecipeRow = recipeRow as unknown as SavedRecipe
  const sourceRecipe: SavedRecipe = {
    ...savedRecipeRow,
    current_recipe_json: migrateRecipe(
      savedRecipeRow.current_recipe_json,
      savedRecipeRow.schema_version,
    ),
    original_recipe_json: migrateRecipe(
      savedRecipeRow.original_recipe_json as RecipeWithAdjustment,
      savedRecipeRow.schema_version,
    ),
  }

  return <AutoAdjustClient id={id} sourceRecipe={sourceRecipe} />
}
