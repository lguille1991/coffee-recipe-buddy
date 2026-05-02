import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'
import { resetIdempotencyStateForTests } from '@/lib/request-idempotency'

const {
  createClientMock,
  saveRecipeWithSnapshotMock,
  uploadBagPhotoFromDataUrlMock,
  listRecipesForUserMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  saveRecipeWithSnapshotMock: vi.fn(),
  uploadBagPhotoFromDataUrlMock: vi.fn(),
  listRecipesForUserMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/save-recipe', () => ({
  saveRecipeWithSnapshot: saveRecipeWithSnapshotMock,
}))

vi.mock('@/lib/bag-photo-storage', () => ({
  uploadBagPhotoFromDataUrl: uploadBagPhotoFromDataUrlMock,
}))

vi.mock('@/lib/recipe-list', () => ({
  listRecipesForUser: listRecipesForUserMock,
}))

import { POST } from './route'

function createSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '11111111-1111-1111-1111-111111111111' } },
      }),
    },
  }
}

describe('POST /api/recipes', () => {
  beforeEach(() => {
    resetIdempotencyStateForTests()
    createClientMock.mockReset()
    saveRecipeWithSnapshotMock.mockReset()
    uploadBagPhotoFromDataUrlMock.mockReset()
    listRecipesForUserMock.mockReset()

    createClientMock.mockResolvedValue(createSupabaseClient())
    uploadBagPhotoFromDataUrlMock.mockResolvedValue(null)
    saveRecipeWithSnapshotMock.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
    })
  })

  it('returns same recipe and 201/200 for concurrent identical save requests', async () => {
    const body = JSON.stringify({
      bean_info: WASHED_LIGHT_BEAN,
      method: 'v60',
      original_recipe_json: BASE_RECIPE,
      current_recipe_json: BASE_RECIPE,
      feedback_history: [],
    })

    const [resA, resB] = await Promise.all([
      POST(new Request('http://localhost/api/recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })),
      POST(new Request('http://localhost/api/recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })),
    ])

    const payloadA = await resA.json()
    const payloadB = await resB.json()

    expect(new Set([resA.status, resB.status])).toEqual(new Set([200, 201]))
    expect(payloadA.id).toBe(payloadB.id)
    expect(saveRecipeWithSnapshotMock).toHaveBeenCalledTimes(1)
  })
})
