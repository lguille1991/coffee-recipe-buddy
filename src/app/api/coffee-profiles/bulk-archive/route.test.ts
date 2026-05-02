import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

import { POST } from './route'

function authedSupabaseClient(options?: {
  linkedRows?: Array<{ coffee_profile_id: string | null }>
  archivedIds?: string[]
}) {
  const linkedRows = options?.linkedRows ?? []
  const archivedIds = options?.archivedIds ?? []
  let coffeeProfilesCall = 0

  const recipesQuery = {
    select: vi.fn(() => recipesQuery),
    eq: vi.fn(() => recipesQuery),
    in: vi.fn(async () => ({ data: linkedRows, error: null })),
  }

  const archiveSelect = vi.fn(async () => ({
    data: archivedIds.map(id => ({ id })),
    error: null,
  }))
  const archiveIs = vi.fn(() => ({ select: archiveSelect }))
  const archiveIn = vi.fn(() => ({ is: archiveIs }))
  const archiveEq = vi.fn(() => ({ in: archiveIn }))
  const archiveUpdate = vi.fn(() => ({ eq: archiveEq }))

  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn((table: string) => {
      if (table === 'recipes') return recipesQuery
      coffeeProfilesCall += 1
      if (coffeeProfilesCall === 1) return { update: archiveUpdate }
      return { update: archiveUpdate }
    }),
    _mocks: { archiveUpdate, archiveEq, archiveIn, archiveIs, archiveSelect },
  }
}

describe('POST /api/coffee-profiles/bulk-archive', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'true'
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } })
    const response = await POST(new Request('http://localhost/api/coffee-profiles/bulk-archive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile_ids: ['11111111-1111-1111-1111-111111111111'] }),
    }))
    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid payload', async () => {
    createClientMock.mockResolvedValue(authedSupabaseClient())
    const response = await POST(new Request('http://localhost/api/coffee-profiles/bulk-archive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile_ids: ['not-a-uuid'] }),
    }))
    expect(response.status).toBe(400)
  })

  it('archives candidates and returns blocked profile ids', async () => {
    const supabase = authedSupabaseClient({
      linkedRows: [{ coffee_profile_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }],
      archivedIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
    })
    createClientMock.mockResolvedValue(supabase)

    const response = await POST(new Request('http://localhost/api/coffee-profiles/bulk-archive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        profile_ids: [
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        ],
      }),
    }))

    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.archived_ids).toEqual(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'])
    expect(payload.blocked_profile_ids).toEqual(['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'])
  })
})
