import {
  parseGrinderValueForEdit,
  parseKUltraRange,
  grinderValueToKUltraClicks,
  type GrinderEditValue,
} from '@/lib/grinder-converter'
import { buildDerivedGrindSettings } from '@/lib/grind-settings'
import type {
  FeedbackRound,
  GrinderId,
  ManualEditRound,
  RecipeDraftStep,
  SavedRecipe,
} from '@/types/recipe'

export type EditDraft = {
  coffee_g: number
  water_g: number
  ratio_multiplier: number
  scaledFromDose: boolean
  scaledFromRatio: boolean
  temperature_display: number | ''
  total_time: string
  grind_preferred_value: GrinderEditValue
  steps: RecipeDraftStep[]
}

export type AnyFeedbackRound = FeedbackRound | ManualEditRound

export function isFeedbackRound(round: AnyFeedbackRound): round is FeedbackRound {
  return !('type' in round) || round.type === 'feedback'
}

export function isManualEditRound(round: AnyFeedbackRound): round is ManualEditRound {
  return 'type' in round && (round.type === 'manual_edit' || round.type === 'auto_adjust')
}

export function recomputeAccumulated(steps: RecipeDraftStep[]): RecipeDraftStep[] {
  let accumulated = 0
  return steps.map(step => {
    accumulated = Math.round((accumulated + step.water_poured_g) * 10) / 10
    return { ...step, water_accumulated_g: accumulated }
  })
}

export function scaleStepsToWater(steps: RecipeDraftStep[], oldWater: number, newWater: number): RecipeDraftStep[] {
  if (oldWater === 0 || oldWater === newWater) return steps

  const scaled = steps.map(step => ({
    ...step,
    water_poured_g: step.water_poured_g === 0 ? 0 : Math.round(step.water_poured_g / oldWater * newWater * 10) / 10,
  }))

  const currentSum = Math.round(scaled.reduce((sum, step) => sum + step.water_poured_g, 0) * 10) / 10
  const remainder = Math.round((newWater - currentSum) * 10) / 10

  if (remainder !== 0) {
    const lastNonZero = scaled.reduceRight((found, step, index) => (
      found === -1 && step.water_poured_g > 0 ? index : found
    ), -1)

    if (lastNonZero !== -1) {
      scaled[lastNonZero] = {
        ...scaled[lastNonZero],
        water_poured_g: Math.round((scaled[lastNonZero].water_poured_g + remainder) * 10) / 10,
      }
    }
  }

  return recomputeAccumulated(scaled)
}

export function validateSteps(steps: RecipeDraftStep[], targetWaterG: number): string | null {
  if (steps.length > 20) return 'Recipes can have at most 20 steps.'

  const timeRegex = /^\d+:[0-5]\d$/
  let previousSeconds = -1

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]
    const stepNumber = index + 1

    if (!step.action.trim()) return `Step ${stepNumber} is missing a description.`
    if (!timeRegex.test(step.time)) return `Step ${stepNumber} has an invalid time "${step.time}" — use m:ss format (e.g. 1:30).`
    if (step.water_poured_g < 0) return `Step ${stepNumber} has a negative water amount.`

    const [minutes, seconds] = step.time.split(':').map(Number)
    const totalSeconds = minutes * 60 + seconds
    if (totalSeconds < previousSeconds) {
      return `Step ${stepNumber} time (${step.time}) is earlier than the previous step — steps must be in chronological order.`
    }
    previousSeconds = totalSeconds
  }

  const totalPoured = Math.round(steps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10) / 10
  if (Math.abs(totalPoured - targetWaterG) > 1) {
    return `Step water amounts total ${totalPoured} g but the recipe targets ${targetWaterG} g. Adjust individual step amounts to match.`
  }

  return null
}

export function createEditDraft(recipe: SavedRecipe, tempUnit: 'C' | 'F', preferredGrinder: GrinderId): EditDraft {
  const currentRecipe = recipe.current_recipe_json

  return {
    coffee_g: currentRecipe.parameters.coffee_g,
    water_g: currentRecipe.parameters.water_g,
    ratio_multiplier: currentRecipe.parameters.water_g / currentRecipe.parameters.coffee_g,
    scaledFromDose: false,
    scaledFromRatio: false,
    temperature_display: tempUnit === 'F'
      ? Math.round(currentRecipe.parameters.temperature_c * 9 / 5 + 32)
      : currentRecipe.parameters.temperature_c,
    total_time: currentRecipe.parameters.total_time,
    grind_preferred_value: parseGrinderValueForEdit(preferredGrinder, currentRecipe.grind[preferredGrinder].starting_point),
    steps: currentRecipe.steps.map((step, index) => ({ ...step, _dndId: `step-${index}-${step.step}` })),
  }
}

export function createEmptyEditDraft(): EditDraft {
  return {
    coffee_g: 0,
    water_g: 0,
    ratio_multiplier: 0,
    scaledFromDose: false,
    scaledFromRatio: false,
    temperature_display: '',
    total_time: '',
    grind_preferred_value: '',
    steps: [{
      step: 1,
      time: '',
      action: '',
      water_poured_g: 0,
      water_accumulated_g: 0,
      _dndId: 'step-0-1',
    }],
  }
}

function normalizeDraftForComparison(draft: EditDraft) {
  return {
    coffee_g: draft.coffee_g,
    water_g: draft.water_g,
    temperature_display: draft.temperature_display,
    total_time: draft.total_time,
    grind_preferred_value: draft.grind_preferred_value,
    steps: draft.steps.map(step => ({
      step: step.step,
      time: step.time,
      action: step.action,
      water_poured_g: step.water_poured_g,
      water_accumulated_g: step.water_accumulated_g,
    })),
  }
}

export function hasEditDraftChanges(
  recipe: SavedRecipe,
  draft: EditDraft,
  tempUnit: 'C' | 'F',
  preferredGrinder: GrinderId,
) {
  const originalDraft = createEditDraft(recipe, tempUnit, preferredGrinder)

  return JSON.stringify(normalizeDraftForComparison(draft)) !== JSON.stringify(normalizeDraftForComparison(originalDraft))
}

export function buildLiveGrindSettings(recipe: SavedRecipe, preferredGrinder: GrinderId, draft: EditDraft) {
  const currentRecipe = recipe.current_recipe_json
  if (draft.grind_preferred_value === '') {
    return currentRecipe.grind
  }
  const newKUltraClicks = grinderValueToKUltraClicks(preferredGrinder, draft.grind_preferred_value)
  const range = parseKUltraRange(currentRecipe.range_logic.final_operating_range)
  const low = range?.low ?? newKUltraClicks
  const high = range?.high ?? newKUltraClicks

  return buildDerivedGrindSettings(currentRecipe, low, high, newKUltraClicks)
}
