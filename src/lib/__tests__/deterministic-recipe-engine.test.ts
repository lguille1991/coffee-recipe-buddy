import { describe, expect, it } from 'vitest'
import { DETERMINISTIC_ENGINE_VERSION, RULE_CATALOG, generateDeterministicRecipe } from '@/lib/deterministic-recipe-engine'

const bean = { process: 'washed' as const, roast_level: 'light' as const, roast_date: '2026-07-01' }

describe('generateDeterministicRecipe', () => {
  it('is byte-stable and records versioned provenance for fixed input', () => {
    const input = { method: 'v60' as const, bean, goal: 'clarity' as const, targetWaterG: 300, evaluationDate: '2026-07-22' }
    expect(JSON.stringify(generateDeterministicRecipe(input))).toBe(JSON.stringify(generateDeterministicRecipe(input)))
    expect(generateDeterministicRecipe(input).generation_metadata).toEqual(expect.objectContaining({
      engine_version: DETERMINISTIC_ENGINE_VERSION,
      evaluation_date: '2026-07-22',
    }))
  })

  it('uses exact positive integer water additions and a final zero-water brew step', () => {
    const recipe = generateDeterministicRecipe({ method: 'kalita_wave', bean, goal: 'balanced', targetWaterG: 251, evaluationDate: '2026-07-22' })
    const additions = recipe.steps.filter(step => step.water_poured_g > 0)
    expect(additions.every(step => Number.isInteger(step.water_poured_g) && step.water_poured_g > 0)).toBe(true)
    expect(additions.reduce((sum, step) => sum + step.water_poured_g, 0)).toBe(251)
    expect(recipe.steps.at(-1)).toMatchObject({ water_poured_g: 0, water_accumulated_g: 251 })
  })

  it('rejects non-V60 4:6 and out-of-capacity water with stable codes', () => {
    expect(() => generateDeterministicRecipe({ method: 'origami', bean, goal: 'balanced', targetWaterG: 250, recipeMode: 'four_six', evaluationDate: '2026-07-22' })).toThrow('available only for V60')
    expect(() => generateDeterministicRecipe({ method: 'aeropress', bean, goal: 'balanced', targetWaterG: 300, evaluationDate: '2026-07-22' })).toThrow('supports 120–250g')
  })

  it('keeps V60 4:6 exact at the requested water weight', () => {
    const recipe = generateDeterministicRecipe({ method: 'v60', bean, goal: 'sweetness', targetWaterG: 301, recipeMode: 'four_six', evaluationDate: '2026-07-22' })
    expect(recipe.recipe_mode).toBe('four_six')
    expect(recipe.steps.filter(step => step.water_poured_g > 0).reduce((sum, step) => sum + step.water_poured_g, 0)).toBe(301)
    expect(recipe.parameters.total_time).toBe('3:30')
  })

  it('only accepts known catalog versions and protects nested rules from mutation', () => {
    expect(() => generateDeterministicRecipe({
      method: 'v60', bean, goal: 'balanced', targetWaterG: 250, evaluationDate: '2026-07-22', engineVersion: 'v1.0.0',
    })).toThrow('Unknown deterministic engine version')
    expect(Object.isFrozen(RULE_CATALOG)).toBe(true)
    expect(Object.isFrozen(RULE_CATALOG.v60)).toBe(true)
    expect(Object.isFrozen(RULE_CATALOG.v60.capacity)).toBe(true)
    expect(Object.isFrozen(RULE_CATALOG.v60.pours)).toBe(true)
  })
})
