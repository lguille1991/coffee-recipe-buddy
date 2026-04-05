import { RecipeWithAdjustment } from '@/types/recipe'
import { parseKUltraRange, kUltraRangeToTimemoreC2, kUltraRangeToQAir } from './grinder-converter'

const CURRENT_SCHEMA_VERSION = 3

type MigrationFn = (recipe: RecipeWithAdjustment) => RecipeWithAdjustment

// Registry of migration functions keyed by the version they migrate FROM.
// e.g. migrations[1] transforms a v1 recipe to v2.
const migrations: Record<number, MigrationFn> = {
  // v1 → v2: add timemore_c2 grind settings derived from k_ultra range.
  // v2 → v3: recalculate q_air using the corrected rotation-based table.
  1: (recipe) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grind = recipe.grind as any
    if (grind.timemore_c2) return recipe // already present

    const kuRange = parseKUltraRange(recipe.grind.k_ultra.range)
    const startMatch = recipe.grind.k_ultra.starting_point.match(/(\d+)/)
    const startClicks = startMatch ? parseInt(startMatch[1], 10) : kuRange?.mid ?? 82

    const c2 = kuRange
      ? kUltraRangeToTimemoreC2(kuRange.low, kuRange.high, startClicks, recipe.method)
      : { range: 'clicks 18–22', starting_point: 'click 20', note: 'Regenerate recipe for precise C2 settings.' }

    return {
      ...recipe,
      grind: { ...recipe.grind, timemore_c2: c2 },
    }
  },

  2: (recipe) => {
    const kuRange = parseKUltraRange(recipe.grind.k_ultra.range)
    if (!kuRange) return recipe

    const startMatch = recipe.grind.k_ultra.starting_point.match(/(\d+)/)
    const startClicks = startMatch ? parseInt(startMatch[1], 10) : kuRange.mid

    const qAir = kUltraRangeToQAir(kuRange.low, kuRange.high, startClicks)

    return {
      ...recipe,
      grind: {
        ...recipe.grind,
        q_air: {
          ...recipe.grind.q_air,
          range: qAir.range,
          starting_point: qAir.starting_point,
        },
      },
    }
  },
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
