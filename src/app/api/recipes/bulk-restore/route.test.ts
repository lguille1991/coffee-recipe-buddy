import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { POST } from './route'

function authedSupabaseClient(options?: {
  selectedRows?: Array<{ id: string; coffee_profile_id: string | null; coffee_profile_user_id: string | null }>
  profiles?: Array<{ id: string; archived_at: string | null }>
  restoredIds?: string[]
}) {
  const selectedRows = options?.selectedRows ?? []
  const profiles = options?.profiles ?? []
  const restoredIds = options?.restoredIds ?? []
  let recipesSelectCalled = false

  const recipesSelectQuery = {
    select: vi.fn(() => recipesSelectQuery),
    eq: vi.fn(() => recipesSelectQuery),
    in: vi.fn(() => recipesSelectQuery),
    then: undefined,
  }
  recipesSelectQuery.eq.mockImplementation((column: string) => {
    if (column === 'archived') {
      return Promise.resolve({ data: selectedRows, error: null })
    }
    return recipesSelectQuery
  })

  const profilesQuery = {
    select: vi.fn(() => profilesQuery),
    eq: vi.fn(() => profilesQuery),
    in: vi.fn(async () => ({ data: profiles, error: null })),
  }

  const updateSelect = vi.fn(async () => ({
    data: restoredIds.map(id => ({ id })),
    error: null,
  }))
  const updateEqSecond = vi.fn(() => ({ select: updateSelect }))
  const updateIn = vi.fn(() => ({ eq: updateEqSecond }))
  const updateEqFirst = vi.fn(() => ({ in: updateIn }))
  const update = vi.fn(() => ({ eq: updateEqFirst }))

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '11111111-1111-1111-1111-111111111111' } },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'recipes') {
        if (!recipesSelectCalled) {
          recipesSelectCalled = true
          return recipesSelectQuery
        }
        return { update }
      }
      return profilesQuery
    }),
    _mocks: { update, updateEqFirst, updateIn, updateEqSecond, updateSelect },
  }
}

describe('POST /api/recipes/bulk-restore', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const response = await POST(new Request('http://localhost/api/recipes/bulk-restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipe_ids: ['11111111-1111-1111-1111-111111111111'] }),
    }))

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid payload', async () => {
    createClientMock.mockResolvedValue(authedSupabaseClient())

    const response = await POST(new Request('http://localhost/api/recipes/bulk-restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipe_ids: ['not-a-uuid'] }),
    }))

    expect(response.status).toBe(400)
  })

  it('returns 409 when linked coffee profiles are archived', async () => {
    const supabase = authedSupabaseClient({
      selectedRows: [{
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        coffee_profile_id: 'profile-1',
        coffee_profile_user_id: '11111111-1111-1111-1111-111111111111',
      }],
      profiles: [{ id: 'profile-1', archived_at: '2026-05-01T00:00:00Z' }],
    })
    createClientMock.mockResolvedValue(supabase)

    const response = await POST(new Request('http://localhost/api/recipes/bulk-restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipe_ids: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] }),
    }))

    const payload = await response.json()
    expect(response.status).toBe(409)
    expect(payload.blocked_recipe_ids).toEqual(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'])
  })

  it('restores matched archived rows and returns restored ids plus counts', async () => {
    const supabase = authedSupabaseClient({
      selectedRows: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          coffee_profile_id: null,
          coffee_profile_user_id: null,
        },
      ],
      restoredIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
    })
    createClientMock.mockResolvedValue(supabase)

    const response = await POST(new Request('http://localhost/api/recipes/bulk-restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipe_ids: [
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        ],
      }),
    }))

    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.restored_ids).toEqual(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'])
    expect(payload.restored_count).toBe(1)
    expect(payload.requested_count).toBe(2)

    expect(supabase._mocks.update).toHaveBeenCalledWith({ archived: false })
    expect(supabase._mocks.updateEqFirst).toHaveBeenCalledWith('user_id', '11111111-1111-1111-1111-111111111111')
    expect(supabase._mocks.updateIn).toHaveBeenCalledWith('id', [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ])
    expect(supabase._mocks.updateEqSecond).toHaveBeenCalledWith('archived', true)
  })
})
