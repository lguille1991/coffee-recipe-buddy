import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

import { POST } from './route'

describe('POST /api/coffee-profiles/[id]/restore', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'true'
  })

  it('returns 404 when feature flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'false'
    const response = await POST(new Request('http://localhost/api/coffee-profiles/c1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'c1' }),
    })
    expect(response.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/c1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'c1' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 404 when profile is missing or already active', async () => {
    const loadQuery = {
      select: vi.fn(() => loadQuery),
      eq: vi.fn(() => loadQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    }

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn(() => loadQuery),
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/c1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'c1' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns duplicate_blocked for restore duplicate conflicts', async () => {
    let coffeeProfilesCall = 0
    const loadQuery = {
      select: vi.fn(() => loadQuery),
      eq: vi.fn(() => loadQuery),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'c1',
          user_id: 'u1',
          label: 'Coffee',
          bean_profile_json: { process: 'washed', roast_level: 'medium' },
          archived_at: '2026-05-01T00:00:00Z',
          duplicate_fingerprint: 'fp',
        },
        error: null,
      })),
    }

    const restoreQuery = {
      update: vi.fn(() => restoreQuery),
      eq: vi.fn(() => restoreQuery),
      not: vi.fn(() => restoreQuery),
      select: vi.fn(() => restoreQuery),
      single: vi.fn(async () => ({ data: null, error: { code: '23505', message: 'duplicate key' } })),
    }

    const duplicateLookup = {
      select: vi.fn(() => duplicateLookup),
      eq: vi.fn(() => duplicateLookup),
      is: vi.fn(() => duplicateLookup),
      neq: vi.fn(async () => ({
        data: [{
          id: 'existing',
          label: 'Coffee',
          bean_profile_json: { process: 'washed', roast_level: 'medium' },
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-01T00:00:00Z',
        }],
      })),
    }

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn((table: string) => {
        if (table !== 'coffee_profiles') return loadQuery
        coffeeProfilesCall += 1
        if (coffeeProfilesCall === 1) return loadQuery
        if (coffeeProfilesCall === 2) return restoreQuery
        return duplicateLookup
      }),
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/c1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'c1' }),
    })

    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.status).toBe('duplicate_blocked')
  })

  it('restores archived profile', async () => {
    let coffeeProfilesCall = 0
    const loadQuery = {
      select: vi.fn(() => loadQuery),
      eq: vi.fn(() => loadQuery),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'c1',
          user_id: 'u1',
          label: 'Coffee',
          bean_profile_json: { process: 'washed', roast_level: 'medium' },
          archived_at: '2026-05-01T00:00:00Z',
          duplicate_fingerprint: 'fp',
        },
        error: null,
      })),
    }

    const restoreQuery = {
      update: vi.fn(() => restoreQuery),
      eq: vi.fn(() => restoreQuery),
      not: vi.fn(() => restoreQuery),
      select: vi.fn(() => restoreQuery),
      single: vi.fn(async () => ({ data: { id: 'c1', archived_at: null }, error: null })),
    }

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn(() => {
        coffeeProfilesCall += 1
        return coffeeProfilesCall === 1 ? loadQuery : restoreQuery
      }),
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles/c1/restore', { method: 'POST' }), {
      params: Promise.resolve({ id: 'c1' }),
    })

    expect(response.status).toBe(200)
  })
})
