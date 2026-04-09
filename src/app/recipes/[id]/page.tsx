import { notFound, redirect } from 'next/navigation'
import { migrateRecipe } from '@/lib/recipe-migrations'
import { createClient } from '@/lib/supabase/server'
import type { RecipeWithAdjustment, SavedRecipe } from '@/types/recipe'
import RecipeDetailClient from './RecipeDetailClient'

type Params = { params: Promise<{ id: string }> }

export default async function SavedRecipeDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?returnTo=/recipes/${id}`)
  }

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (error || !data) {
    notFound()
  }

  const initialRecipe: SavedRecipe = {
    ...data,
    current_recipe_json: migrateRecipe(data.current_recipe_json, data.schema_version),
    original_recipe_json: migrateRecipe(data.original_recipe_json as RecipeWithAdjustment, data.schema_version),
  }

  return <RecipeDetailClient id={id} initialRecipe={initialRecipe} />
}
