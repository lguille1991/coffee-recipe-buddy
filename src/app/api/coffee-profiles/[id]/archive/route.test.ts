import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { POST } from './route'

function createRecipesCountQuery(result: { count: number | null; error: { message: string } | null }) {
  let eqCalls = 0
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => {
      eqCalls += 1
      if (eqCalls >= 3) {
        return Promise.resolve(result)
      }
      return chain
    }),
  }

  return chain
}

function createArchiveUpdateQuery(result: { data: { id: string; archived_at: string } | null; error: { message: string } | null }) {
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

    expect(response.status).toBe(409)
  })

  it('archives when there are no active linked recipes', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'recipes') {
          return createRecipesCountQuery({ count: 0, error: null })
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
  })
})
