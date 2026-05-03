'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import RecipeListCard from '@/components/RecipeListCard'
import ConfirmSheet from '@/components/ConfirmSheet'
import SelectableRecipeListCard from '@/components/SelectableRecipeListCard'
import { expectOk, runClientMutation } from '@/lib/client-mutation'
import { METHOD_DISPLAY_NAMES, RecipeListItem } from '@/types/recipe'

const METHOD_FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  ...Object.entries(METHOD_DISPLAY_NAMES).map(([id, label]) => ({ id, label })),
]

const SECTION_TABS: Array<{ id: 'favorites' | 'my' | 'shared'; label: string }> = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'my', label: 'My Recipes' },
  { id: 'shared', label: 'Shared Recipes' },
]

type RecipesClientProps = {
  initialRecipes: RecipeListItem[]
  initialPage: number
  initialMethod: string
  initialQuery: string
  initialArchived: boolean
  initialSection: 'favorites' | 'my' | 'shared'
  initialTotalPages: number
}

export default function RecipesClient({
  initialRecipes,
  initialPage,
  initialMethod,
  initialQuery,
  initialArchived,
  initialSection,
  initialTotalPages,
}: RecipesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [recipes, setRecipes] = useState(initialRecipes)
  const [page] = useState(initialPage)
  const [method, setMethod] = useState(initialMethod)
  const [q, setQ] = useState(initialQuery)
  const [archived, setArchived] = useState(initialArchived)
  const [section, setSection] = useState(initialSection)
  const [totalPages] = useState(initialTotalPages)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showActionConfirm, setShowActionConfirm] = useState(false)
  const [bulkMutating, setBulkMutating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  function updateUrl(next: { method?: string; q?: string; page?: number; archived?: boolean; section?: string }) {
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

    if (next.archived !== undefined) {
      if (next.archived) params.set('archived', 'true')
      else params.delete('archived')
    }

    if (next.section !== undefined) {
      if (next.section && next.section !== 'my') params.set('section', next.section)
      else params.delete('section')
    }

    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  function resetSelectionState() {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setActionError(null)
  }

  function handleArchivedToggle(nextArchived: boolean) {
    resetSelectionState()
    setArchived(nextArchived)
    updateUrl({ archived: nextArchived, page: 1 })
  }

  function handleSectionChange(nextSection: 'favorites' | 'my' | 'shared') {
    resetSelectionState()
    setSection(nextSection)
    if (nextSection !== 'my') setArchived(false)
    updateUrl({ section: nextSection, archived: nextSection === 'my' ? archived : false, page: 1 })
  }

  function handleMethodChange(nextMethod: string) {
    resetSelectionState()
    setMethod(nextMethod)
    updateUrl({ method: nextMethod, page: 1 })
  }

  function handleSearchChange(value: string) {
    resetSelectionState()
    setQ(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateUrl({ q: value.trim(), page: 1 })
    }, 400)
  }

  function goToPage(nextPage: number) {
    updateUrl({ page: nextPage })
  }

  function toggleSelectionMode() {
    if (section !== 'my') return
    setSelectionMode(prev => !prev)
    setSelectedIds(new Set())
    setActionError(null)
  }

  function toggleRecipeSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectVisible() {
    const selectableIds = recipes.filter(recipe => recipe.can_archive || archived).map(recipe => recipe.id)
    setSelectedIds(new Set(selectableIds))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleRemoveFromMyList(recipeId: string) {
    setActionError(null)
    await runClientMutation({
      execute: async () => {
        const response = await fetch(`/api/recipes/${recipeId}/shared-membership`, {
          method: 'DELETE',
        })
        await expectOk(response, 'Failed to remove shared recipe')
      },
      onSuccess: async () => {
        setRecipes(prev => prev.filter(recipe => recipe.id !== recipeId))
        router.refresh()
      },
      onError: setActionError,
      errorMessage: 'Failed to remove shared recipe from your list. Please try again.',
    })
  }

  async function confirmBulkDelete() {
    if (selectedIds.size === 0) return

    setBulkMutating(true)
    setActionError(null)
    await runClientMutation({
      execute: async () => {
        const response = await fetch('/api/recipes/bulk-delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ recipe_ids: Array.from(selectedIds) }),
        })
        await expectOk(response, 'Failed to delete selected recipes')
        return response.json() as Promise<{ archived_ids?: string[] }>
      },
      onSuccess: async (result) => {
        const archivedIds = new Set(result.archived_ids ?? [])
        setRecipes(prev => prev.filter(recipe => !archivedIds.has(recipe.id)))
        resetSelectionState()
        setShowActionConfirm(false)
        router.refresh()
      },
      onError: setActionError,
      onSettled: () => setBulkMutating(false),
      errorMessage: 'Failed to delete selected recipes. Please try again.',
    })
  }

  async function confirmBulkRestore() {
    if (selectedIds.size === 0) return

    setBulkMutating(true)
    setActionError(null)
    await runClientMutation({
      execute: async () => {
        const response = await fetch('/api/recipes/bulk-restore', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ recipe_ids: Array.from(selectedIds) }),
        })
        await expectOk(response, 'Failed to restore selected recipes')
        return response.json() as Promise<{ restored_ids?: string[] }>
      },
      onSuccess: async (result) => {
        const restoredIds = new Set(result.restored_ids ?? [])
        setRecipes(prev => prev.filter(recipe => !restoredIds.has(recipe.id)))
        resetSelectionState()
        setShowActionConfirm(false)
        router.refresh()
      },
      onError: setActionError,
      onSettled: () => setBulkMutating(false),
      errorMessage: 'Failed to restore selected recipes. Please try again.',
    })
  }

  const showInitialLoading = isPending && recipes.length === 0
  const canSelect = section === 'my'

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
        <div className="flex items-center justify-between gap-3">
          <h1 className="ui-page-title">Recipes</h1>
          {canSelect && (
            <button
              type="button"
              onClick={toggleSelectionMode}
              className="ui-button-secondary px-4 py-2 text-sm"
            >
              {selectionMode ? 'Done' : 'Select'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 mb-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5">
          <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]" role="group" aria-label="Recipe sections">
            {SECTION_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`px-4 py-2 text-sm ${section === tab.id ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--card)] text-[var(--muted-foreground)]'}`}
                onClick={() => handleSectionChange(tab.id)}
                aria-pressed={section === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {section === 'my' && (
            <div className="sm:ml-auto inline-flex overflow-hidden rounded-lg border border-[var(--border)]" role="group" aria-label="Recipe status">
              <button
                type="button"
                className={`px-4 py-2 text-sm ${!archived ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--card)] text-[var(--muted-foreground)]'}`}
                onClick={() => handleArchivedToggle(false)}
                aria-pressed={!archived}
              >
                Active
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm ${archived ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--card)] text-[var(--muted-foreground)]'}`}
                onClick={() => handleArchivedToggle(true)}
                aria-pressed={archived}
              >
                Archived
              </button>
            </div>
          )}
        </div>
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

      {selectionMode && recipes.length > 0 && (
        <div className="px-4 sm:px-6 mb-3 flex items-center justify-between">
          <div className="ui-meta">{selectedIds.size} selected</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={selectVisible} className="ui-button-secondary px-3 py-1.5 text-sm">Select all visible</button>
            <button type="button" onClick={clearSelection} className="ui-button-secondary px-3 py-1.5 text-sm">Clear</button>
          </div>
        </div>
      )}

      <div className={`flex-1 px-4 sm:px-6 flex flex-col gap-2 md:gap-3 ${selectionMode ? 'pb-44' : 'pb-8'}`}>
        {actionError && <div className="ui-alert-danger text-sm">{actionError}</div>}
        {!isPending && recipes.length === 0 ? (
          <div className="bg-[var(--card)] rounded-2xl p-8 text-center mt-4">
            <p className="ui-body-muted">No recipes found.</p>
            <Link href="/scan" className="ui-meta text-[var(--foreground)] font-medium underline mt-2 block">Scan your first bag</Link>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 transition-opacity ${isPending ? 'opacity-70' : 'opacity-100'}`}>
            {recipes.map(recipe => (
              <div key={recipe.id} className="space-y-1.5">
                {selectionMode
                  ? <SelectableRecipeListCard recipe={recipe} selected={selectedIds.has(recipe.id)} onToggle={toggleRecipeSelected} />
                  : <RecipeListCard recipe={recipe} disableLink={section === 'my' && archived} />}
                {!selectionMode && (
                  <div className="flex flex-wrap gap-2 px-1">
                    {recipe.can_remove_from_list && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFromMyList(recipe.id)}
                        className="ui-button-secondary px-3 py-1.5 text-xs"
                      >
                        Remove from my list
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!selectionMode && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || isPending}
              className="ui-button-secondary px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Prev
            </button>
            <p className="ui-meta">Page {page} of {totalPages}</p>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || isPending}
              className="ui-button-secondary px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {selectionMode && recipes.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-4 sm:px-6 lg:pl-56 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-lg">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowActionConfirm(true)}
                disabled={selectedIds.size === 0 || bulkMutating}
                className={`${archived ? 'ui-button-primary' : 'ui-button-danger-solid'} w-full disabled:opacity-40`}
              >
                {archived ? `Restore (${selectedIds.size})` : `Delete (${selectedIds.size})`}
              </button>
              <button type="button" onClick={toggleSelectionMode} disabled={bulkMutating} className="ui-button-secondary w-full">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={showActionConfirm}
        title={archived
          ? `Restore ${selectedIds.size} recipe${selectedIds.size === 1 ? '' : 's'}?`
          : `Delete ${selectedIds.size} recipe${selectedIds.size === 1 ? '' : 's'}?`}
        message={archived
          ? 'This will restore selected recipes back to your active recipe list.'
          : 'This will archive them and hide them from your recipe list.'}
        confirmLabel={archived ? `Restore ${selectedIds.size}` : `Delete ${selectedIds.size}`}
        destructive={!archived}
        loading={bulkMutating}
        onConfirm={archived ? confirmBulkRestore : confirmBulkDelete}
        onCancel={() => setShowActionConfirm(false)}
      />

      <div className="h-24" />
    </div>
  )
}
