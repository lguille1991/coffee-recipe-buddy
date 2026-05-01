import { describe, expect, it } from 'vitest'
import { createManualRecipeDraft, buildRecipeFromManualDraft, validateManualRecipeDraft } from '@/lib/manual-recipe'
import { WASHED_LIGHT_BEAN } from './fixtures'

describe('manual recipe helpers', () => {
  it('creates a blank manual draft with one empty step', () => {
    const draft = createManualRecipeDraft(WASHED_LIGHT_BEAN, 'v60')

    expect(draft.display_name).toBe('Hario V60')
    expect(draft.edit_draft.temperature_display).toBe('')
    expect(draft.edit_draft.total_time).toBe('')
    expect(draft.edit_draft.steps).toHaveLength(1)
    expect(draft.edit_draft.steps[0]).toMatchObject({
      step: 1,
      time: '',
      action: '',
      water_poured_g: 0,
      water_accumulated_g: 0,
    })
  })

  it('requires manual builder fields before save', () => {
    const draft = createManualRecipeDraft(WASHED_LIGHT_BEAN, 'v60')

    expect(validateManualRecipeDraft(draft, 'k_ultra', 'C')).toEqual({
      valid: false,
      error: 'Coffee dose is required.',
    })
  })

  it('rejects brew times with spaces or invalid separators in manual mode', () => {
    const draft = createManualRecipeDraft(WASHED_LIGHT_BEAN, 'v60')
    draft.edit_draft.coffee_g = 15
    draft.edit_draft.water_g = 250
    draft.edit_draft.temperature_display = 93
    draft.edit_draft.total_time = '1:00 - 1:45'
    draft.edit_draft.grind_preferred_value = '0.8.2'
    draft.edit_draft.steps = [
      { step: 1, time: '0:00', action: 'Bloom', water_poured_g: 250, water_accumulated_g: 250, _dndId: 'a' },
    ]

    expect(validateManualRecipeDraft(draft, 'k_ultra', 'C')).toEqual({
      valid: false,
      error: 'Brew time must use m:ss or m:ss-m:ss format with no spaces, for example 1:00 or 1:00-1:45.',
    })
  })

  it('builds a persisted recipe from a completed manual draft', () => {
    const draft = createManualRecipeDraft(WASHED_LIGHT_BEAN, 'v60')
    draft.edit_draft.coffee_g = 15
    draft.edit_draft.water_g = 250
    draft.edit_draft.temperature_display = 93
    draft.edit_draft.total_time = '3:00'
    draft.edit_draft.grind_preferred_value = '0.8.2'
    draft.edit_draft.steps = [
      { step: 1, time: '0:00', action: 'Bloom', water_poured_g: 40, water_accumulated_g: 40, _dndId: 'a' },
      { step: 2, time: '0:45', action: 'Main pour', water_poured_g: 110, water_accumulated_g: 150, _dndId: 'b' },
      { step: 3, time: '1:30', action: 'Finish', water_poured_g: 100, water_accumulated_g: 250, _dndId: 'c' },
    ]

    expect(validateManualRecipeDraft(draft, 'k_ultra', 'C')).toEqual({
      valid: true,
      error: null,
    })

    const recipe = buildRecipeFromManualDraft(draft, 'k_ultra', 'C')

    expect(recipe.parameters).toMatchObject({
      coffee_g: 15,
      water_g: 250,
      ratio: '1:16.7',
      temperature_c: 93,
      total_time: '3:00',
    })
    expect(recipe.grind.k_ultra.starting_point).toBe('0.8.2')
    expect(recipe.range_logic.base_range).toBe('Manual recipe')
    expect(recipe.quick_adjustments.too_acidic).toContain('Adjust manually after tasting')
    expect(recipe.steps[2].water_accumulated_g).toBe(250)
  })
})
