import { describe, expect, it } from 'vitest'
import { BASE_RECIPE } from '@/lib/__tests__/fixtures'
import { isManualRecipeCreated } from '@/lib/recipe-origin'

describe('recipe origin helper', () => {
  it('detects manually created recipes from manual placeholders', () => {
    expect(isManualRecipeCreated({
      ...BASE_RECIPE,
      objective: 'Manual recipe created without AI guidance.',
      range_logic: {
        ...BASE_RECIPE.range_logic,
        base_range: 'Manual recipe',
      },
    })).toBe(true)
  })

  it('does not mark generated recipes as manual', () => {
    expect(isManualRecipeCreated(BASE_RECIPE)).toBe(false)
  })
})
