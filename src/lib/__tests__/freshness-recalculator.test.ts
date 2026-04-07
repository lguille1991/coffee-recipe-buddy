import { describe, it, expect } from 'vitest'
import { recalculateFreshness } from '../freshness-recalculator'
import { BASE_RECIPE } from './fixtures'

// Helper: produce a roast date N days before `today`
function roastDateDaysAgo(days: number, today: Date): string {
  const d = new Date(today)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const TODAY = new Date('2025-06-01')

describe('recalculateFreshness', () => {
  it('returns no-change when roast date is undefined', () => {
    const result = recalculateFreshness(BASE_RECIPE, undefined, TODAY)
    expect(result.adjusted).toBe(false)
    expect(result.changedFields).toHaveLength(0)
    expect(result.adjustedRecipe).toBe(BASE_RECIPE)
  })

  it('returns no-change when roast date is invalid', () => {
    const result = recalculateFreshness(BASE_RECIPE, 'not-a-date', TODAY)
    expect(result.adjusted).toBe(false)
  })

  it('returns correct daysPostRoast', () => {
    const roastDate = roastDateDaysAgo(10, TODAY)
    const result = recalculateFreshness(BASE_RECIPE, roastDate, TODAY)
    expect(result.daysPostRoast).toBe(10)
  })

  it('no change when coffee is in optimal window and saved offset is 0', () => {
    // 10 days → optimal window (5–27 days), offset = 0. Saved freshness_offset = '0 clicks' → 0.
    // delta = 0 - 0 = 0 → no change
    const roastDate = roastDateDaysAgo(10, TODAY)
    const result = recalculateFreshness(BASE_RECIPE, roastDate, TODAY)
    expect(result.adjusted).toBe(false)
  })

  it('coarsens grind by +2 clicks for resting coffee (<5 days)', () => {
    const roastDate = roastDateDaysAgo(3, TODAY)
    // Recipe saved with freshness_offset '0 clicks' → savedWindowOffset = 0
    // currentWindowOffset for 'resting' = +2
    // delta = +2 - 0 = +2
    const result = recalculateFreshness(BASE_RECIPE, roastDate, TODAY)
    expect(result.adjusted).toBe(true)
    expect(result.freshnessLabel).toContain('Resting')
    const grindChange = result.changedFields.find(f => f.field === 'grind (K-Ultra)')
    expect(grindChange).toBeDefined()
    expect(grindChange!.previous).toBe('82 clicks')
    expect(grindChange!.next).toBe('84 clicks') // 82 + 2
  })

  it('fines grind by -1 click for fading coffee (28–44 days)', () => {
    const roastDate = roastDateDaysAgo(35, TODAY)
    // currentWindowOffset for 'fading' = -1, savedWindowOffset = 0
    // delta = -1 - 0 = -1
    const result = recalculateFreshness(BASE_RECIPE, roastDate, TODAY)
    expect(result.adjusted).toBe(true)
    expect(result.freshnessLabel).toContain('Fading')
    const grindChange = result.changedFields.find(f => f.field === 'grind (K-Ultra)')
    expect(grindChange!.next).toBe('81 clicks') // 82 - 1
  })

  it('fines grind by -2 clicks for stale coffee (45+ days)', () => {
    const roastDate = roastDateDaysAgo(50, TODAY)
    // currentWindowOffset = -2, savedWindowOffset = 0, delta = -2
    const result = recalculateFreshness(BASE_RECIPE, roastDate, TODAY)
    expect(result.adjusted).toBe(true)
    expect(result.freshnessLabel).toContain('Stale')
    const grindChange = result.changedFields.find(f => f.field === 'grind (K-Ultra)')
    expect(grindChange!.next).toBe('80 clicks') // 82 - 2
  })

  it('also reduces temperature by 1°C for stale coffee', () => {
    const roastDate = roastDateDaysAgo(50, TODAY)
    const result = recalculateFreshness(BASE_RECIPE, roastDate, TODAY)
    const tempChange = result.changedFields.find(f => f.field === 'temperature')
    expect(tempChange).toBeDefined()
    expect(tempChange!.next).toBe('92°C') // 93 - 1
    expect(result.adjustedRecipe.parameters.temperature_c).toBe(92)
  })

  it('updates freshness_offset in range_logic to reflect current window', () => {
    const roastDate = roastDateDaysAgo(3, TODAY) // resting → +2
    const result = recalculateFreshness(BASE_RECIPE, roastDate, TODAY)
    expect(result.adjustedRecipe.range_logic.freshness_offset).toBe('+2 clicks')
  })

  it('returns the right freshnessLabel for each window', () => {
    // Resting (< 5 days), delta != 0 → uses FRESHNESS_LABELS map (capitalized)
    expect(recalculateFreshness(BASE_RECIPE, roastDateDaysAgo(3, TODAY), TODAY).freshnessLabel)
      .toContain('Resting')
    // Optimal (5–27 days), delta == 0 → returns raw window string 'optimal' (lowercase)
    expect(recalculateFreshness(BASE_RECIPE, roastDateDaysAgo(14, TODAY), TODAY).freshnessLabel)
      .toBe('optimal')
    // Fading (28–44 days), delta != 0 → uses FRESHNESS_LABELS map
    expect(recalculateFreshness(BASE_RECIPE, roastDateDaysAgo(35, TODAY), TODAY).freshnessLabel)
      .toContain('Fading')
    // Stale (45+ days), delta != 0 → uses FRESHNESS_LABELS map
    expect(recalculateFreshness(BASE_RECIPE, roastDateDaysAgo(50, TODAY), TODAY).freshnessLabel)
      .toContain('Stale')
  })

  it('no change when saved freshness_offset already matches current window', () => {
    // Recipe was saved when resting (+2), coffee is still resting (+2) → delta = 0
    const restingRecipe = {
      ...BASE_RECIPE,
      range_logic: { ...BASE_RECIPE.range_logic, freshness_offset: '+2 clicks' },
    }
    const roastDate = roastDateDaysAgo(2, TODAY) // still resting
    const result = recalculateFreshness(restingRecipe, roastDate, TODAY)
    expect(result.adjusted).toBe(false)
  })
})
