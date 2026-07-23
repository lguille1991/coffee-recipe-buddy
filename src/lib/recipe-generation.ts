import { generateDeterministicRecipe } from '@/lib/deterministic-recipe-engine'
import type { BeanProfile, BrewGoal, MethodId, Recipe } from '@/types/recipe'

/**
 * Compatibility boundary for callers that still use the previous module name.
 * Generation is intentionally synchronous and contains no model or network work.
 */
export function generateRecipe({
  method,
  bean,
  targetWaterG,
  recipeMode,
  goal,
  evaluationDate,
}: {
  method: MethodId
  bean: BeanProfile
  targetWaterG: number
  recipeMode?: 'standard' | 'four_six'
  goal: BrewGoal
  evaluationDate: string
}): Recipe {
  return generateDeterministicRecipe({ method, bean, targetWaterG, recipeMode, goal, evaluationDate })
}
