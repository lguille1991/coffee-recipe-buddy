import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { migrateRecipe } from '@/lib/recipe-migrations'
import { SAVED_RECIPE_DETAIL_SELECT } from '@/lib/recipe-select'
import { getRecipeShareInfo } from '@/lib/share'
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
  const initialRecipe: SavedRecipe = {
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

  const shareInfo = await getRecipeShareInfo(supabase, id, user.id)
  const headersList = await headers()
  const protocol = headersList.get('x-forwarded-proto') ?? 'http'
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host')
  const baseUrl = host ? `${protocol}://${host}` : ''

  return (
    <RecipeDetailClient
      id={id}
      initialRecipe={initialRecipe}
      initialShareToken={shareInfo.shareToken}
      initialCommentCount={shareInfo.commentCount}
      initialShareUrl={shareInfo.shareToken && baseUrl ? `${baseUrl}/share/${shareInfo.shareToken}` : ''}
    />
  )
}
