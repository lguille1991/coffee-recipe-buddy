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
})
