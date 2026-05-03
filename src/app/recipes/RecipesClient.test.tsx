/** @vitest-environment jsdom */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { RecipeListItem } from '@/types/recipe'

const routerReplaceMock = vi.fn()
const routerRefreshMock = vi.fn()
let searchParamsValue = ''
let viewportResizeHandler: (() => void) | null = null

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock, refresh: routerRefreshMock }),
  usePathname: () => '/recipes',
  useSearchParams: () => new URLSearchParams(searchParamsValue),
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
  default: ({ recipe, selected, onToggle }: { recipe: RecipeListItem; selected: boolean; onToggle: (id: string) => void }) => (
    <button type="button" data-testid={`select-card-${recipe.id}`} data-selected={selected ? 'true' : 'false'} onClick={() => onToggle(recipe.id)}>
      {recipe.bean_info.bean_name}
    </button>
  ),
}))

import RecipesClient from './RecipesClient'

function sampleRecipe(id: string, name: string, method = 'v60'): RecipeListItem {
  return {
    id,
    owner_user_id: '99999999-9999-9999-9999-999999999999',
    method,
    bean_info: { bean_name: name, process: 'washed', roast_level: 'light' },
    image_url: null,
    created_at: '2026-05-02T00:00:00.000Z',
    schema_version: 1,
    archived: false,
    is_favorite: false,
    source: 'owned',
    can_delete: true,
    can_archive: true,
    can_remove_from_list: false,
    is_manual_created: false,
    has_manual_edits: false,
    has_feedback_adjustments: false,
    is_scaled: false,
  }
}

function clickButtonByText(container: HTMLElement, text: string) {
  const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  const button = Array.from(container.querySelectorAll('button')).find(candidate => normalize(candidate.textContent) === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function findButtonByPrefix(container: HTMLElement, prefix: string) {
  const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  return Array.from(container.querySelectorAll('button')).find(candidate => normalize(candidate.textContent).startsWith(prefix))
}

function clickButtonByPrefix(container: HTMLElement, prefix: string) {
  const button = findButtonByPrefix(container, prefix)
  if (!button) throw new Error(`Button not found with prefix: ${prefix}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function expectRouterReplacePathAndParams(
  mock: ReturnType<typeof vi.fn>,
  expectedPath: string,
  expectedParams: Record<string, string>,
) {
  const [url, options] = mock.mock.lastCall as [string, { scroll: boolean }]
  expect(options).toEqual({ scroll: false })

  const [path, query = ''] = url.split('?')
  expect(path).toBe(expectedPath)

  const params = new URLSearchParams(query)
  expect(Object.fromEntries(params.entries())).toEqual(expectedParams)
}

function setViewportHeight(height: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

describe('RecipesClient bulk selection mode', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    routerReplaceMock.mockReset()
    routerRefreshMock.mockReset()
    searchParamsValue = ''
    vi.restoreAllMocks()
    viewportResizeHandler = null
    setViewportHeight(900)
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        get height() {
          return this._height
        },
        _height: 900,
        addEventListener: (_event: string, handler: () => void) => {
          viewportResizeHandler = handler
        },
        removeEventListener: () => {
          viewportResizeHandler = null
        },
      },
    })
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('supports select mode, select all/clear, and shows pagination controls', async () => {
    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A'), sampleRecipe('22222222-2222-2222-2222-222222222222', 'Bean B')]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={false}
          initialSection="my"
          initialTotalPages={3}
        />,
      )
    })

    expect(findButtonByPrefix(container, 'Prev')).toBeTruthy()

    await act(async () => {
      clickButtonByText(container, 'Select')
    })

    expect(findButtonByPrefix(container, 'Prev')).toBeFalsy()

    await act(async () => {
      clickButtonByText(container, 'Select all visible')
    })

    expect(findButtonByPrefix(container, 'Delete (2)')).toBeTruthy()

    await act(async () => {
      clickButtonByText(container, 'Clear')
    })

    expect(findButtonByPrefix(container, 'Delete (0)')).toBeTruthy()
  })

  it('deletes selected recipes using archived_ids and refreshes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({ ok: true, json: async () => ({ archived_ids: ['11111111-1111-1111-1111-111111111111'] }) } as Response)

    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A'), sampleRecipe('22222222-2222-2222-2222-222222222222', 'Bean B')]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={false}
          initialSection="my"
          initialTotalPages={1}
        />,
      )
    })

    await act(async () => { clickButtonByText(container, 'Select') })
    await act(async () => { clickButtonByText(container, 'Select all visible') })
    await act(async () => { clickButtonByPrefix(container, 'Delete (') })
    await act(async () => { clickButtonByText(container, 'Delete 2') })

    expect(fetchMock).toHaveBeenCalledWith('/api/recipes/bulk-delete', expect.objectContaining({ method: 'POST' }))
    expect(container.textContent).not.toContain('Bean A')
    expect(container.textContent).toContain('Bean B')
    expect(routerRefreshMock).toHaveBeenCalledTimes(1)
  })

  it('hides archived controls outside my recipes and clears archived in URL on section change', async () => {
    searchParamsValue = 'archived=true&page=3&method=v60&q=ethiopia'
    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A')]}
          initialPage={3}
          initialMethod="v60"
          initialQuery="ethiopia"
          initialArchived
          initialSection="my"
          initialTotalPages={3}
        />,
      )
    })

    expect(findButtonByPrefix(container, 'Active')).toBeTruthy()
    expect(findButtonByPrefix(container, 'Archived')).toBeTruthy()

    await act(async () => {
      clickButtonByText(container, 'Favorites')
    })

    expect(findButtonByPrefix(container, 'Active')).toBeFalsy()
    expect(findButtonByPrefix(container, 'Archived')).toBeFalsy()
    expect(findButtonByPrefix(container, 'Select')).toBeFalsy()
    expectRouterReplacePathAndParams(routerReplaceMock, '/recipes', {
      method: 'v60',
      q: 'ethiopia',
      section: 'favorites',
    })
  })

  it('updates archived state for my recipes and keeps existing search filters', async () => {
    searchParamsValue = 'method=v60&q=kenya'
    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A')]}
          initialPage={1}
          initialMethod="v60"
          initialQuery="kenya"
          initialArchived={false}
          initialSection="my"
          initialTotalPages={1}
        />,
      )
    })

    await act(async () => {
      clickButtonByText(container, 'Archived')
    })

    expectRouterReplacePathAndParams(routerReplaceMock, '/recipes', {
      method: 'v60',
      q: 'kenya',
      archived: 'true',
    })
  })

  it('resets selection mode and selected count when section changes', async () => {
    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A'), sampleRecipe('22222222-2222-2222-2222-222222222222', 'Bean B')]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={false}
          initialSection="my"
          initialTotalPages={1}
        />,
      )
    })

    await act(async () => { clickButtonByText(container, 'Select') })
    await act(async () => { clickButtonByText(container, 'Select all visible') })
    expect(findButtonByPrefix(container, 'Delete (2)')).toBeTruthy()

    await act(async () => { clickButtonByText(container, 'Favorites') })

    expect(findButtonByPrefix(container, 'Delete (')).toBeFalsy()
    expect(findButtonByPrefix(container, 'Select all visible')).toBeFalsy()
    expect(findButtonByPrefix(container, 'Select')).toBeFalsy()
  })

  it('hides bulk action bar when the mobile keyboard opens and restores it when closed', async () => {
    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A')]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={false}
          initialSection="my"
          initialTotalPages={1}
        />,
      )
    })

    await act(async () => { clickButtonByText(container, 'Select') })
    await act(async () => { clickButtonByText(container, 'Select all visible') })
    expect(findButtonByPrefix(container, 'Delete (1)')).toBeTruthy()

    await act(async () => {
      setViewportHeight(900)
      ;(window.visualViewport as { _height: number })._height = 700
      viewportResizeHandler?.()
    })
    expect(findButtonByPrefix(container, 'Delete (1)')).toBeFalsy()

    await act(async () => {
      ;(window.visualViewport as { _height: number })._height = 900
      viewportResizeHandler?.()
    })
    expect(findButtonByPrefix(container, 'Delete (1)')).toBeTruthy()
  })

  it('still hides bulk action bar when keyboard open also shrinks window.innerHeight', async () => {
    await act(async () => {
      root.render(
        <RecipesClient
          initialRecipes={[sampleRecipe('11111111-1111-1111-1111-111111111111', 'Bean A')]}
          initialPage={1}
          initialMethod=""
          initialQuery=""
          initialArchived={false}
          initialSection="my"
          initialTotalPages={1}
        />,
      )
    })

    await act(async () => { clickButtonByText(container, 'Select') })
    await act(async () => { clickButtonByText(container, 'Select all visible') })
    expect(findButtonByPrefix(container, 'Delete (1)')).toBeTruthy()

    await act(async () => {
      setViewportHeight(760)
      ;(window.visualViewport as { _height: number })._height = 760
      viewportResizeHandler?.()
    })
    expect(findButtonByPrefix(container, 'Delete (1)')).toBeFalsy()
  })
})
