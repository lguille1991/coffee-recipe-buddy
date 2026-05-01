import { describe, expect, it } from 'vitest'
import { applySkillGrindSettings } from '@/lib/skill-grind-engine'
import { BASE_RECIPE } from './fixtures'
import type { BeanProfile, Recipe } from '@/types/recipe'

function withMethod(method: Recipe['method']): Recipe {
  return {
    ...BASE_RECIPE,
    method,
    grind: {
      ...BASE_RECIPE.grind,
      k_ultra: { ...BASE_RECIPE.grind.k_ultra, range: '0–0 clicks', starting_point: '0.0.0' },
    },
  }
}

describe('applySkillGrindSettings', () => {
  it('forces deterministic grind output from the 5-determinant chain', () => {
    const bean: BeanProfile = {
      process: 'washed',
      roast_level: 'medium-light',
      altitude_masl: 1400,
      variety: 'Pacas',
      origin: 'El Salvador',
      tasting_notes: ['floral', 'orange', 'honey'],
    }

    const result = applySkillGrindSettings(withMethod('v60'), bean)
    expect(result.grind.k_ultra.starting_point).toBe('0.7.2')
    expect(result.grind.k_ultra.range).toBe('67–77 clicks')
    expect(result.range_logic.freshness_offset).toBe('0 clicks')
  })

  it('coarsens natural, low-altitude, medium-dark coffees', () => {
    const bean: BeanProfile = {
      process: 'natural',
      roast_level: 'medium-dark',
      altitude_masl: 700,
      variety: 'Bourbon',
      origin: 'Brazil Cerrado',
    }

    const result = applySkillGrindSettings(withMethod('v60'), bean)
    expect(result.grind.k_ultra.starting_point).toBe('0.7.8')
    expect(result.grind.k_ultra.range).toBe('73–83 clicks')
    expect(result.range_logic.process_offset).toContain('natural')
  })

  it('does not apply origin offset for non-matching origin tokens', () => {
    const baseBean: BeanProfile = {
      process: 'washed',
      roast_level: 'medium',
      altitude_masl: 1200,
      variety: 'Bourbon',
    }

    const withNeutralOrigin = applySkillGrindSettings(withMethod('v60'), {
      ...baseBean,
      origin: 'ethiopian-style blend',
    })

    const withoutOrigin = applySkillGrindSettings(withMethod('v60'), baseBean)

    expect(withNeutralOrigin.grind.k_ultra.starting_point).toBe(
      withoutOrigin.grind.k_ultra.starting_point,
    )
    expect(withNeutralOrigin.grind.k_ultra.range).toBe(
      withoutOrigin.grind.k_ultra.range,
    )
  })
})
