import { describe, expect, it, vi } from 'vitest'
import { listRecipesForUser } from '@/lib/recipe-list'

describe('listRecipesForUser', () => {
  it('returns paged data and total pages for my recipes', async () => {
    const recipeRows = Array.from({ length: 15 }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
      user_id: 'user-123',
      method: 'v60',
      bean_info: { bean_name: `Bean ${index}`, process: 'washed', roast_level: 'light' },
      image_url: null,
      created_at: `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      schema_version: 1,
      archived: false,
      current_recipe_json: { objective: 'x', range_logic: { base_range: 'x' } },
      feedback_history: [],
      parent_recipe_id: null,
    }))

    const favoritesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    const recipeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: recipeRows, error: null }),
      or: vi.fn().mockReturnThis(),
    }

    const supabase = {
      from: vi.fn((table: string) => table === 'recipe_user_favorites' ? favoritesQuery : recipeQuery),
    }

    const result = await listRecipesForUser(supabase as never, {
      userId: 'user-123',
      section: 'my',
      page: 2,
      limit: 10,
    })

    expect(result.page).toBe(2)
    expect(result.totalPages).toBe(2)
    expect(result.totalCount).toBe(15)
    expect(result.recipes).toHaveLength(5)
  })

  it('maps persisted generation_context goals onto recipe list items', async () => {
    const recipeRows = [{
      id: '00000000-0000-0000-0000-000000000001',
      user_id: 'user-123',
      method: 'v60',
      bean_info: { bean_name: 'Bean 1', process: 'washed', roast_level: 'light' },
      image_url: null,
      created_at: '2026-05-01T00:00:00.000Z',
      schema_version: 1,
      archived: false,
      current_recipe_json: { objective: 'x', range_logic: { base_range: 'x' } },
      feedback_history: [],
      parent_recipe_id: null,
      generation_context: { goal: 'sweetness' },
    }, {
      id: '00000000-0000-0000-0000-000000000002',
      user_id: 'user-123',
      method: 'origami',
      bean_info: { bean_name: 'Bean 2', process: 'natural', roast_level: 'medium' },
      image_url: null,
      created_at: '2026-05-02T00:00:00.000Z',
      schema_version: 1,
      archived: false,
      current_recipe_json: { objective: 'x', range_logic: { base_range: 'x' } },
      feedback_history: [],
      parent_recipe_id: null,
      generation_context: null,
    }]

    const favoritesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    const recipeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: recipeRows, error: null }),
      or: vi.fn().mockReturnThis(),
    }

    const supabase = {
      from: vi.fn((table: string) => table === 'recipe_user_favorites' ? favoritesQuery : recipeQuery),
    }

    const result = await listRecipesForUser(supabase as never, {
      userId: 'user-123',
      section: 'my',
      page: 1,
      limit: 10,
    })

    expect(result.recipes[1].goal).toBe('sweetness')
    expect(result.recipes[0].goal).toBeUndefined()
  })

  it('falls back to the deterministic profile objective suffix when generation_context.goal is missing', async () => {
    const recipeRows = [{
      id: '00000000-0000-0000-0000-000000000001',
      user_id: 'user-123',
      method: 'v60',
      bean_info: { bean_name: 'Bean 1', process: 'washed', roast_level: 'light' },
      image_url: null,
      created_at: '2026-05-01T00:00:00.000Z',
      schema_version: 1,
      archived: false,
      current_recipe_json: {
        objective: 'Profile-generated recipe for juicy sweetness. Target goal: body.',
        range_logic: { base_range: 'x' },
      },
      feedback_history: [],
      parent_recipe_id: null,
      generation_context: null,
    }]

    const favoritesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    const recipeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: recipeRows, error: null }),
      or: vi.fn().mockReturnThis(),
    }

    const supabase = {
      from: vi.fn((table: string) => table === 'recipe_user_favorites' ? favoritesQuery : recipeQuery),
    }

    const result = await listRecipesForUser(supabase as never, {
      userId: 'user-123',
      section: 'my',
      page: 1,
      limit: 10,
    })

    expect(result.recipes[0].goal).toBe('body')
  })
})
