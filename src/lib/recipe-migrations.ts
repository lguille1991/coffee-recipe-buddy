import { RecipeWithAdjustment } from '@/types/recipe'

const CURRENT_SCHEMA_VERSION = 1

type MigrationFn = (recipe: RecipeWithAdjustment) => RecipeWithAdjustment

// Registry of migration functions keyed by the version they migrate FROM.
// e.g. migrations[1] transforms a v1 recipe to v2.
const migrations: Record<number, MigrationFn> = {
  // Placeholder for future migrations:
  // 1: (recipe) => { return { ...recipe, newField: 'default' } },
}

/**
 * Applies chained migration transforms until the recipe reaches
 * CURRENT_SCHEMA_VERSION. Pure functions — no LLM calls.
 */
export function migrateRecipe(
  recipe: RecipeWithAdjustment,
  fromVersion: number,
): RecipeWithAdjustment {
  let current = recipe
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = migrations[v]
    if (migrate) {
      current = migrate(current)
    }
  }
  return current
}

export { CURRENT_SCHEMA_VERSION }
