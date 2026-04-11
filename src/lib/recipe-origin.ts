import type { RecipeWithAdjustment } from '@/types/recipe'

export function isManualRecipeCreated(recipe: Pick<RecipeWithAdjustment, 'objective' | 'range_logic'>) {
  return recipe.objective === 'Manual recipe created without AI guidance.'
    || recipe.range_logic.base_range === 'Manual recipe'
}
