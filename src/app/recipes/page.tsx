import { redirect } from 'next/navigation'
import RecipesClient from './RecipesClient'
import { listRecipesForUser } from '@/lib/recipe-list'
import { createClient } from '@/lib/supabase/server'

type RecipesPageProps = {
  searchParams: Promise<{
    page?: string | string[]
    method?: string | string[]
    q?: string | string[]
    archived?: string | string[]
    section?: string | string[]
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
  const archived = getSingleValue(params.archived) === 'true'
  const sectionParam = getSingleValue(params.section)
  const section = sectionParam === 'favorites' || sectionParam === 'shared' ? sectionParam : 'my'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?returnTo=/recipes')
  }

  const result = await listRecipesForUser(supabase, {
    userId: user.id,
    section,
    page,
    limit: 10,
    method: method || undefined,
    q: q || undefined,
    archived,
  })

  return (
    <RecipesClient
      key={`${section}:${archived ? 'archived' : 'active'}:${method}:${q}:${result.page}`}
      initialRecipes={result.recipes}
      initialPage={page}
      initialMethod={method}
      initialQuery={q}
      initialArchived={archived}
      initialSection={section}
      initialTotalPages={result.totalPages}
    />
  )
}
