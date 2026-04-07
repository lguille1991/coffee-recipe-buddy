import { describe, it, expect } from 'vitest'
import { validateRecipe, buildRetryPrompt } from '../recipe-validator'
import { BASE_RECIPE } from './fixtures'
import type { BeanProfile } from '@/types/recipe'

const BEAN: BeanProfile = { process: 'washed', roast_level: 'light' }

// Deep-clone helper so each test starts from a clean base
function recipe(overrides: Record<string, unknown> = {}) {
  return { ...BASE_RECIPE, ...overrides }
}

describe('validateRecipe', () => {
  it('passes a fully valid recipe', () => {
    const result = validateRecipe(BASE_RECIPE, BEAN, 'v60')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails Zod schema validation when required fields are missing', () => {
    const result = validateRecipe({ method: 'v60' }, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.startsWith('Schema:'))).toBe(true)
  })

  it('fails when ratio math mismatches water_g by more than 5g', () => {
    const bad = recipe({
      parameters: {
        ...BASE_RECIPE.parameters,
        coffee_g: 15,
        ratio: '1:16.7',
        water_g: 300, // 15 × 16.7 = 250.5 ≠ 300
      },
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Ratio math'))).toBe(true)
  })

  it('fails when ratio is outside method range', () => {
    const bad = recipe({
      parameters: {
        ...BASE_RECIPE.parameters,
        coffee_g: 15,
        ratio: '1:20',
        water_g: 300, // 15 × 20 = 300
      },
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('outside method range'))).toBe(true)
  })

  it('fails when step water sum does not equal water_g', () => {
    const bad = recipe({
      steps: [
        { step: 1, time: '0:00', action: 'Bloom', water_poured_g: 30, water_accumulated_g: 30 },
        { step: 2, time: '0:45', action: 'First pour', water_poured_g: 100, water_accumulated_g: 130 },
        { step: 3, time: '1:30', action: 'Second pour', water_poured_g: 100, water_accumulated_g: 230 },
        // total poured = 230 ≠ 250
      ],
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Step water sum'))).toBe(true)
  })

  it('fails when last accumulated step does not equal water_g', () => {
    const bad = recipe({
      steps: [
        { step: 1, time: '0:00', action: 'Bloom', water_poured_g: 125, water_accumulated_g: 125 },
        { step: 2, time: '0:45', action: 'Second pour', water_poured_g: 125, water_accumulated_g: 240 }, // wrong accumulated
      ],
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('accumulated'))).toBe(true)
  })

  it('fails when temperature is out of range', () => {
    // temperature_c: 105 exceeds Zod schema max(100) — caught as Schema error
    const tooHot = recipe({ parameters: { ...BASE_RECIPE.parameters, temperature_c: 105 } })
    const result = validateRecipe(tooHot, BEAN, 'v60')
    expect(result.valid).toBe(false)
    // Zod catches this before the custom check; error starts with "Schema:"
    expect(result.errors.some(e => e.startsWith('Schema:'))).toBe(true)
  })

  it('fails when a quick_adjustment key is empty', () => {
    const bad = recipe({
      quick_adjustments: { ...BASE_RECIPE.quick_adjustments, too_acidic: '' },
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('too_acidic'))).toBe(true)
  })

  it('fails when a range_logic key is empty', () => {
    const bad = recipe({
      range_logic: { ...BASE_RECIPE.range_logic, base_range: '' },
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('base_range'))).toBe(true)
  })

  it('fails when Baratza starting_point is outside 14–24 for pour-over', () => {
    const bad = recipe({
      grind: {
        ...BASE_RECIPE.grind,
        baratza_encore_esp: { range: 'clicks 10–12', starting_point: '11 clicks', note: '' },
      },
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Baratza'))).toBe(true)
  })

  it('fails when Timemore C2 starting_point is outside 14–22 for pour-over', () => {
    const bad = recipe({
      grind: {
        ...BASE_RECIPE.grind,
        timemore_c2: { range: 'clicks 10–12', starting_point: '11 clicks', note: '' },
      },
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Timemore C2'))).toBe(true)
  })

  it('does not apply pour-over grinder checks for aeropress', () => {
    const aeropressRecipe = {
      ...BASE_RECIPE,
      method: 'aeropress',
      display_name: 'AeroPress',
      grind: {
        ...BASE_RECIPE.grind,
        baratza_encore_esp: { range: 'clicks 10–12', starting_point: '11 clicks', note: '' },
        timemore_c2: { range: 'clicks 10–12', starting_point: '11 clicks', note: '' },
      },
    }
    const result = validateRecipe(aeropressRecipe, BEAN, 'aeropress')
    // Baratza/C2 zone checks only apply to pour-over methods — should not flag these
    expect(result.errors.some(e => e.includes('Baratza') || e.includes('Timemore'))).toBe(false)
  })

  it('fails when final operating range width exceeds 10 clicks', () => {
    const bad = recipe({
      range_logic: { ...BASE_RECIPE.range_logic, final_operating_range: '80–95 clicks' },
    })
    const result = validateRecipe(bad, BEAN, 'v60')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('accumulation cap'))).toBe(true)
  })
})

describe('buildRetryPrompt', () => {
  it('includes all error messages in the output', () => {
    const errors = ['Error A', 'Error B', 'Error C']
    const prompt = buildRetryPrompt(errors)
    errors.forEach(e => expect(prompt).toContain(e))
  })

  it('instructs the LLM to output only corrected JSON', () => {
    const prompt = buildRetryPrompt(['some error'])
    expect(prompt).toContain('Output ONLY the corrected JSON')
  })

  it('lists errors as bullet points', () => {
    const prompt = buildRetryPrompt(['Error X', 'Error Y'])
    expect(prompt).toContain('- Error X')
    expect(prompt).toContain('- Error Y')
  })
})
