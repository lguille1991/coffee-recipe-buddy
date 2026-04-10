import { redirect } from 'next/navigation'
import RecipesClient from './RecipesClient'
import { listRecipesForUser } from '@/lib/recipe-list'
import { createClient } from '@/lib/supabase/server'

type RecipesPageProps = {
  searchParams: Promise<{
    page?: string | string[]
    method?: string | string[]
    q?: string | string[]
  }>
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(getSingleValue(params.page) || '1', 10) || 1)
  const method = getSingleValue(params.method)
  const q = getSingleValue(params.q)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?returnTo=/recipes')
  }

  const result = await listRecipesForUser(supabase, {
    userId: user.id,
    page,
    limit: 20,
    method: method || undefined,
    q: q || undefined,
    cumulative: true,
  })

  return (
    <RecipesClient
      initialRecipes={result.recipes}
      initialPage={page}
      initialMethod={method}
      initialQuery={q}
      initialHasMore={result.hasMore}
    />
  )
}
