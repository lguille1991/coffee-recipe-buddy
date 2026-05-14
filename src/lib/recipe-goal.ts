import type { BrewGoal } from '@/types/recipe'

const GOAL_PATTERN = /\bTarget goal:\s*(clarity|balanced|sweetness|body|forgiving)\b/i

export function extractPersistedRecipeGoal(
  generationGoal: BrewGoal | null | undefined,
  objective: string | null | undefined,
): BrewGoal | undefined {
  if (generationGoal) return generationGoal
  if (!objective) return undefined

  const match = objective.match(GOAL_PATTERN)
  if (!match) return undefined

  const goal = match[1]?.toLowerCase()
  if (
    goal === 'clarity' ||
    goal === 'balanced' ||
    goal === 'sweetness' ||
    goal === 'body' ||
    goal === 'forgiving'
  ) {
    return goal
  }

  return undefined
}
