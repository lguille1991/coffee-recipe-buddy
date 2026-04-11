// Feedback adjustment engine — Block 9 navigation rules + Block 10 conflict checks.
// All adjustments stay within the final operating range. One variable per round.

import { Recipe, Symptom, AdjustmentMetadata, RecipeWithAdjustment, GrinderId } from '@/types/recipe'
import {
  parseKUltraRange,
} from './grinder-converter'
import { buildDerivedGrindSettings, parseClickCount } from './grind-settings'
import { getMethodRatioBounds, inferRangeLogicContext } from './recipe-policy'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse "1:15" → 15.0 */
function parseRatioNumber(ratio: string): number | null {
  const m = ratio.match(/1:(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

/** Format ratio number back to "1:15" or "1:14.5" */
function formatRatio(n: number): string {
  return n % 1 === 0 ? `1:${n}` : `1:${n.toFixed(1)}`
}

/** Scale pour step volumes proportionally when ratio (water total) changes */
function recalculateSteps(recipe: Recipe, newWaterG: number) {
  const scale = newWaterG / recipe.parameters.water_g
  let accumulated = 0
  return recipe.steps.map(step => {
    const poured = Math.round(step.water_poured_g * scale)
    accumulated += poured
    return { ...step, water_poured_g: poured, water_accumulated_g: accumulated }
  })
}

// ─── Block 10 conflict checks ─────────────────────────────────────────────────

interface ConflictResult {
  override: boolean
  action: 'use_secondary' | null
  note: string
}

function checkBlock10Conflicts(
  recipe: Recipe,
  symptom: Symptom,
  currentClicks: number,
  operatingRange: { low: number; high: number },
): ConflictResult {
  const noConflict: ConflictResult = { override: false, action: null, note: '' }

  // Detect bean context from range_logic assumptions (approximations)
  const { isNatural, isAnaerobic, isLightRoast, isVeryFresh } =
    inferRangeLogicContext(recipe.range_logic)

  const rangeMid = (operatingRange.low + operatingRange.high) / 2
  const isMidRange = Math.abs(currentClicks - rangeMid) <= 1.5

  // Conflict 1: Natural + light roast + mid-range grind + acidic
  // → prefer temp increase over finer grind (risk of saturating the cup)
  if (symptom === 'too_acidic' && isNatural && isLightRoast && isMidRange) {
    return {
      override: true,
      action: 'use_secondary',
      note: 'Natural + light roast combination: increasing temperature is safer than going finer (reduces saturation risk)',
    }
  }

  // Conflict 2: Very fresh + fine grind + slow drain
  // → go coarser (finer won't help with CO2 channeling)
  if (symptom === 'slow_drain' && isVeryFresh) {
    // The primary adjustment for slow_drain is already coarser, so this just adds a note
    return {
      override: false,
      action: null,
      note: 'Very fresh coffee: going coarser and extending bloom is more effective than technique adjustments',
    }
  }

  // Conflict 3: Anaerobic + already low temp + bitter
  // → go coarser, not colder
  if (symptom === 'too_bitter' && isAnaerobic) {
    const lowTempThreshold = 87
    if (recipe.parameters.temperature_c <= lowTempThreshold) {
      return {
        override: true,
        action: 'use_secondary',
        note: `Anaerobic process at low temperature (${recipe.parameters.temperature_c}°C): going coarser is preferred over dropping temperature further`,
      }
    }
  }

  return noConflict
}

// ─── Main adjustment function ─────────────────────────────────────────────────

export interface AdjustResult {
  recipe: RecipeWithAdjustment
  adjustment: AdjustmentMetadata
}

export function applyFeedbackAdjustment(
  recipe: Recipe,
  symptom: Symptom,
  round: number,
  preferredGrinder: GrinderId = 'k_ultra',
): AdjustResult {
  // Parse operating range
  const operatingRangeRaw = parseKUltraRange(recipe.range_logic.final_operating_range)
  if (!operatingRangeRaw) {
    throw new Error(`Cannot parse final_operating_range: ${recipe.range_logic.final_operating_range}`)
  }
  const operatingRange: { low: number; high: number; mid: number } = operatingRangeRaw

  const currentClicksRaw = parseClickCount(recipe.grind.k_ultra.starting_point)
  if (currentClicksRaw === null) {
    throw new Error(`Cannot parse K-Ultra starting_point: ${recipe.grind.k_ultra.starting_point}`)
  }
  const currentClicks: number = currentClicksRaw

  // Check Block 10 conflicts before determining action
  const conflict = checkBlock10Conflicts(recipe, symptom, currentClicks, operatingRange)

  // Determine adjustment plan
  type GrindDirection = 'finer' | 'coarser'

  interface GrindPlan {
    type: 'grind'
    direction: GrindDirection
    clicks: number
  }
  interface TempPlan {
    type: 'temperature'
    delta: number
  }
  interface RatioPlan {
    type: 'ratio'
    delta: number // negative = more concentrated
  }
  interface NudgePlan {
    type: 'technique_nudge'
    message: string
  }
  type Plan = GrindPlan | TempPlan | RatioPlan | NudgePlan

  function grindAtEdge(direction: GrindDirection): boolean {
    if (direction === 'finer') return currentClicks <= operatingRange.low
    return currentClicks >= operatingRange.high
  }

  function primaryGrindPlan(direction: GrindDirection): GrindPlan {
    const GRIND_STEP = 2
    const target =
      direction === 'finer'
        ? Math.max(operatingRange.low, currentClicks - GRIND_STEP)
        : Math.min(operatingRange.high, currentClicks + GRIND_STEP)
    return { type: 'grind', direction, clicks: target }
  }

  let plan: Plan
  let conflictNote = conflict.note

  switch (symptom) {
    case 'too_acidic': {
      const forceSecondary = conflict.override && conflict.action === 'use_secondary'
      if (!forceSecondary && !grindAtEdge('finer')) {
        plan = primaryGrindPlan('finer')
      } else {
        // Secondary: raise temperature
        const newTemp = Math.min(100, recipe.parameters.temperature_c + 1)
        plan = { type: 'temperature', delta: 1 }
        if (!conflictNote) conflictNote = 'Grind is already at the fine edge of the operating range'
        void newTemp
      }
      break
    }

    case 'too_bitter': {
      // Block 10 conflict 3: anaerobic + low temp → force coarser (secondary becomes primary)
      const forceCoarser = conflict.override && conflict.action === 'use_secondary'
      if (forceCoarser || !grindAtEdge('coarser')) {
        plan = primaryGrindPlan('coarser')
      } else {
        // Secondary: lower temperature
        plan = { type: 'temperature', delta: -1 }
        if (!conflictNote) conflictNote = 'Grind is already at the coarse edge of the operating range'
      }
      break
    }

    case 'flat_lifeless': {
      if (!grindAtEdge('finer')) {
        plan = primaryGrindPlan('finer')
      } else {
        // Secondary: lower ratio (more coffee, more concentrated)
        plan = { type: 'ratio', delta: -0.5 }
        if (!conflictNote) conflictNote = 'Grind is at the fine edge; moving toward a more concentrated ratio'
      }
      break
    }

    case 'slow_drain': {
      if (!grindAtEdge('coarser')) {
        plan = primaryGrindPlan('coarser')
      } else {
        plan = {
          type: 'technique_nudge',
          message: 'Grind is at the coarse edge. Try reducing pour aggressiveness and extending your bloom by 10–15 seconds.',
        }
      }
      break
    }

    case 'fast_drain': {
      if (!grindAtEdge('finer')) {
        plan = primaryGrindPlan('finer')
      } else {
        plan = {
          type: 'technique_nudge',
          message: 'Grind is at the fine edge. Focus on improving bloom coverage and slowing your pour technique.',
        }
      }
      break
    }
  }

  // ─── Apply the plan ─────────────────────────────────────────────────────────

  let updatedRecipe: RecipeWithAdjustment = { ...recipe }
  let adjustment: AdjustmentMetadata

  if (plan.type === 'grind') {
    const newClicks = plan.clicks
    const rangeObj = parseKUltraRange(recipe.range_logic.final_operating_range)!
    const newGrind = buildDerivedGrindSettings(
      recipe,
      rangeObj.low,
      rangeObj.high,
      newClicks,
    )
    updatedRecipe = { ...updatedRecipe, grind: newGrind }

    const prevVal = preferredGrinder === 'k_ultra'
      ? `${currentClicks} clicks`
      : recipe.grind[preferredGrinder].starting_point
    const newVal = preferredGrinder === 'k_ultra'
      ? `${newClicks} clicks`
      : newGrind[preferredGrinder].starting_point
    const dir = plan.direction

    adjustment = {
      round,
      symptom,
      variable_changed: 'grind',
      previous_value: prevVal,
      new_value: newVal,
      direction: dir,
      note: conflictNote || `Moved ${dir} within operating range (${recipe.range_logic.final_operating_range})`,
    }
  } else if (plan.type === 'temperature') {
    const prevTemp = recipe.parameters.temperature_c
    const newTemp = Math.max(60, Math.min(100, prevTemp + plan.delta))
    updatedRecipe = {
      ...updatedRecipe,
      parameters: { ...updatedRecipe.parameters, temperature_c: newTemp },
    }

    const dir = plan.delta > 0 ? 'warmer' : 'cooler'
    adjustment = {
      round,
      symptom,
      variable_changed: 'temperature',
      previous_value: `${prevTemp}°C`,
      new_value: `${newTemp}°C`,
      direction: dir,
      note: conflictNote || `Adjusted temperature ${dir} by ${Math.abs(plan.delta)}°C`,
    }
  } else if (plan.type === 'ratio') {
    const currentRatioNum = parseRatioNumber(recipe.parameters.ratio)
    if (currentRatioNum === null) {
      throw new Error(`Cannot parse ratio: ${recipe.parameters.ratio}`)
    }

    const methodBounds = getMethodRatioBounds(recipe.method)
    const newRatioNum = Math.max(methodBounds.low, Math.min(methodBounds.high, currentRatioNum + plan.delta))
    const newRatio = formatRatio(newRatioNum)
    const newWaterG = Math.round(recipe.parameters.coffee_g * newRatioNum)
    const newSteps = recalculateSteps(recipe, newWaterG)

    updatedRecipe = {
      ...updatedRecipe,
      parameters: { ...updatedRecipe.parameters, water_g: newWaterG, ratio: newRatio },
      steps: newSteps,
    }

    const dir = plan.delta < 0 ? 'more concentrated' : 'more dilute'
    adjustment = {
      round,
      symptom,
      variable_changed: 'ratio',
      previous_value: recipe.parameters.ratio,
      new_value: newRatio,
      direction: dir,
      note: conflictNote || `Moved ratio toward ${dir} end of method range (1:${methodBounds.low}–1:${methodBounds.high})`,
    }
  } else {
    // technique_nudge — no numeric change, just surface the note
    adjustment = {
      round,
      symptom,
      variable_changed: 'technique',
      previous_value: '—',
      new_value: '—',
      direction: 'no change',
      note: plan.message,
    }
  }

  updatedRecipe.adjustment_applied = adjustment

  return { recipe: updatedRecipe, adjustment }
}
