import { describe, expect, it } from 'vitest'
import { BASE_RECIPE } from './fixtures'
import { applyFourSixRecipeMode } from '@/lib/skill-recipe-mode-engine'

describe('applyFourSixRecipeMode', () => {
  it('applies deterministic 4:6 structure and parameters', () => {
    const result = applyFourSixRecipeMode(BASE_RECIPE)

    expect(result.recipe_mode).toBe('four_six')
    expect(result.parameters.coffee_g).toBe(20)
    expect(result.parameters.water_g).toBe(300)
    expect(result.parameters.ratio).toBe('1:15')
    expect(result.parameters.total_time).toBe('3:30')
    expect(result.steps).toHaveLength(5)
    expect(result.steps[0].water_poured_g).toBe(60)
    expect(result.steps[4].water_accumulated_g).toBe(300)
  })
})

