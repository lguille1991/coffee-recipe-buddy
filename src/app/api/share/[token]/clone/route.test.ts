import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'

const {
  createClientMock,
  createRecipeSnapshotMock,
  mirrorRecipeLiveSnapshotMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createRecipeSnapshotMock: vi.fn(),
  mirrorRecipeLiveSnapshotMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/recipe-snapshots', () => ({
  createRecipeSnapshot: createRecipeSnapshotMock,
  mirrorRecipeLiveSnapshot: mirrorRecipeLiveSnapshotMock,
}))

import { POST } from './route'

function createSingleResultQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.single.mockResolvedValue(result)

  return query
}

function createInsertSingleQuery(result: { data: unknown; error: unknown }) {
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  }

  query.insert.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.single.mockResolvedValue(result)

  return query
}

function createInsertResultQuery(result: { error: unknown }) {
  return {
    insert: vi.fn().mockResolvedValue(result),
  }
}

describe('POST /api/share/[token]/clone', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createRecipeSnapshotMock.mockReset()
    mirrorRecipeLiveSnapshotMock.mockReset()

    createRecipeSnapshotMock.mockResolvedValue({ id: 'snapshot-1' })
    mirrorRecipeLiveSnapshotMock.mockResolvedValue({})
  })

  it('creates a shared membership for the cloned recipe so it appears in the shared list', async () => {
    const sharedRecipeQuery = createSingleResultQuery({
      data: {
        snapshot_json: {
          bean_info: WASHED_LIGHT_BEAN,
          current_recipe_json: BASE_RECIPE,
          image_url: null,
          owner_display_name: 'Sharer',
          notes: null,
        },
      },
      error: null,
    })

    const clonedRecipeQuery = createInsertSingleQuery({
      data: {
        id: '22222222-2222-2222-2222-222222222222',
      },
      error: null,
    })

    const membershipInsertQuery = createInsertResultQuery({ error: null })

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: '11111111-1111-1111-1111-111111111111',
            },
          },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'shared_recipes') return sharedRecipeQuery
        if (table === 'recipes') return clonedRecipeQuery
        if (table === 'recipe_share_memberships') return membershipInsertQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const response = await POST(new Request('http://localhost/api/share/share-token/clone', {
      method: 'POST',
    }), {
      params: Promise.resolve({ token: 'share-token' }),
    })

    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({ id: '22222222-2222-2222-2222-222222222222' })
    expect(membershipInsertQuery.insert).toHaveBeenCalledWith({
      recipe_id: '22222222-2222-2222-2222-222222222222',
      owner_id: '11111111-1111-1111-1111-111111111111',
      recipient_id: '11111111-1111-1111-1111-111111111111',
      hidden_at: null,
    })
  })

  it('still clones successfully when the memberships table is not available yet', async () => {
    const sharedRecipeQuery = createSingleResultQuery({
      data: {
        snapshot_json: {
          bean_info: WASHED_LIGHT_BEAN,
          current_recipe_json: BASE_RECIPE,
          image_url: null,
          owner_display_name: 'Sharer',
          notes: null,
        },
      },
      error: null,
    })

    const clonedRecipeQuery = createInsertSingleQuery({
      data: {
        id: '22222222-2222-2222-2222-222222222222',
      },
      error: null,
    })

    const membershipInsertQuery = createInsertResultQuery({
      error: { message: "Could not find the table 'public.recipe_share_memberships'" },
    })

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: '11111111-1111-1111-1111-111111111111',
            },
          },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'shared_recipes') return sharedRecipeQuery
        if (table === 'recipes') return clonedRecipeQuery
        if (table === 'recipe_share_memberships') return membershipInsertQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const response = await POST(new Request('http://localhost/api/share/share-token/clone', {
      method: 'POST',
    }), {
      params: Promise.resolve({ token: 'share-token' }),
    })

    expect(response.status).toBe(201)
  })
})
