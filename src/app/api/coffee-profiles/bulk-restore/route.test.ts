import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

import { POST } from './route'

function authedSupabaseClient(options?: {
  selectedRows?: Array<{
    id: string
    label: string
    archived_at: string | null
    duplicate_fingerprint: string | null
    bean_profile_json: { process?: string | null; roast_level?: string | null }
  }>
  activeRows?: Array<{ id: string; duplicate_fingerprint: string | null }>
  restoredIds?: string[]
}) {
  const selectedRows = options?.selectedRows ?? []
  const activeRows = options?.activeRows ?? []
  const restoredIds = options?.restoredIds ?? []
  let coffeeProfilesCall = 0

  const selectedQuery = {
    select: vi.fn(() => selectedQuery),
    eq: vi.fn(() => selectedQuery),
    in: vi.fn(async () => ({ data: selectedRows, error: null })),
  }
  const activeQuery = {
    select: vi.fn(() => activeQuery),
    eq: vi.fn(() => activeQuery),
    is: vi.fn(() => activeQuery),
    in: vi.fn(async () => ({ data: activeRows, error: null })),
  }

  const restoreSelect = vi.fn(async () => ({ data: restoredIds.map(id => ({ id })), error: null }))
  const restoreNot = vi.fn(() => ({ select: restoreSelect }))
  const restoreIn = vi.fn(() => ({ not: restoreNot }))
  const restoreEq = vi.fn(() => ({ in: restoreIn }))
  const restoreUpdate = vi.fn(() => ({ eq: restoreEq }))

  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn(() => {
      coffeeProfilesCall += 1
      if (coffeeProfilesCall === 1) return selectedQuery
      if (coffeeProfilesCall === 2) return activeQuery
      return { update: restoreUpdate }
    }),
  }
}

describe('POST /api/coffee-profiles/bulk-restore', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'true'
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } })
    const response = await POST(new Request('http://localhost/api/coffee-profiles/bulk-restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile_ids: ['11111111-1111-1111-1111-111111111111'] }),
    }))
    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid payload', async () => {
    createClientMock.mockResolvedValue(authedSupabaseClient())
    const response = await POST(new Request('http://localhost/api/coffee-profiles/bulk-restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile_ids: ['not-a-uuid'] }),
    }))
    expect(response.status).toBe(400)
  })

  it('restores profiles and returns blocked duplicate ids', async () => {
    createClientMock.mockResolvedValue(authedSupabaseClient({
      selectedRows: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          label: 'Coffee A',
          archived_at: '2026-05-01T00:00:00Z',
          duplicate_fingerprint: 'fp-a',
          bean_profile_json: { process: 'washed', roast_level: 'medium' },
        },
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          label: 'Coffee B',
          archived_at: '2026-05-01T00:00:00Z',
          duplicate_fingerprint: 'fp-b',
          bean_profile_json: { process: 'washed', roast_level: 'medium' },
        },
      ],
      activeRows: [{ id: 'active-1', duplicate_fingerprint: 'fp-b' }],
      restoredIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
    }))

    const response = await POST(new Request('http://localhost/api/coffee-profiles/bulk-restore', {
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
    expect(payload.restored_ids).toEqual(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'])
    expect(payload.blocked_profile_ids).toEqual(['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'])
  })
})
