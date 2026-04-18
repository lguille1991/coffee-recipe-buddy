import { describe, expect, it, vi } from 'vitest'
import { listRecipesForUser } from '@/lib/recipe-list'

function createRecipesQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
  }
}

describe('listRecipesForUser', () => {
  it('requests one extra row to detect additional pages without shifting the page window', async () => {
    const query = createRecipesQuery()
    const supabase = {
      from: vi.fn().mockReturnValue(query),
    }

    await listRecipesForUser(supabase as never, {
      userId: 'user-123',
      page: 2,
      limit: 20,
    })

    expect(query.range).toHaveBeenCalledWith(20, 40)
  })
})
