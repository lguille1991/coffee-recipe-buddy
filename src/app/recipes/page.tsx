'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { RecipeListItem, METHOD_DISPLAY_NAMES } from '@/types/recipe'
import RecipeListCard from '@/components/RecipeListCard'

const METHOD_FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  ...Object.entries(METHOD_DISPLAY_NAMES).map(([id, label]) => ({ id, label })),
]

export default function RecipesPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [fetching, setFetching] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [method, setMethod] = useState('')
  const [q, setQ] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchRecipes = useCallback(async (nextPage: number, methodFilter: string, search: string, replace: boolean) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setFetching(true)
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: '20' })
      if (methodFilter) params.set('method', methodFilter)
      if (search) params.set('q', search)
      const res = await fetch(`/api/recipes?${params}`, { signal: controller.signal, cache: 'no-store' })
      const data = await res.json()
      const items: RecipeListItem[] = data.recipes ?? []
      setRecipes(prev => replace ? items : [...prev, ...items])
      setHasMore(items.length === 20)
      setPage(nextPage)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?returnTo=/recipes')
  }, [user, loading, router])

  useEffect(() => {
    if (user) fetchRecipes(1, method, q, true)
  }, [user, method]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(value: string) {
    setQ(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchRecipes(1, method, value, true)
    }, 400)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="h-12" />

      <div className="px-4 sm:px-6 pb-4">
        <h1 className="ui-page-title">My Recipes</h1>
      </div>

      <div className="px-4 sm:px-6 mb-3">
        <div className="relative">
          <svg className="ui-icon-inline absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search bean, origin, roaster…"
            value={q}
            onChange={e => handleSearchChange(e.target.value)}
            className="ui-input pl-9"
          />
        </div>
      </div>

      <div className="px-4 sm:px-6 mb-4 overflow-x-auto pb-2">
        <div className="flex gap-2 w-max">
          {METHOD_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setMethod(f.id)}
              className={`ui-chip shrink-0 ${
                method === f.id
                  ? 'ui-chip-selected'
                  : 'ui-chip-unselected text-[var(--muted-foreground)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-2 md:gap-3 pb-8">
        {!fetching && recipes.length === 0 ? (
          <div className="bg-[var(--card)] rounded-2xl p-8 text-center mt-4">
            <p className="ui-body-muted">No recipes found.</p>
            <Link href="/scan" className="ui-meta text-[var(--foreground)] font-medium underline mt-2 block">
              Scan your first bag
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
              {recipes.map(r => <RecipeListCard key={r.id} recipe={r} />)}
            </div>
            {fetching && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!fetching && hasMore && (
              <button
                onClick={() => fetchRecipes(page + 1, method, q, false)}
                className="ui-button-secondary w-full text-[var(--muted-foreground)]"
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>

      <div className="h-24" />
    </div>
  )
}
