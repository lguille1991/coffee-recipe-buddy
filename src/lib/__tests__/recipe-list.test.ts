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
})
