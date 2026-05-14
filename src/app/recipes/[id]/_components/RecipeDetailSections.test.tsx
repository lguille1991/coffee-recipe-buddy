/** @vitest-environment jsdom */
/* eslint-disable @next/next/no-img-element */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { RecipeTitleBlock } from './RecipeDetailSections'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'
import type { SavedRecipe } from '@/types/recipe'

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string }) => <img alt={alt} {...props} />,
}))

function buildSavedRecipe(overrides: Partial<SavedRecipe> = {}): SavedRecipe {
  return {
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
    created_at: '2026-05-14T00:00:00.000Z',
    archived: false,
    live_snapshot_id: null,
    parent_recipe_id: null,
    scale_factor: null,
    coffee_profile_id: null,
    is_favorite: false,
    ...overrides,
  }
}

describe('RecipeTitleBlock', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  function renderTitleBlock(recipe: SavedRecipe) {
    return act(async () => {
      root.render(
        <RecipeTitleBlock
          commentCount={null}
          hasFeedbackAdjustments={false}
          isManualCreated={false}
          hasManualEdits={false}
          isEditing={false}
          onOpenCoffeeProfile={() => {}}
          onOpenManualCreator={() => {}}
          onOpenEditHistory={() => {}}
          onOpenShare={() => {}}
          onOpenParentRecipe={() => {}}
          recipe={recipe}
          shareToken={null}
          versionN={1}
        />,
      )
    })
  }

  it('renders a humanized goal badge near the top of recipe detail', async () => {
    await renderTitleBlock(buildSavedRecipe({ goal: 'body' }))

    expect(container.querySelector('[data-testid="recipe-goal"]')?.textContent).toBe('Body')
  })

  it('does not render a goal badge when the saved recipe has no goal', async () => {
    await renderTitleBlock(buildSavedRecipe())

    expect(container.querySelector('[data-testid="recipe-goal"]')).toBeNull()
  })
})
