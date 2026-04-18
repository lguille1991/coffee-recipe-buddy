import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getSavedRecipeDetail } from '@/lib/recipe-detail'
import { getRecipeShareInfo } from '@/lib/share'
import { createClient } from '@/lib/supabase/server'
import RecipeDetailClient from './RecipeDetailClient'

type Params = { params: Promise<{ id: string }> }

export default async function SavedRecipeDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?returnTo=/recipes/${id}`)
  }

  const [initialRecipe, shareInfo] = await Promise.all([
    getSavedRecipeDetail(supabase, id, user.id),
    getRecipeShareInfo(supabase, id, user.id),
  ])
  if (!initialRecipe) {
    notFound()
  }
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
