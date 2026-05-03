import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'
import type { SavedRecipeDetail } from '@/types/recipe'

const {
  createClientMock,
  createRecipeSnapshotMock,
  getSavedRecipeDetailMock,
  mirrorRecipeLiveSnapshotMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createRecipeSnapshotMock: vi.fn(),
  getSavedRecipeDetailMock: vi.fn(),
  mirrorRecipeLiveSnapshotMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/recipe-detail', () => ({
  getSavedRecipeDetail: getSavedRecipeDetailMock,
}))

vi.mock('@/lib/recipe-snapshots', () => ({
  createRecipeSnapshot: createRecipeSnapshotMock,
  mirrorRecipeLiveSnapshot: mirrorRecipeLiveSnapshotMock,
}))

import { DELETE, PATCH } from './route'

const BASE_DETAIL: SavedRecipeDetail = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: '22222222-2222-2222-2222-222222222222',
  schema_version: 1,
  bean_info: WASHED_LIGHT_BEAN,
  method: 'v60',
  original_recipe_json: BASE_RECIPE,
  current_recipe_json: BASE_RECIPE,
  feedback_history: [],
  image_url: null,
  notes: null,
  creator_display_name: null,
  created_at: '2026-04-08T00:00:00.000Z',
  archived: false,
  live_snapshot_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parent_recipe_id: null,
  scale_factor: null,
  snapshots: [],
}

function createQuery(singleResult: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.single.mockResolvedValue(singleResult)
  return query
}

function createSupabaseClient() {
  const recipesQuery = createQuery({
    data: {
      id: BASE_DETAIL.id,
      user_id: BASE_DETAIL.user_id,
      live_snapshot_id: BASE_DETAIL.live_snapshot_id,
    },
    error: null,
  })
  const snapshotsQuery = createQuery({
    data: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      snapshot_recipe_json: BASE_RECIPE,
    },
    error: null,
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: BASE_DETAIL.user_id },
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'recipe_snapshots') return snapshotsQuery
      return recipesQuery
    }),
  }
}

describe('PATCH /api/recipes/[id]', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createRecipeSnapshotMock.mockReset()
    getSavedRecipeDetailMock.mockReset()
    mirrorRecipeLiveSnapshotMock.mockReset()
    createClientMock.mockResolvedValue(createSupabaseClient())
    getSavedRecipeDetailMock.mockResolvedValue(BASE_DETAIL)
  })

  it('switches the live snapshot without creating a new snapshot', async () => {
    mirrorRecipeLiveSnapshotMock.mockResolvedValue({ id: BASE_DETAIL.id })

    const response = await PATCH(new Request('http://localhost/api/recipes/111', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        live_snapshot_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      }),
    }), {
      params: Promise.resolve({ id: BASE_DETAIL.id }),
    })

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(createRecipeSnapshotMock).not.toHaveBeenCalled()
    expect(mirrorRecipeLiveSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      recipeId: BASE_DETAIL.id,
      liveSnapshotId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      currentRecipeJson: BASE_RECIPE,
    }))
    expect(body.id).toBe(BASE_DETAIL.id)
  })

  it('creates a new immutable snapshot when saving recipe content', async () => {
    createRecipeSnapshotMock.mockResolvedValue({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      recipe_id: BASE_DETAIL.id,
      user_id: BASE_DETAIL.user_id,
      snapshot_index: 2,
      snapshot_kind: 'manual_edit',
      snapshot_recipe_json: BASE_RECIPE,
      change_summary: [{ field: 'grind', previous_value: '80', new_value: '82' }],
      created_at: '2026-04-12T12:00:00.000Z',
      source_snapshot_id: BASE_DETAIL.live_snapshot_id,
    })
    mirrorRecipeLiveSnapshotMock.mockResolvedValue({ id: BASE_DETAIL.id })

    const response = await PATCH(new Request('http://localhost/api/recipes/111', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        snapshot_kind: 'manual_edit',
        change_summary: [{ field: 'grind', previous_value: '80', new_value: '82' }],
        current_recipe_json: BASE_RECIPE,
        feedback_history: [],
        source_snapshot_id: BASE_DETAIL.live_snapshot_id,
      }),
    }), {
      params: Promise.resolve({ id: BASE_DETAIL.id }),
    })

    expect(response.status).toBe(200)
    expect(createRecipeSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      recipeId: BASE_DETAIL.id,
      snapshotKind: 'manual_edit',
      snapshotRecipeJson: BASE_RECIPE,
      sourceSnapshotId: BASE_DETAIL.live_snapshot_id,
    }))
    expect(mirrorRecipeLiveSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      recipeId: BASE_DETAIL.id,
      liveSnapshotId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      currentRecipeJson: BASE_RECIPE,
      feedbackHistory: [],
    }))
  })
})

describe('DELETE /api/recipes/[id]', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('scopes archive update to recipe id, user id, and non-archived rows', async () => {
    const favoriteMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const favoriteEqSecond = vi.fn(() => ({ maybeSingle: favoriteMaybeSingle }))
    const favoriteEqFirst = vi.fn(() => ({ eq: favoriteEqSecond }))
    const favoriteSelect = vi.fn(() => ({ eq: favoriteEqFirst }))

    const eq = vi.fn()
    const update = vi.fn(() => ({ eq }))
    eq
      .mockReturnValueOnce({ eq })
      .mockReturnValueOnce({ eq })
      .mockResolvedValueOnce({ error: null })

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: BASE_DETAIL.user_id } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'recipe_user_favorites') return { select: favoriteSelect }
        return { update }
      }),
    })

    const response = await DELETE(new Request('http://localhost/api/recipes/111', {
      method: 'DELETE',
    }), {
      params: Promise.resolve({ id: BASE_DETAIL.id }),
    })

    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(update).toHaveBeenCalledWith({ archived: true })
    expect(eq).toHaveBeenNthCalledWith(1, 'id', BASE_DETAIL.id)
    expect(eq).toHaveBeenNthCalledWith(2, 'user_id', BASE_DETAIL.user_id)
    expect(eq).toHaveBeenNthCalledWith(3, 'archived', false)
  })
})
