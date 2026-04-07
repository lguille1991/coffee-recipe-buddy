import { describe, it, expect } from 'vitest'
import { migrateRecipe, CURRENT_SCHEMA_VERSION } from '../recipe-migrations'
import { BASE_RECIPE } from './fixtures'
import type { RecipeWithAdjustment } from '@/types/recipe'

describe('migrateRecipe', () => {
  it('is a no-op when already at CURRENT_SCHEMA_VERSION', () => {
    const result = migrateRecipe(BASE_RECIPE, CURRENT_SCHEMA_VERSION)
    // Should return structurally identical recipe
    expect(result).toEqual(BASE_RECIPE)
  })

  it('CURRENT_SCHEMA_VERSION is a positive integer', () => {
    expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true)
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(0)
  })

  describe('v1 → v2 migration: adds timemore_c2', () => {
    it('adds timemore_c2 if missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v1Recipe: any = {
        ...BASE_RECIPE,
        grind: {
          k_ultra: BASE_RECIPE.grind.k_ultra,
          q_air: BASE_RECIPE.grind.q_air,
          baratza_encore_esp: BASE_RECIPE.grind.baratza_encore_esp,
          // timemore_c2 intentionally absent
        },
      }
      const result = migrateRecipe(v1Recipe as RecipeWithAdjustment, 1)
      expect(result.grind.timemore_c2).toBeDefined()
      expect(result.grind.timemore_c2.range).toBeTruthy()
      expect(result.grind.timemore_c2.starting_point).toBeTruthy()
    })

    it('skips the v1→v2 c2 derivation when timemore_c2 is already present', () => {
      // v1→v2 returns early if c2 exists. v2–v5 then recalculate from K-Ultra — result is valid.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alreadyHasC2: any = { ...BASE_RECIPE }
      const result = migrateRecipe(alreadyHasC2 as RecipeWithAdjustment, 1)
      expect(result.grind.timemore_c2).toBeDefined()
      expect(result.grind.timemore_c2.starting_point).toMatch(/\d+ clicks/)
    })
  })

  describe('v2 → v3 migration: recalculates q_air from k_ultra', () => {
    it('updates q_air range and starting_point', () => {
      const result = migrateRecipe(BASE_RECIPE, 2)
      // Q-Air should be updated from K-Ultra range 81–84
      expect(result.grind.q_air.range).toBeTruthy()
      expect(result.grind.q_air.starting_point).toBeTruthy()
      // Should use R.C.M format
      expect(result.grind.q_air.starting_point).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('is a no-op when k_ultra range is unparseable', () => {
      const badRange = {
        ...BASE_RECIPE,
        grind: { ...BASE_RECIPE.grind, k_ultra: { ...BASE_RECIPE.grind.k_ultra, range: 'invalid' } },
      }
      const result = migrateRecipe(badRange, 2)
      // Should return unchanged (no k_ultra range to derive from)
      expect(result.grind.q_air).toEqual(badRange.grind.q_air)
    })
  })

  describe('v3 → v4 migration: recalculates all derived grinders', () => {
    it('updates q_air, baratza, and timemore_c2 from k_ultra', () => {
      const result = migrateRecipe(BASE_RECIPE, 3)
      expect(result.grind.q_air.starting_point).toMatch(/^\d+\.\d+\.\d+$/)
      expect(result.grind.baratza_encore_esp.starting_point).toMatch(/\d+ clicks/)
      expect(result.grind.timemore_c2.starting_point).toMatch(/\d+ clicks/)
    })
  })

  describe('v4 → v5 migration: reformats Q-Air to R.C.M', () => {
    it('q_air starting_point uses R.C.M format after migration', () => {
      const result = migrateRecipe(BASE_RECIPE, 4)
      expect(result.grind.q_air.starting_point).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('full chain migration from v1 to current', () => {
    it('produces a recipe with all four grinders present and valid format', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v1: any = {
        ...BASE_RECIPE,
        grind: {
          k_ultra: BASE_RECIPE.grind.k_ultra,
          q_air: { range: '2.0 rotations–2.3 rotations', starting_point: '2.1 rotations' },
          baratza_encore_esp: BASE_RECIPE.grind.baratza_encore_esp,
        },
      }
      const result = migrateRecipe(v1 as RecipeWithAdjustment, 1)

      expect(result.grind.k_ultra).toBeDefined()
      expect(result.grind.q_air).toBeDefined()
      expect(result.grind.baratza_encore_esp).toBeDefined()
      expect(result.grind.timemore_c2).toBeDefined()
      // Q-Air should be in R.C.M format after full chain
      expect(result.grind.q_air.starting_point).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })
})
