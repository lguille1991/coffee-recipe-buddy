import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'
import type { SavedRecipe } from '@/types/recipe'

const {
  createClientMock,
  migrateRecipeMock,
  notFoundMock,
  redirectMock,
  getRecipeShareInfoMock,
  headersMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`)
  }),
  notFoundMock: vi.fn(() => {
    throw new Error('notFound')
  }),
  createClientMock: vi.fn(),
  migrateRecipeMock: vi.fn(recipe => recipe),
  getRecipeShareInfoMock: vi.fn().mockResolvedValue({
    shareToken: null,
    commentCount: null,
  }),
  headersMock: vi.fn().mockResolvedValue(new Headers({
    host: 'localhost:3000',
  })),
}))

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}))

vi.mock('next/headers', () => ({
  headers: headersMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/recipe-migrations', () => ({
  migrateRecipe: migrateRecipeMock,
}))

vi.mock('@/lib/share', () => ({
  getRecipeShareInfo: getRecipeShareInfoMock,
}))

import SavedRecipeDetailPage from './page'
import BrewModePage from './brew/page'
import AutoAdjustPage from './auto-adjust/page'

const BASE_SAVED_RECIPE: SavedRecipe = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: '22222222-2222-2222-2222-222222222222',
  schema_version: 1,
  bean_info: WASHED_LIGHT_BEAN,
  method: 'v60',
  original_recipe_json: BASE_RECIPE,
  current_recipe_json: BASE_RECIPE,
  feedback_history: [],
  image_url: null,
  notes: null,
  created_at: '2026-04-08T00:00:00.000Z',
  archived: false,
  parent_recipe_id: null,
  scale_factor: null,
}

function createSupabaseClient(userId: string | null, recipe = BASE_SAVED_RECIPE) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.single.mockResolvedValue({ data: recipe, error: null })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
    from: vi.fn().mockReturnValue(query),
  }
}

describe('recipe route pages', () => {
  beforeEach(() => {
    redirectMock.mockClear()
    notFoundMock.mockClear()
    createClientMock.mockReset()
    migrateRecipeMock.mockClear()
    getRecipeShareInfoMock.mockClear()
    headersMock.mockClear()
  })

  it('redirects unauthenticated users away from saved recipe detail', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient(null))

    await expect(
      SavedRecipeDetailPage({ params: Promise.resolve({ id: 'recipe-123' }) }),
    ).rejects.toThrow('redirect:/auth?returnTo=/recipes/recipe-123')
  })

  it('redirects unauthenticated users away from brew mode', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient(null))

    await expect(
      BrewModePage({ params: Promise.resolve({ id: 'recipe-123' }) }),
    ).rejects.toThrow('redirect:/auth?returnTo=/recipes/recipe-123/brew')
  })

  it('loads saved recipe detail by id for authenticated users', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient(BASE_SAVED_RECIPE.user_id))

    const result = await SavedRecipeDetailPage({
      params: Promise.resolve({ id: BASE_SAVED_RECIPE.id }),
    })

    expect(result.props.id).toBe(BASE_SAVED_RECIPE.id)
    expect(result.props.initialRecipe.id).toBe(BASE_SAVED_RECIPE.id)
    expect(migrateRecipeMock).toHaveBeenCalledTimes(2)
  })

  it('loads brew mode by id for authenticated users', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient(BASE_SAVED_RECIPE.user_id))

    const result = await BrewModePage({
      params: Promise.resolve({ id: BASE_SAVED_RECIPE.id }),
    })

    expect(result.props.id).toBe(BASE_SAVED_RECIPE.id)
    expect(result.props.recipe.id).toBe(BASE_SAVED_RECIPE.id)
    expect(migrateRecipeMock).toHaveBeenCalledTimes(2)
  })

  it('redirects unauthenticated users away from auto adjust', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient(null))

    await expect(
      AutoAdjustPage({ params: Promise.resolve({ id: 'recipe-123' }) }),
    ).rejects.toThrow('redirect:/auth?returnTo=/recipes/recipe-123/auto-adjust')
  })

  it('loads auto adjust by id for authenticated users', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient(BASE_SAVED_RECIPE.user_id))

    const result = await AutoAdjustPage({
      params: Promise.resolve({ id: BASE_SAVED_RECIPE.id }),
    })

    expect(result.props.id).toBe(BASE_SAVED_RECIPE.id)
    expect(result.props.sourceRecipe.id).toBe(BASE_SAVED_RECIPE.id)
    expect(migrateRecipeMock).toHaveBeenCalledTimes(2)
  })
})
