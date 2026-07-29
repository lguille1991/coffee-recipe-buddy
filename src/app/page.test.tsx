import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecipeListItem } from '@/types/recipe'

const {
  createClientMock,
  getOrCreateUserProfileMock,
  listRecipesForUserMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getOrCreateUserProfileMock: vi.fn(),
  listRecipesForUserMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/profile', () => ({
  getOrCreateUserProfile: getOrCreateUserProfileMock,
}))

vi.mock('@/lib/recipe-list', () => ({
  listRecipesForUser: listRecipesForUserMock,
}))

import HomePage from './page'

const USER_ID = '11111111-1111-4111-8111-111111111111'

function createSupabaseClient(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
  }
}

function createRecipe(index: number): RecipeListItem {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    owner_user_id: USER_ID,
    method: 'v60',
    bean_info: {
      bean_name: `Coffee ${index}`,
      process: 'washed',
      roast_level: 'light',
      tasting_notes: [],
    },
    image_url: null,
    created_at: `2026-07-${String(23 - index).padStart(2, '0')}T12:00:00.000Z`,
    schema_version: 1,
    archived: false,
    is_favorite: false,
    source: 'owned',
    can_delete: true,
    can_archive: true,
    can_remove_from_list: false,
    is_manual_created: false,
    has_manual_edits: false,
    has_feedback_adjustments: false,
    is_scaled: false,
  }
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows twelve recent recipes without the former hero image', async () => {
    const recipes = Array.from({ length: 12 }, (_, index) => createRecipe(index + 1))
    const supabase = createSupabaseClient(USER_ID)
    createClientMock.mockResolvedValue(supabase)
    getOrCreateUserProfileMock.mockResolvedValue({ display_name: 'Guillermo' })
    listRecipesForUserMock.mockResolvedValue({
      recipes,
      page: 1,
      limit: 12,
      totalCount: 12,
      totalPages: 1,
    })

    const html = renderToStaticMarkup(await HomePage())

    expect(listRecipesForUserMock).toHaveBeenCalledWith(supabase, {
      userId: USER_ID,
      limit: 12,
      sort: 'recent',
    })
    expect(html).toContain('Recent Recipes')
    expect(html).not.toContain('CoffeeBrewing.jpg')
    expect(html).not.toContain('Illustrated baristas brewing pour-over coffee together')
    for (const recipe of recipes) {
      expect(html).toContain(`data-testid="open-recipe-${recipe.id}"`)
    }
  })

  it('keeps guest actions visible without loading recent recipes', async () => {
    createClientMock.mockResolvedValue(createSupabaseClient(null))

    const html = renderToStaticMarkup(await HomePage())

    expect(html).toContain('Scan Your Coffee Bag')
    expect(html).toContain('Enter Manually')
    expect(html).toContain('Sign In')
    expect(html).not.toContain('Recent Recipes')
    expect(listRecipesForUserMock).not.toHaveBeenCalled()
    expect(getOrCreateUserProfileMock).not.toHaveBeenCalled()
  })
})
