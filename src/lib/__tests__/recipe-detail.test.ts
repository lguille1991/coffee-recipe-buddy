import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSavedRecipeDetail } from '@/lib/recipe-detail'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'

const { listRecipeSnapshotsMock } = vi.hoisted(() => ({
  listRecipeSnapshotsMock: vi.fn(),
}))

vi.mock('@/lib/recipe-snapshots', () => ({
  listRecipeSnapshots: listRecipeSnapshotsMock,
}))

describe('getSavedRecipeDetail', () => {
  beforeEach(() => {
    listRecipeSnapshotsMock.mockReset()
  })

  it('maps persisted generation_context.goal onto the saved recipe detail payload', async () => {
    listRecipeSnapshotsMock.mockResolvedValue([])

    const recipeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
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
          creator: { display_name: 'Guillermo' },
          created_at: '2026-05-14T00:00:00.000Z',
          archived: false,
          live_snapshot_id: null,
          parent_recipe_id: null,
          scale_factor: null,
          coffee_profile_id: '33333333-3333-3333-3333-333333333333',
          generation_context: {
            source: 'profile',
            goal: 'body',
            water_mode: 'absolute',
            water_grams: 250,
            method: 'v60',
          },
        },
        error: null,
      }),
    }

    const favoriteQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'recipes') return recipeQuery
        if (table === 'recipe_user_favorites') return favoriteQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    const result = await getSavedRecipeDetail(
      supabase as never,
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    )

    expect(result?.goal).toBe('body')
    expect(result?.creator_display_name).toBe('Guillermo')
  })

  it('falls back to the deterministic profile objective suffix when generation_context.goal is missing', async () => {
    listRecipeSnapshotsMock.mockResolvedValue([])

    const objectiveWithGoal = `${BASE_RECIPE.objective} Target goal: sweetness.`
    const recipeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          user_id: '22222222-2222-2222-2222-222222222222',
          schema_version: 1,
          bean_info: WASHED_LIGHT_BEAN,
          method: 'v60',
          original_recipe_json: {
            ...BASE_RECIPE,
            objective: objectiveWithGoal,
          },
          current_recipe_json: {
            ...BASE_RECIPE,
            objective: objectiveWithGoal,
          },
          feedback_history: [],
          image_url: null,
          notes: null,
          creator: { display_name: 'Guillermo' },
          created_at: '2026-05-14T00:00:00.000Z',
          archived: false,
          live_snapshot_id: null,
          parent_recipe_id: null,
          scale_factor: null,
          coffee_profile_id: '33333333-3333-3333-3333-333333333333',
          generation_context: null,
        },
        error: null,
      }),
    }

    const favoriteQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'recipes') return recipeQuery
        if (table === 'recipe_user_favorites') return favoriteQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    const result = await getSavedRecipeDetail(
      supabase as never,
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    )

    expect(result?.goal).toBe('sweetness')
  })
})
