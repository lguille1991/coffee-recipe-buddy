/** @vitest-environment jsdom */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { RecipeListItem } from '@/types/recipe'

const routerReplaceMock = vi.fn()
const routerRefreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
    refresh: routerRefreshMock,
  }),
  usePathname: () => '/recipes',
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/RecipeListCard', () => ({
  __esModule: true,
  default: ({ recipe }: { recipe: RecipeListItem }) => (
    <div data-testid={`nav-card-${recipe.id}`}>{recipe.bean_info.bean_name}</div>
  ),
}))

vi.mock('@/components/SelectableRecipeListCard', () => ({
  __esModule: true,
  default: ({
    recipe,
    selected,
    onToggle,
  }: {
    recipe: RecipeListItem
    selected: boolean
    onToggle: (id: string) => void
  }) => (
    <button
      type="button"
      data-testid={`select-card-${recipe.id}`}
      data-selected={selected ? 'true' : 'false'}
      onClick={() => onToggle(recipe.id)}
    >
      {recipe.bean_info.bean_name}
    </button>
  ),
}))

import RecipesClient from './RecipesClient'

function sampleRecipe(id: string, name: string, method = 'v60'): RecipeListItem {
  return {
    id,
    method,
    bean_info: {
      bean_name: name,
      process: 'washed',
      roast_level: 'light',
    },
    image_url: null,
    created_at: '2026-05-02T00:00:00.000Z',
    schema_version: 1,
    is_manual_created: false,
    has_manual_edits: false,
    has_feedback_adjustments: false,
    is_scaled: false,
  }
}

function clickButtonByText(container: HTMLElement, text: string) {
  const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  const button = Array.from(container.querySelectorAll('button')).find(
    candidate => normalize(candidate.textContent) === text,
  )
  if (!button) throw new Error(`Button not found: ${text}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function findButtonByPrefix(container: HTMLElement, prefix: string) {
  const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  return Array.from(container.querySelectorAll('button')).find(
    candidate => normalize(candidate.textContent).startsWith(prefix),
  )
}

function clickButtonByPrefix(container: HTMLElement, prefix: string) {
  const button = findButtonByPrefix(container, prefix)
  if (!button) throw new Error(`Button not found with prefix: ${prefix}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('RecipesClient bulk selection mode', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    routerReplaceMock.mockReset()
    routerRefreshMock.mockReset()
    vi.restoreAllMocks()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('supports select mode, select all/clear, and hides load more', async () => {
    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[
            sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A'),
            sampleRecipe('22222222-2222-2222-2222-222222222222', 'Bean B'),
          ]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={false}
          initialHasMore
        />,
      )
    })

    expect(findButtonByPrefix(container, 'Load more')).toBeTruthy()

    await act(async () => {
      clickButtonByText(container, 'Select')
    })

    expect(findButtonByPrefix(container, 'Load more')).toBeFalsy()
    expect(container.querySelector('[data-testid^="nav-card-"]')).toBeFalsy()

    await act(async () => {
      clickButtonByText(container, 'Select all visible')
    })

    expect(findButtonByPrefix(container, 'Delete (2)')).toBeTruthy()

    await act(async () => {
      clickButtonByText(container, 'Clear')
    })

    expect(findButtonByPrefix(container, 'Delete (0)')).toBeTruthy()
  })

  it('clears selection mode on filter changes', async () => {
    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[
            sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A', 'v60'),
            sampleRecipe('22222222-2222-2222-2222-222222222222', 'Bean B', 'chemex'),
          ]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={false}
          initialHasMore={false}
        />,
      )
    })

    await act(async () => {
      clickButtonByText(container, 'Select')
    })

    await act(async () => {
      clickButtonByText(container, 'Hario V60')
    })

    expect(findButtonByPrefix(container, 'Delete (')).toBeFalsy()
  })

  it('deletes selected recipes using archived_ids and refreshes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => ({
        archived_ids: ['11111111-1111-1111-1111-111111111111'],
      }),
    } as Response)

    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[
            sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A'),
            sampleRecipe('22222222-2222-2222-2222-222222222222', 'Bean B'),
          ]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={false}
          initialHasMore={false}
        />,
      )
    })

    await act(async () => {
      clickButtonByText(container, 'Select')
    })

    await act(async () => {
      clickButtonByText(container, 'Select all visible')
    })

    await act(async () => {
      clickButtonByPrefix(container, 'Delete (')
    })

    await act(async () => {
      clickButtonByText(container, 'Delete 2')
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/recipes/bulk-delete', expect.objectContaining({ method: 'POST' }))
    expect(container.textContent).not.toContain('Bean A')
    expect(container.textContent).toContain('Bean B')
    expect(routerRefreshMock).toHaveBeenCalledTimes(1)
  })

  it('restores selected archived recipes using bulk-restore and refreshes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => ({
        restored_ids: ['11111111-1111-1111-1111-111111111111'],
      }),
    } as Response)

    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[
            sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A'),
            sampleRecipe('22222222-2222-2222-2222-222222222222', 'Bean B'),
          ]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={true}
          initialHasMore={false}
        />,
      )
    })

    await act(async () => {
      clickButtonByText(container, 'Select')
    })

    await act(async () => {
      clickButtonByText(container, 'Select all visible')
    })

    await act(async () => {
      clickButtonByPrefix(container, 'Restore (')
    })

    await act(async () => {
      clickButtonByText(container, 'Restore 2')
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/recipes/bulk-restore', expect.objectContaining({ method: 'POST' }))
    expect(container.textContent).not.toContain('Bean A')
    expect(container.textContent).toContain('Bean B')
    expect(routerRefreshMock).toHaveBeenCalledTimes(1)
  })
})
