import { notFound, redirect } from 'next/navigation'
import { getSavedRecipeDetail } from '@/lib/recipe-detail'
import { createClient } from '@/lib/supabase/server'
import BrewModeClient from './BrewModeClient'

type Params = { params: Promise<{ id: string }> }

export default async function BrewModePage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?returnTo=/recipes/${id}/brew`)
  }

  const initialRecipe = await getSavedRecipeDetail(supabase, id, user.id)
  if (!initialRecipe) {
    notFound()
  }

  return <BrewModeClient id={id} recipe={initialRecipe} />
}
