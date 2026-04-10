'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import RecipeListCard from '@/components/RecipeListCard'
import { METHOD_DISPLAY_NAMES, RecipeListItem } from '@/types/recipe'

const METHOD_FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  ...Object.entries(METHOD_DISPLAY_NAMES).map(([id, label]) => ({ id, label })),
]

type RecipesClientProps = {
  initialRecipes: RecipeListItem[]
  initialPage: number
  initialMethod: string
  initialQuery: string
  initialHasMore: boolean
}

export default function RecipesClient({
  initialRecipes,
  initialPage,
  initialMethod,
  initialQuery,
  initialHasMore,
}: RecipesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [recipes, setRecipes] = useState(initialRecipes)
  const [fetchingMore, setFetchingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(initialPage)
  const [method, setMethod] = useState(initialMethod)
  const [q, setQ] = useState(initialQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setRecipes(initialRecipes)
    setHasMore(initialHasMore)
    setPage(initialPage)
    setMethod(initialMethod)
    setQ(initialQuery)
  }, [initialHasMore, initialMethod, initialPage, initialQuery, initialRecipes])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  function updateUrl(next: { method?: string; q?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString())

    if (next.method !== undefined) {
      if (next.method) params.set('method', next.method)
      else params.delete('method')
    }

    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q)
      else params.delete('q')
    }

    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page))
      else params.delete('page')
    }

    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  function handleMethodChange(nextMethod: string) {
    setMethod(nextMethod)
    updateUrl({ method: nextMethod, page: 1 })
  }

  function handleSearchChange(value: string) {
    setQ(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateUrl({ q: value.trim(), page: 1 })
    }, 400)
  }

  async function handleLoadMore() {
    if (fetchingMore || !hasMore) return

    const nextPage = page + 1
    setFetchingMore(true)

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
      })
      if (method) params.set('method', method)
      if (q.trim()) params.set('q', q.trim())

      const response = await fetch(`/api/recipes?${params}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load more recipes')
      }

      const data = await response.json()
      const nextRecipes = (data.recipes ?? []) as RecipeListItem[]
      setRecipes(prev => [...prev, ...nextRecipes])
      setHasMore(nextRecipes.length === 20)
      setPage(nextPage)
      updateUrl({ page: nextPage })
    } finally {
      setFetchingMore(false)
    }
  }

  const showInitialLoading = isPending && recipes.length === 0

  if (showInitialLoading) {
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
            placeholder="Search bean, origin, roaster..."
            value={q}
            onChange={e => handleSearchChange(e.target.value)}
            className="ui-input pl-9"
          />
        </div>
      </div>

      <div className="px-4 sm:px-6 mb-4 overflow-x-auto pb-2">
        <div className="flex gap-2 w-max">
          {METHOD_FILTERS.map(filter => (
            <button
              key={filter.id}
              onClick={() => handleMethodChange(filter.id)}
              className={`ui-chip shrink-0 ${
                method === filter.id
                  ? 'ui-chip-selected'
                  : 'ui-chip-unselected text-[var(--muted-foreground)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-2 md:gap-3 pb-8">
        {!isPending && recipes.length === 0 ? (
          <div className="bg-[var(--card)] rounded-2xl p-8 text-center mt-4">
            <p className="ui-body-muted">No recipes found.</p>
            <Link href="/scan" className="ui-meta text-[var(--foreground)] font-medium underline mt-2 block">
              Scan your first bag
            </Link>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 transition-opacity ${isPending ? 'opacity-70' : 'opacity-100'}`}>
              {recipes.map(recipe => <RecipeListCard key={recipe.id} recipe={recipe} />)}
            </div>
            {(fetchingMore || isPending) && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!fetchingMore && !isPending && hasMore && (
              <button
                onClick={handleLoadMore}
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
