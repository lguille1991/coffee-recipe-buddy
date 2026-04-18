import { describe, expect, it, vi } from 'vitest'
import { getOrCreateUserProfile } from '@/lib/profile'

function createProfileQuery({
  data,
  error = null,
}: {
  data: unknown
  error?: { code?: string; message: string } | null
}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
}

describe('getOrCreateUserProfile', () => {
  it('fills a blank display name without re-reading the profile table', async () => {
    const selectQuery = createProfileQuery({
      data: {
        display_name: null,
        default_volume_ml: 250,
        temp_unit: 'C',
        preferred_grinder: 'k_ultra',
      },
    })

    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateQuery = {
      eq: updateEq,
    }

    const from = vi.fn((table: string) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table ${table}`)
      }

      return {
        select: selectQuery.select,
        eq: selectQuery.eq,
        maybeSingle: selectQuery.maybeSingle,
        update: vi.fn().mockReturnValue(updateQuery),
      }
    })

    const supabase = { from }
    const user = {
      id: 'user-123',
      user_metadata: { full_name: 'Guillermo Abrego' },
    }

    const profile = await getOrCreateUserProfile(supabase as never, user as never)

    expect(profile.display_name).toBe('Guillermo Abrego')
    expect(from).toHaveBeenCalledTimes(2)
    expect(selectQuery.maybeSingle).toHaveBeenCalledTimes(1)
    expect(updateEq).toHaveBeenCalledWith('id', 'user-123')
  })
})
