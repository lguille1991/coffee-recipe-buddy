import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

import { POST } from './route'

describe('POST /api/recipes/[id]/restore', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    })

    const response = await POST(new Request('http://localhost/api/recipes/r1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'r1' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 404 for missing or already active recipe', async () => {
    const recipeQuery = {
      select: vi.fn(() => recipeQuery),
      eq: vi.fn(() => recipeQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    }

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn(() => recipeQuery),
    })

    const response = await POST(new Request('http://localhost/api/recipes/r1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'r1' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 409 when linked coffee profile is archived', async () => {
    const recipeQuery = {
      select: vi.fn(() => recipeQuery),
      eq: vi.fn(() => recipeQuery),
      maybeSingle: vi.fn(async () => ({
        data: { id: 'r1', archived: true, coffee_profile_id: 'cp1', coffee_profile_user_id: 'u1' },
        error: null,
      })),
    }

    const profileQuery = {
      select: vi.fn(() => profileQuery),
      eq: vi.fn(() => profileQuery),
      maybeSingle: vi.fn(async () => ({ data: { archived_at: '2026-05-01T00:00:00Z' }, error: null })),
    }

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn((table: string) => (table === 'recipes' ? recipeQuery : profileQuery)),
    })

    const response = await POST(new Request('http://localhost/api/recipes/r1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'r1' }),
    })

    expect(response.status).toBe(409)
  })

  it('restores recipe when linked profile is active', async () => {
    let recipesCall = 0
    const recipeLoadQuery = {
      select: vi.fn(() => recipeLoadQuery),
      eq: vi.fn(() => recipeLoadQuery),
      maybeSingle: vi.fn(async () => ({
        data: { id: 'r1', archived: true, coffee_profile_id: 'cp1', coffee_profile_user_id: 'u1' },
        error: null,
      })),
    }
    const recipeRestoreQuery = {
      update: vi.fn(() => recipeRestoreQuery),
      eq: vi.fn(() => recipeRestoreQuery),
      select: vi.fn(() => recipeRestoreQuery),
      single: vi.fn(async () => ({ data: { id: 'r1', archived: false }, error: null })),
    }
    const profileQuery = {
      select: vi.fn(() => profileQuery),
      eq: vi.fn(() => profileQuery),
      maybeSingle: vi.fn(async () => ({ data: { archived_at: null }, error: null })),
    }

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'recipes') {
          recipesCall += 1
          return recipesCall === 1 ? recipeLoadQuery : recipeRestoreQuery
        }
        return profileQuery
      }),
    })

    const response = await POST(new Request('http://localhost/api/recipes/r1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'r1' }),
    })

    expect(response.status).toBe(200)
  })
})
