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

    const result = applySkillGrindSettings(withMethod('v60'), bean, { now: new Date('2026-05-01T12:00:00Z') })
    expect(result.grind.k_ultra.starting_point).toBe('0.7.1')
    expect(result.grind.k_ultra.range).toBe('66–76 clicks')
    expect(result.range_logic.freshness_offset).toContain('+0 clicks')
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
    expect(result.grind.k_ultra.starting_point).toBe('0.7.7')
    expect(result.grind.k_ultra.range).toBe('72–82 clicks')
    expect(result.range_logic.process_offset).toContain('natural')
  })

  it('applies freshness windows for very fresh and stale coffees', () => {
    const veryFreshBean: BeanProfile = {
      process: 'washed',
      roast_level: 'medium',
      roast_date: '2026-04-29',
    }
    const staleBean: BeanProfile = {
      process: 'washed',
      roast_level: 'medium',
      roast_date: '2026-02-15',
    }

    const freshResult = applySkillGrindSettings(withMethod('v60'), veryFreshBean, { now: new Date('2026-05-01T12:00:00Z') })
    const staleResult = applySkillGrindSettings(withMethod('v60'), staleBean, { now: new Date('2026-05-01T12:00:00Z') })

    expect(freshResult.grind.k_ultra.starting_point).toBe('0.7.4')
    expect(freshResult.range_logic.freshness_offset).toContain('+2 clicks')
    expect(staleResult.grind.k_ultra.starting_point).toBe('0.6.9')
    expect(staleResult.range_logic.freshness_offset).toContain('-3 clicks')
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

  it('supports strict grinder parity mode with method-specific base tables', () => {
    const bean: BeanProfile = {
      process: 'washed',
      roast_level: 'medium',
    }

    const strict = applySkillGrindSettings(withMethod('chemex'), bean, {
      now: new Date('2026-05-01T12:00:00Z'),
      strictParityMode: true,
    })
    const fallback = applySkillGrindSettings(withMethod('chemex'), bean, {
      now: new Date('2026-05-01T12:00:00Z'),
      strictParityMode: false,
    })

    expect(strict.range_logic.base_range).toContain('STRICT Chemex table base')
    expect(strict.grind.k_ultra.starting_point).not.toBe(fallback.grind.k_ultra.starting_point)
  })

  it('applies skill_v2 method base ranges and density alignment', () => {
    const bean: BeanProfile = {
      process: 'washed',
      roast_level: 'medium',
      altitude_masl: 1500,
      variety: 'Gesha',
      tasting_notes: ['bergamot'],
    }

    const result = applySkillGrindSettings(withMethod('v60'), bean, {
      now: new Date('2026-05-01T12:00:00Z'),
      parityMode: 'skill_v2',
    })

    expect(result.range_logic.base_range).toContain('72–79 clicks (Skill v2 V60 base)')
    expect(result.range_logic.density_offset).toContain('-1 (aligned altitude+variety)')
    expect(result.grind.k_ultra.range).toBe('70–77 clicks')
    expect(result.grind.k_ultra.starting_point).toBe('0.7.4')
  })

  it('applies washed floral guardrail in skill_v2 mode', () => {
    const bean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      altitude_masl: 1450,
      roast_date: '2026-04-25',
      tasting_notes: ['jasmine', 'citrus zest'],
      variety: 'Bourbon',
    }

    const result = applySkillGrindSettings(withMethod('v60'), bean, {
      now: new Date('2026-05-01T12:00:00Z'),
      parityMode: 'skill_v2',
    })

    expect(result.range_logic.freshness_offset).toContain('+1 clicks')
    expect(result.grind.k_ultra.range).toBe('69–76 clicks')
    expect(result.grind.k_ultra.starting_point).toBe('0.7.3')
  })
})
