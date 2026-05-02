import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'
import { resetIdempotencyStateForTests } from '@/lib/request-idempotency'

const {
  createClientMock,
  createOpenRouterClientMock,
  buildAuthenticatedOpenRouterUserIdMock,
  generateRecipeWithRetriesMock,
  saveRecipeWithSnapshotMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createOpenRouterClientMock: vi.fn(),
  buildAuthenticatedOpenRouterUserIdMock: vi.fn(),
  generateRecipeWithRetriesMock: vi.fn(),
  saveRecipeWithSnapshotMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/openrouter', () => ({
  createOpenRouterClient: createOpenRouterClientMock,
  buildAuthenticatedOpenRouterUserId: buildAuthenticatedOpenRouterUserIdMock,
}))

vi.mock('@/lib/recipe-generation', () => ({
  generateRecipeWithRetries: generateRecipeWithRetriesMock,
}))

vi.mock('@/lib/save-recipe', () => ({
  saveRecipeWithSnapshot: saveRecipeWithSnapshotMock,
}))

import { POST } from './route'

function createQuery(singleResult: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.single.mockResolvedValue(singleResult)
  return query
}

function createSupabaseClient(options?: { archived?: boolean; notFound?: boolean }) {
  const profileQuery = createQuery({
    data: options?.notFound ? null : {
      id: 'profile-1',
      user_id: 'user-1',
      label: 'Test Coffee',
      bean_profile_json: WASHED_LIGHT_BEAN,
      archived_at: options?.archived ? '2026-05-01T00:00:00.000Z' : null,
    },
    error: options?.notFound ? { message: 'Not found' } : null,
  })

  const userProfileQuery = createQuery({
    data: { default_volume_ml: 250 },
    error: null,
  })

  const updateQuery = createQuery({ data: null, error: null })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'coffee_profiles') return profileQuery
      if (table === 'profiles') return userProfileQuery
      return updateQuery
    }),
  }
}

describe('POST /api/recipes/from-profile', () => {
  beforeEach(() => {
    resetIdempotencyStateForTests()
    createClientMock.mockReset()
    createOpenRouterClientMock.mockReset()
    buildAuthenticatedOpenRouterUserIdMock.mockReset()
    generateRecipeWithRetriesMock.mockReset()
    saveRecipeWithSnapshotMock.mockReset()
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'true'

    createClientMock.mockResolvedValue(createSupabaseClient())
    createOpenRouterClientMock.mockReturnValue({})
    buildAuthenticatedOpenRouterUserIdMock.mockReturnValue('crp:test-user')
    generateRecipeWithRetriesMock.mockResolvedValue(BASE_RECIPE)
    saveRecipeWithSnapshotMock.mockResolvedValue({ id: 'recipe-1' })
  })

  it('returns 401 when user is not authenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const response = await POST(new Request('http://localhost/api/recipes/from-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coffee_profile_id: '11111111-1111-1111-1111-111111111111',
        method: 'v60',
        goal: 'balanced',
        water_mode: 'absolute',
        water_grams: 250,
      }),
    }) as never)

    expect(response.status).toBe(401)
  })

  it('returns 404 when feature flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'false'
    const response = await POST(new Request('http://localhost/api/recipes/from-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coffee_profile_id: '11111111-1111-1111-1111-111111111111',
        method: 'v60',
        goal: 'balanced',
        water_mode: 'absolute',
        water_grams: 250,
      }),
    }) as never)

    expect(response.status).toBe(404)
  })

  it('returns 409 for archived coffee profiles', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient({ archived: true }))

    const response = await POST(new Request('http://localhost/api/recipes/from-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coffee_profile_id: '11111111-1111-1111-1111-111111111111',
        method: 'v60',
        goal: 'balanced',
        water_mode: 'absolute',
        water_grams: 250,
      }),
    }) as never)

    expect(response.status).toBe(409)
    expect(generateRecipeWithRetriesMock).not.toHaveBeenCalled()
  })

  it('returns 404 when profile is not found for user', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient({ notFound: true }))

    const response = await POST(new Request('http://localhost/api/recipes/from-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coffee_profile_id: '11111111-1111-1111-1111-111111111111',
        method: 'v60',
        goal: 'balanced',
        water_mode: 'absolute',
        water_grams: 250,
      }),
    }) as never)

    expect(response.status).toBe(404)
    expect(generateRecipeWithRetriesMock).not.toHaveBeenCalled()
  })

  it('returns 400 for non-canonical method', async () => {
    const response = await POST(new Request('http://localhost/api/recipes/from-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coffee_profile_id: '11111111-1111-1111-1111-111111111111',
        method: 'espresso',
        goal: 'balanced',
        water_mode: 'absolute',
        water_grams: 250,
      }),
    }) as never)

    expect(response.status).toBe(400)
    expect(generateRecipeWithRetriesMock).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid water mode payload', async () => {
    const response = await POST(new Request('http://localhost/api/recipes/from-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coffee_profile_id: '11111111-1111-1111-1111-111111111111',
        method: 'v60',
        goal: 'balanced',
        water_mode: 'absolute',
      }),
    }) as never)

    expect(response.status).toBe(400)
    expect(generateRecipeWithRetriesMock).not.toHaveBeenCalled()
  })

  it('generates and persists a recipe from profile with provenance context', async () => {
    const response = await POST(new Request('http://localhost/api/recipes/from-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coffee_profile_id: '11111111-1111-1111-1111-111111111111',
        method: 'v60',
        goal: 'sweetness',
        water_mode: 'delta',
        water_delta_grams: 20,
      }),
    }) as never)

    expect(response.status).toBe(201)
    expect(generateRecipeWithRetriesMock).toHaveBeenCalled()
    expect(saveRecipeWithSnapshotMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      bean_info: WASHED_LIGHT_BEAN,
      coffee_profile_id: 'profile-1',
      coffee_profile_user_id: 'user-1',
      generation_context: expect.objectContaining({
        source: 'profile',
        goal: 'sweetness',
        water_mode: 'delta',
        water_delta_grams: 20,
        method: 'v60',
      }),
    }))
  })

  it('includes debug parity metadata when DEBUG_RECIPE_PARITY=1', async () => {
    vi.stubEnv('DEBUG_RECIPE_PARITY', '1')
    vi.stubEnv('SKILL_GRIND_PARITY_MODE', 'skill_v2')
    vi.stubEnv('STRICT_GRINDER_TABLE_PARITY', '1')

    const response = await POST(new Request('http://localhost/api/recipes/from-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coffee_profile_id: '11111111-1111-1111-1111-111111111111',
        method: 'v60',
        goal: 'balanced',
        water_mode: 'absolute',
        water_grams: 250,
      }),
    }) as never)

    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body._debug).toEqual({
      grind_parity_mode: 'skill_v2',
      strict_grinder_table_parity: true,
    })

    vi.unstubAllEnvs()
  })

  it('prevents duplicate recipe saves for concurrent identical requests', async () => {
    const body = JSON.stringify({
      coffee_profile_id: '11111111-1111-1111-1111-111111111111',
      method: 'v60',
      goal: 'balanced',
      water_mode: 'absolute',
      water_grams: 250,
    })

    const [resA, resB] = await Promise.all([
      POST(new Request('http://localhost/api/recipes/from-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }) as never),
      POST(new Request('http://localhost/api/recipes/from-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }) as never),
    ])

    expect(new Set([resA.status, resB.status])).toEqual(new Set([200, 201]))
    expect(saveRecipeWithSnapshotMock).toHaveBeenCalledTimes(1)
  })
})
