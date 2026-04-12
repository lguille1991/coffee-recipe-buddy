import { notFound, redirect } from 'next/navigation'
import { getSavedRecipeDetail } from '@/lib/recipe-detail'
import { createClient } from '@/lib/supabase/server'
import AutoAdjustClient from './AutoAdjustClient'

type Params = { params: Promise<{ id: string }> }

export default async function AutoAdjustPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?returnTo=/recipes/${id}/auto-adjust`)
  }

  const sourceRecipe = await getSavedRecipeDetail(supabase, id, user.id)
  if (!sourceRecipe) {
    notFound()
  }

  return <AutoAdjustClient id={id} sourceRecipe={sourceRecipe} />
}
