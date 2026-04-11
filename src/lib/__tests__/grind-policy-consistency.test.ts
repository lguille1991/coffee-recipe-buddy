import { describe, expect, it } from 'vitest'
import { applyFeedbackAdjustment } from '../adjustment-engine'
import { BASE_RECIPE } from './fixtures'
import { buildDerivedGrindSettings } from '../grind-settings'
import { migrateRecipe } from '../recipe-migrations'
import type { RecipeWithAdjustment, SavedRecipe } from '@/types/recipe'
import { buildLiveGrindSettings, createEditDraft } from '@/app/recipes/[id]/_lib/editing'
import { getMethodRatioBounds } from '../recipe-policy'
import { validateRecipe } from '../recipe-validator'

const BASE_SAVED_RECIPE: SavedRecipe = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: '22222222-2222-2222-2222-222222222222',
  schema_version: 1,
  bean_info: {
    process: 'washed',
    roast_level: 'light',
  },
  method: 'v60',
  original_recipe_json: BASE_RECIPE,
  current_recipe_json: BASE_RECIPE,
  feedback_history: [],
  image_url: null,
  notes: null,
  created_at: '2026-04-08T00:00:00.000Z',
  archived: false,
  parent_recipe_id: null,
  scale_factor: null,
}

describe('cross-module grind and policy consistency', () => {
  it('editing derives the same grinder bundle as the shared helper', () => {
    const draft = createEditDraft(BASE_SAVED_RECIPE, 'C', 'k_ultra')
    draft.grind_preferred_value = 84

    const liveGrind = buildLiveGrindSettings(BASE_SAVED_RECIPE, 'k_ultra', draft)
    const expected = buildDerivedGrindSettings(BASE_RECIPE, 81, 84, 84)

    expect(liveGrind).toEqual(expected)
  })

  it('migrations recalculate derived grinders with the same shared helper output', () => {
    const migrated = migrateRecipe(BASE_RECIPE as RecipeWithAdjustment, 3)
    const expected = buildDerivedGrindSettings(BASE_RECIPE, 81, 84, 82)

    expect(migrated.grind).toEqual(expected)
  })

  it('feedback adjustment grind changes stay aligned with the shared grinder helper', () => {
    const { recipe: adjusted } = applyFeedbackAdjustment(BASE_RECIPE, 'too_bitter', 1, 'k_ultra')
    const expected = buildDerivedGrindSettings(BASE_RECIPE, 81, 84, 84)

    expect(adjusted.grind).toEqual(expected)
  })

  it('validator enforces the same lower ratio bound exposed by the shared method policy', () => {
    const bounds = getMethodRatioBounds('hario_switch')
    const validRecipe = {
      ...BASE_RECIPE,
      method: 'hario_switch',
      display_name: 'Hario Switch',
      parameters: {
        ...BASE_RECIPE.parameters,
        coffee_g: 15,
        water_g: 195,
        ratio: `1:${bounds.low}`,
      },
    }
    const invalidRecipe = {
      ...validRecipe,
      parameters: {
        ...validRecipe.parameters,
        water_g: 180,
        ratio: `1:${bounds.low - 1}`,
      },
    }

    expect(validateRecipe(validRecipe, BASE_SAVED_RECIPE.bean_info, 'hario_switch').errors)
      .not.toContain(expect.stringContaining('outside method range'))
    expect(
      validateRecipe(invalidRecipe, BASE_SAVED_RECIPE.bean_info, 'hario_switch').errors.some(
        error => error.includes(`outside method range 1:${bounds.low}–1:${bounds.high}`),
      ),
    ).toBe(true)
  })
})
