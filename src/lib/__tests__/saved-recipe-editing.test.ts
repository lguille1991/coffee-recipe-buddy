import { describe, expect, it } from 'vitest'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from './fixtures'
import {
  buildLiveGrindSettings,
  createEditDraft,
  recomputeAccumulated,
  scaleStepsToWater,
  validateSteps,
} from '@/app/recipes/[id]/_lib/editing'
import type { SavedRecipe } from '@/types/recipe'

const BASE_SAVED_RECIPE: SavedRecipe = {
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
  created_at: '2026-04-08T00:00:00.000Z',
  archived: false,
  parent_recipe_id: null,
  scale_factor: null,
}

describe('saved recipe editing helpers', () => {
  it('recomputes accumulated water totals in order', () => {
    const steps = recomputeAccumulated([
      { ...BASE_RECIPE.steps[0], _dndId: 'a', water_poured_g: 25 },
      { ...BASE_RECIPE.steps[1], _dndId: 'b', water_poured_g: 100 },
      { ...BASE_RECIPE.steps[2], _dndId: 'c', water_poured_g: 125 },
    ])

    expect(steps.map(step => step.water_accumulated_g)).toEqual([25, 125, 250])
  })

  it('scales steps to a new target while preserving the final total', () => {
    const steps = BASE_RECIPE.steps.map((step, index) => ({ ...step, _dndId: `step-${index}` }))
    const scaled = scaleStepsToWater(steps, 250, 300)
    const total = scaled.reduce((sum, step) => sum + step.water_poured_g, 0)

    expect(total).toBe(300)
    expect(scaled[scaled.length - 1].water_accumulated_g).toBe(300)
  })

  it('flags invalid step chronology and mismatched totals', () => {
    const invalidSteps = [
      { ...BASE_RECIPE.steps[0], _dndId: 'a', time: '1:30' },
      { ...BASE_RECIPE.steps[1], _dndId: 'b', time: '0:45' },
    ]

    expect(validateSteps(invalidSteps, 140)).toContain('chronological order')
    expect(validateSteps([{ ...BASE_RECIPE.steps[0], _dndId: 'x' }], 250)).toContain('targets 250 g')
  })

  it('creates an edit draft using the preferred grinder and temperature unit', () => {
    const draft = createEditDraft(BASE_SAVED_RECIPE, 'F', 'q_air')

    expect(draft.temperature_display).toBe(199)
    expect(draft.grind_preferred_value).toBe('2.5.2')
    expect(draft.steps[0]._dndId).toBe('step-0-1')
  })

  it('keeps current grind settings while the numeric grinder field is temporarily empty', () => {
    const draft = createEditDraft(BASE_SAVED_RECIPE, 'C', 'k_ultra')
    draft.grind_preferred_value = ''

    const liveGrind = buildLiveGrindSettings(BASE_SAVED_RECIPE, 'k_ultra', draft)

    expect(liveGrind).toEqual(BASE_SAVED_RECIPE.current_recipe_json.grind)
  })
})
