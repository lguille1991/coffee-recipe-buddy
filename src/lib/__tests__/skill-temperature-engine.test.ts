import { describe, expect, it } from 'vitest'
import { applySkillTemperatureSettings } from '@/lib/skill-temperature-engine'
import { BASE_RECIPE } from './fixtures'
import type { BeanProfile, Recipe } from '@/types/recipe'

function withMethod(method: Recipe['method']): Recipe {
  return {
    ...BASE_RECIPE,
    method,
  }
}

describe('applySkillTemperatureSettings', () => {
  it('favors higher temperatures for washed floral coffees', () => {
    const bean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      origin: 'Ethiopia Yirgacheffe',
      tasting_notes: ['floral', 'citrus'],
    }

    const result = applySkillTemperatureSettings(withMethod('v60'), bean)
    expect(result.parameters.temperature_c).toBe(96)
  })

  it('reduces temperature for natural medium-dark coffees', () => {
    const bean: BeanProfile = {
      process: 'natural',
      roast_level: 'medium-dark',
      origin: 'Brazil Cerrado',
    }

    const result = applySkillTemperatureSettings(withMethod('v60'), bean)
    expect(result.parameters.temperature_c).toBe(92)
  })

  it('uses coolest profile for anaerobic coffees', () => {
    const bean: BeanProfile = {
      process: 'anaerobic',
      roast_level: 'light',
      origin: 'Yemen',
    }

    const result = applySkillTemperatureSettings(withMethod('v60'), bean)
    expect(result.parameters.temperature_c).toBe(91)
  })
})
