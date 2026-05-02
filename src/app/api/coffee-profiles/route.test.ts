import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET, POST } from './route'

function createAuthedSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }
}

function createAuthedSupabaseClientForPost() {
  const coffeeProfilesInsertQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'profile-1',
        user_id: 'user-1',
        label: 'Coffee',
        bean_profile_json: { process: 'washed', roast_level: 'medium' },
        scan_source: 'scan',
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-01T00:00:00.000Z',
        last_used_at: null,
        archived_at: null,
      },
      error: null,
    }),
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'coffee_profiles') {
        return coffeeProfilesInsertQuery
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }),
  }
}

function createAuthedSupabaseClientForDuplicatePost() {
  const coffeeProfilesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined,
  }

  coffeeProfilesQuery.eq
    .mockReturnValue(coffeeProfilesQuery)

  coffeeProfilesQuery.select.mockImplementation(() => coffeeProfilesQuery)
  coffeeProfilesQuery.is.mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue({
      data: [{
        id: 'profile-existing',
        label: 'Coffee',
        bean_profile_json: {
          roaster: 'Roaster',
          bean_name: 'Bean',
          origin: 'Origin',
          process: 'washed',
          roast_level: 'medium',
        },
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-01T00:00:00.000Z',
        archived_at: null,
        duplicate_fingerprint: 'fp',
      }],
      error: null,
    }),
  }))

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'coffee_profiles') return coffeeProfilesQuery
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }),
  }
}

describe('api/coffee-profiles route auth', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'true'
  })

  it('GET returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const response = await GET(new Request('http://localhost/api/coffee-profiles'))
    expect(response.status).toBe(401)
  })

  it('GET returns 404 when feature flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'false'
    const response = await GET(new Request('http://localhost/api/coffee-profiles'))
    expect(response.status).toBe(404)
  })

  it('POST returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const response = await POST(new Request('http://localhost/api/coffee-profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'Coffee',
        bean_profile_json: { process: 'washed', roast_level: 'medium' },
      }),
    }))

    expect(response.status).toBe(401)
  })

  it('GET returns profile list for authenticated user', async () => {
    createClientMock.mockResolvedValue(createAuthedSupabaseClient())
    const response = await GET(new Request('http://localhost/api/coffee-profiles'))
    expect(response.status).toBe(200)
  })

  it('POST returns profile id and typed image status when no image is provided', async () => {
    createClientMock.mockResolvedValue(createAuthedSupabaseClientForPost())

    const response = await POST(new Request('http://localhost/api/coffee-profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'Coffee',
        bean_profile_json: { process: 'washed', roast_level: 'medium' },
      }),
    }))

    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.profile?.id).toBe('profile-1')
    expect(body.primary_image_status).toBe('none')
    expect(body.primary_image_error).toBeNull()
  })

  it('POST returns 409 duplicate_blocked and does not insert on active duplicate', async () => {
    const supabase = createAuthedSupabaseClientForDuplicatePost()
    createClientMock.mockResolvedValue(supabase)

    const response = await POST(new Request('http://localhost/api/coffee-profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'Coffee',
        bean_profile_json: {
          roaster: 'Roaster',
          bean_name: 'Bean',
          origin: 'Origin',
          process: 'washed',
          roast_level: 'medium',
        },
      }),
    }))

    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.status).toBe('duplicate_blocked')
    expect(body.selected_candidate_id).toBe('profile-existing')
    expect(body.candidates?.length).toBeGreaterThan(0)
  })
})
