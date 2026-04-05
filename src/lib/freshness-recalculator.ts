import { RecipeWithAdjustment } from '@/types/recipe'

export interface FreshnessAdjustment {
  adjusted: boolean
  daysPostRoast: number
  freshnessLabel: string
  changedFields: { field: string; previous: string; next: string }[]
  adjustedRecipe: RecipeWithAdjustment
}

type FreshnessWindow = 'resting' | 'optimal' | 'fading' | 'stale'

function getFreshnessWindow(days: number): FreshnessWindow {
  if (days < 5)   return 'resting'
  if (days < 28)  return 'optimal'
  if (days < 45)  return 'fading'
  return 'stale'
}

function parseFreshnessOffset(offset: string): number {
  // Offset strings look like "+2 clicks", "-1 click", "0", "+0 clicks"
  const match = offset.match(/([+-]?\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

function formatClickOffset(clicks: number): string {
  if (clicks > 0) return `+${clicks} clicks`
  if (clicks < 0) return `${clicks} clicks`
  return '0 clicks'
}

function windowOffset(window: FreshnessWindow): number {
  switch (window) {
    case 'resting': return +2  // coarser (under-extracted risk)
    case 'optimal': return 0
    case 'fading':  return -1  // finer
    case 'stale':   return -2  // finer
  }
}

/**
 * Given a saved recipe and today's date, determines whether the freshness
 * window has shifted meaningfully since the recipe was saved. If it has,
 * applies a delta to grind settings and returns an adjusted recipe + diff.
 *
 * Runs entirely client-side. No LLM calls.
 */
export function recalculateFreshness(
  recipe: RecipeWithAdjustment,
  roastDateISO: string | undefined,
  today: Date = new Date(),
): FreshnessAdjustment {
  const noChange: FreshnessAdjustment = {
    adjusted: false,
    daysPostRoast: 0,
    freshnessLabel: 'Unknown',
    changedFields: [],
    adjustedRecipe: recipe,
  }

  if (!roastDateISO) return noChange

  const roastDate = new Date(roastDateISO)
  if (isNaN(roastDate.getTime())) return noChange

  const daysPostRoast = Math.floor(
    (today.getTime() - roastDate.getTime()) / (1000 * 60 * 60 * 24),
  )

  const currentWindow = getFreshnessWindow(daysPostRoast)
  const currentWindowOffset = windowOffset(currentWindow)

  // Determine the window that was in effect when the recipe was generated
  const savedOffset = parseFreshnessOffset(recipe.range_logic?.freshness_offset ?? '0')
  const savedWindowOffset = savedOffset // already the offset applied at save time

  const delta = currentWindowOffset - savedWindowOffset

  if (delta === 0) {
    return {
      adjusted: false,
      daysPostRoast,
      freshnessLabel: currentWindow,
      changedFields: [],
      adjustedRecipe: recipe,
    }
  }

  // Apply delta to K-Ultra starting point (clicks)
  const changedFields: { field: string; previous: string; next: string }[] = []
  let adjustedRecipe = { ...recipe }

  const kUltra = recipe.grind.k_ultra
  const prevStart = kUltra.starting_point
  const clickMatch = prevStart.match(/(\d+)\s*click/)
  if (clickMatch) {
    const prevClicks = parseInt(clickMatch[1], 10)
    const nextClicks = prevClicks + delta
    const nextStart = `${nextClicks} clicks`

    changedFields.push({ field: 'grind (K-Ultra)', previous: prevStart, next: nextStart })

    adjustedRecipe = {
      ...recipe,
      grind: {
        ...recipe.grind,
        k_ultra: { ...kUltra, starting_point: nextStart },
      },
      range_logic: {
        ...recipe.range_logic,
        freshness_offset: formatClickOffset(currentWindowOffset),
      },
    }
  }

  // Temp: small offset for very stale coffee (−1°C) or resting (+1°C)
  if (currentWindow === 'stale' && savedWindowOffset >= 0) {
    const prevTemp = recipe.parameters.temperature_c
    const nextTemp = prevTemp - 1
    changedFields.push({ field: 'temperature', previous: `${prevTemp}°C`, next: `${nextTemp}°C` })
    adjustedRecipe = {
      ...adjustedRecipe,
      parameters: { ...adjustedRecipe.parameters, temperature_c: nextTemp },
    }
  }

  const FRESHNESS_LABELS: Record<FreshnessWindow, string> = {
    resting: 'Resting (< 5 days post-roast)',
    optimal: 'Optimal (5–28 days post-roast)',
    fading:  'Fading (28–45 days post-roast)',
    stale:   'Stale (45+ days post-roast)',
  }

  return {
    adjusted: true,
    daysPostRoast,
    freshnessLabel: FRESHNESS_LABELS[currentWindow],
    changedFields,
    adjustedRecipe,
  }
}
