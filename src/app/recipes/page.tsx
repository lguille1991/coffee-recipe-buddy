'use client'

import { useEffect, useState, useCallback, useRef, memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { RecipeListItem, METHOD_DISPLAY_NAMES, MethodId } from '@/types/recipe'
import MethodIcon from '@/components/MethodIcon'

const METHOD_FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  ...Object.entries(METHOD_DISPLAY_NAMES).map(([id, label]) => ({ id, label })),
]

const RecipeCard = memo(function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const displayName = METHOD_DISPLAY_NAMES[recipe.method as MethodId] ?? recipe.method
  const beanName = recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Unknown bean'
  const roaster = recipe.bean_info.roaster
  const date = new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const badge = recipe.has_manual_edits
    ? 'edited'
    : recipe.has_feedback_adjustments
      ? 'auto-adjusted'
      : recipe.is_scaled
        ? 'scaled'
        : null

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="flex items-center gap-3 bg-[var(--card)] rounded-2xl p-3 active:opacity-80 transition-opacity"
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--border)] shrink-0 flex items-center justify-center">
        {recipe.image_url ? (
          <Image src={recipe.image_url} alt={beanName} width={56} height={56} className="w-full h-full object-cover" />
        ) : (
          <MethodIcon method={recipe.method} size={28} className="text-[var(--muted-foreground)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">{beanName}</p>
        {roaster && <p className="text-[10px] text-[var(--muted-foreground)] truncate">{roaster}</p>}
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-[var(--muted-foreground)]">{displayName}</p>
          {badge && (
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
              badge === 'edited'
                ? 'bg-blue-100 text-blue-600'
                : badge === 'scaled'
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-amber-100 text-amber-600'
            }`}>
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] text-[var(--muted-foreground)]">{date}</p>
        <svg className="mt-1.5 ml-auto" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  )
})

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
      const res = await fetch(`/api/recipes?${params}`, { signal: controller.signal })
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

      {/* Header */}
      <div className="px-6 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">My Recipes</h1>
      </div>

      {/* Search */}
      <div className="px-6 mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search bean, origin, roaster…"
            value={q}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-[12px] pl-9 pr-4 py-2.5 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--foreground)] transition-colors"
          />
        </div>
      </div>

      {/* Method chips */}
      <div className="px-6 mb-4 overflow-x-auto pb-2">
        <div className="flex gap-2 w-max">
          {METHOD_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setMethod(f.id)}
              className={`shrink-0 text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
                method === f.id
                  ? 'bg-[var(--foreground)] text-[var(--background)]'
                  : 'bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe list */}
      <div className="flex-1 px-6 flex flex-col gap-2 pb-8">
        {!fetching && recipes.length === 0 ? (
          <div className="bg-[var(--card)] rounded-2xl p-8 text-center mt-4">
            <p className="text-sm text-[var(--muted-foreground)]">No recipes found.</p>
            <Link href="/scan" className="text-xs text-[var(--foreground)] font-medium underline mt-2 block">
              Scan your first bag
            </Link>
          </div>
        ) : (
          <>
            {recipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
            {fetching && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!fetching && hasMore && (
              <button
                onClick={() => fetchRecipes(page + 1, method, q, false)}
                className="w-full py-3 text-sm text-[var(--muted-foreground)] font-medium border border-[var(--border)] rounded-[14px] bg-[var(--card)] active:opacity-80"
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
