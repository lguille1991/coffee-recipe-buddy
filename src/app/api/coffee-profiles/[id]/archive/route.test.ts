import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { POST } from './route'

const ACTIVE_LINKED_RECIPES_ERROR = 'Cannot archive coffee profile while it is linked to existing active recipes'

function createRecipesCountQuery(result: { count: number | null; error: { message: string } | null }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    then: undefined,
  }

  chain.eq.mockImplementation((column: string) => {
    if (column === 'archived') {
      return Promise.resolve(result)
    }
    return chain
  })

  return chain
}

function createArchiveUpdateQuery(result: {
  data: { id: string; archived_at: string } | null
  error: { code?: string; message: string } | null
}) {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(async () => result),
  }

  return chain
}

describe('POST /api/coffee-profiles/[id]/archive', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'true'
  })

  it('returns 404 when feature flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'false'

    const response = await POST(new Request('http://localhost/api/coffee-profiles/profile-1/archive', { method: 'POST' }), {
      params: Promise.resolve({ id: 'profile-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/profile-1/archive', { method: 'POST' }), {
      params: Promise.resolve({ id: 'profile-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 500 when count query fails', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
      from: vi.fn(() => createRecipesCountQuery({ count: null, error: { message: 'count-failed' } })),
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/profile-1/archive', { method: 'POST' }), {
      params: Promise.resolve({ id: 'profile-1' }),
    })

    expect(response.status).toBe(500)
  })

  it('returns 409 when profile is linked to active recipes', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'recipes') {
          return createRecipesCountQuery({ count: 2, error: null })
        }

        return createArchiveUpdateQuery({
          data: { id: 'profile-1', archived_at: '2026-05-01T00:00:00Z' },
          error: null,
        })
      }),
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/profile-1/archive', { method: 'POST' }), {
      params: Promise.resolve({ id: 'profile-1' }),
    })

    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.error).toBe(ACTIVE_LINKED_RECIPES_ERROR)
  })

  it('maps trigger conflict error to 409', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'recipes') {
          return createRecipesCountQuery({ count: 0, error: null })
        }

        return createArchiveUpdateQuery({
          data: null,
          error: { code: 'P0001', message: ACTIVE_LINKED_RECIPES_ERROR },
        })
      }),
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/profile-1/archive', { method: 'POST' }), {
      params: Promise.resolve({ id: 'profile-1' }),
    })

    expect(response.status).toBe(409)
  })

  it('returns 404 when profile is already archived or missing', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'recipes') {
          return createRecipesCountQuery({ count: 0, error: null })
        }

        return createArchiveUpdateQuery({ data: null, error: null })
      }),
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/profile-1/archive', { method: 'POST' }), {
      params: Promise.resolve({ id: 'profile-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('archives when there are no linked active recipes', async () => {
    const recipesQuery = createRecipesCountQuery({ count: 0, error: null })

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'recipes') {
          return recipesQuery
        }

        return createArchiveUpdateQuery({
          data: { id: 'profile-1', archived_at: '2026-05-01T00:00:00Z' },
          error: null,
        })
      }),
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/profile-1/archive', { method: 'POST' }), {
      params: Promise.resolve({ id: 'profile-1' }),
    })

    expect(response.status).toBe(200)
    expect(recipesQuery.eq).toHaveBeenNthCalledWith(3, 'archived', false)
  })
})
