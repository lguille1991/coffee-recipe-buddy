import { describe, expect, it } from 'vitest'
import { BASE_RECIPE } from './fixtures'
import type { BeanProfile, Recipe } from '@/types/recipe'
import { applySkillBrewParameterSettings } from '@/lib/skill-brew-parameters-engine'

function withMethod(method: Recipe['method']): Recipe {
  return {
    ...BASE_RECIPE,
    method,
    parameters: {
      ...BASE_RECIPE.parameters,
      coffee_g: 15,
      water_g: 250,
      ratio: '1:16.7',
      total_time: '3:00',
    },
  }
}

describe('applySkillBrewParameterSettings', () => {
  it('pushes washed/high-altitude/light profiles toward higher ratio and longer brew time', () => {
    const bean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      altitude_masl: 1600,
    }

    const result = applySkillBrewParameterSettings(withMethod('v60'), bean)
    expect(result.parameters.ratio).toBe('1:17')
    expect(result.parameters.total_time).toBe('3:10')
    expect(result.parameters.water_g).toBe(255)
  })

  it('pushes anaerobic/darker profiles toward lower ratio and shorter brew time', () => {
    const bean: BeanProfile = {
      process: 'anaerobic',
      roast_level: 'medium-dark',
    }

    const result = applySkillBrewParameterSettings(withMethod('v60'), bean)
    expect(result.parameters.ratio).toBe('1:15.1')
    expect(result.parameters.total_time).toBe('2:40')
    expect(result.parameters.water_g).toBe(227)
  })

  it('keeps step action gram mentions aligned with recalculated poured and accumulated totals', () => {
    const bean: BeanProfile = {
      process: 'washed',
      roast_level: 'medium',
    }

    const recipe = withMethod('v60')
    recipe.parameters.coffee_g = 18
    recipe.parameters.water_g = 300
    recipe.parameters.ratio = '1:16.7'
    recipe.steps = [
      { step: 1, time: '0:00', action: 'Bloom with 54g of water. Wait 40 seconds.', water_poured_g: 54, water_accumulated_g: 54 },
      { step: 2, time: '0:40', action: 'Pour to 150g in a steady center pour.', water_poured_g: 96, water_accumulated_g: 150 },
      { step: 3, time: '1:30', action: 'Pour to 230g, continuing the steady center pour.', water_poured_g: 80, water_accumulated_g: 230 },
      { step: 4, time: '2:20', action: 'Final pour to 300g. Allow drawdown to complete by 3:00-3:30.', water_poured_g: 70, water_accumulated_g: 300 },
    ]

    const result = applySkillBrewParameterSettings(recipe, bean)

    expect(result.parameters.water_g).toBe(293)
    expect(result.steps[0].action).toContain('53g')
    expect(result.steps[1].action).toContain('147g')
    expect(result.steps[2].action).toContain('225g')
    expect(result.steps[3].action).toContain('293g')
    expect(result.steps[3].water_accumulated_g).toBe(293)
  })
})
