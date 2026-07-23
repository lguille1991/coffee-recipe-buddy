import { applySkillGrindSettings } from '@/lib/skill-grind-engine'
import type { BeanProfile, BrewGoal, MethodId, Recipe } from '@/types/recipe'

export const DETERMINISTIC_ENGINE_VERSION = 'v2.0.0'
export const SUPPORTED_ENGINE_VERSIONS = [DETERMINISTIC_ENGINE_VERSION] as const

type RecipeMode = 'standard' | 'four_six'

interface MethodRule {
  readonly capacity: { readonly minWaterG: number; readonly maxWaterG: number }
  readonly ratio: number
  readonly temperatureC: number
  readonly filter: string
  readonly totalTimeSeconds: number
  readonly grindRange: { readonly low: number; readonly high: number }
  readonly pourRate: { readonly low: number; readonly high: number }
  readonly pours: readonly number[]
}

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value as DeepReadonly<T>
}

// The rule IDs deliberately form part of recipe provenance. Changes to a rule
// require a new engine version instead of rewriting historical recipes.
export const RULE_CATALOG = deepFreeze({
  v60: { capacity: { minWaterG: 150, maxWaterG: 500 }, ratio: 16, temperatureC: 94, filter: 'Hario V60 paper filter', totalTimeSeconds: 210, grindRange: { low: 72, high: 79 }, pourRate: { low: 2.5, high: 4 }, pours: [0.2, 0.4, 0.4] },
  origami: { capacity: { minWaterG: 150, maxWaterG: 500 }, ratio: 16, temperatureC: 93, filter: 'Origami cone paper filter', totalTimeSeconds: 195, grindRange: { low: 72, high: 79 }, pourRate: { low: 2.5, high: 4 }, pours: [0.2, 0.4, 0.4] },
  orea_v4: { capacity: { minWaterG: 150, maxWaterG: 500 }, ratio: 16, temperatureC: 93, filter: 'Orea fast paper filter', totalTimeSeconds: 195, grindRange: { low: 71, high: 78 }, pourRate: { low: 2.5, high: 4 }, pours: [0.2, 0.4, 0.4] },
  hario_switch: { capacity: { minWaterG: 150, maxWaterG: 500 }, ratio: 15, temperatureC: 92, filter: 'Hario V60 paper filter', totalTimeSeconds: 225, grindRange: { low: 75, high: 82 }, pourRate: { low: 2, high: 3.5 }, pours: [0.25, 0.5, 0.25] },
  kalita_wave: { capacity: { minWaterG: 155, maxWaterG: 500 }, ratio: 16, temperatureC: 92, filter: 'Kalita Wave filter', totalTimeSeconds: 210, grindRange: { low: 76, high: 82 }, pourRate: { low: 2.5, high: 3.5 }, pours: [0.2, 0.4, 0.4] },
  chemex: { capacity: { minWaterG: 300, maxWaterG: 700 }, ratio: 16.5, temperatureC: 94, filter: 'Chemex bonded paper filter', totalTimeSeconds: 270, grindRange: { low: 78, high: 84 }, pourRate: { low: 3, high: 4.5 }, pours: [0.2, 0.4, 0.4] },
  ceado_hoop: { capacity: { minWaterG: 150, maxWaterG: 330 }, ratio: 15, temperatureC: 92, filter: 'Ceado Hoop paper filter', totalTimeSeconds: 180, grindRange: { low: 76, high: 83 }, pourRate: { low: 2, high: 3.5 }, pours: [0.3, 0.4, 0.3] },
  pulsar: { capacity: { minWaterG: 150, maxWaterG: 500 }, ratio: 15, temperatureC: 92, filter: 'NextLevel Pulsar filter', totalTimeSeconds: 210, grindRange: { low: 73, high: 80 }, pourRate: { low: 2, high: 3.5 }, pours: [0.25, 0.5, 0.25] },
  aeropress: { capacity: { minWaterG: 120, maxWaterG: 250 }, ratio: 13, temperatureC: 88, filter: 'AeroPress paper filter', totalTimeSeconds: 120, grindRange: { low: 66, high: 76 }, pourRate: { low: 2, high: 4 }, pours: [0.4, 0.6] },
} satisfies Record<MethodId, MethodRule>)

export class DeterministicRecipeError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'UNSUPPORTED_MODE' | 'CAPACITY_EXCEEDED' | 'INVARIANT_FAILED',
    message: string,
    public readonly bounds?: { minWaterG: number; maxWaterG: number },
  ) {
    super(message)
  }
}

function parseUtcDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return date.toISOString().slice(0, 10) === value ? date : null
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function formatRatio(waterG: number, coffeeG: number): string {
  const value = waterG / coffeeG
  return `1:${Number.isInteger(value) ? value : value.toFixed(1)}`
}

function allocateIntegerWater(total: number, weights: readonly number[]): number[] {
  const ideal = weights.map(weight => total * weight)
  const allocated = ideal.map(value => Math.floor(value))
  const remaining = total - allocated.reduce((sum, value) => sum + value, 0)
  const ranking = ideal
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (let index = 0; index < remaining; index += 1) {
    allocated[ranking[index % ranking.length].index] += 1
  }

  if (allocated.some(value => value <= 0)) {
    throw new DeterministicRecipeError('INVARIANT_FAILED', 'Water allocator produced a non-positive addition.')
  }
  return allocated
}

function goalRatioOffset(goal: BrewGoal): number {
  switch (goal) {
    case 'clarity': return 0.5
    case 'sweetness': return -0.25
    case 'body': return -0.75
    case 'forgiving': return 0.25
    default: return 0
  }
}

function beanTemperatureOffset(bean: BeanProfile): number {
  if (bean.roast_level === 'dark') return -5
  if (bean.roast_level === 'medium-dark') return -3
  if (bean.roast_level === 'light') return 2
  if (bean.roast_level === 'medium-light') return 1
  return 0
}

function buildBaseRecipe(method: MethodId, rule: MethodRule, waterG: number, coffeeG: number, goal: BrewGoal): Recipe {
  const additions = allocateIntegerWater(waterG, rule.pours)
  let accumulated = 0
  const pourSpacing = Math.max(30, Math.floor((rule.totalTimeSeconds - 35) / additions.length))
  const steps = additions.map((water, index) => {
    accumulated += water
    const duration = Math.max(1, Math.round(water / ((rule.pourRate.low + rule.pourRate.high) / 2)))
    const rate = water / duration
    return {
      step: index + 1,
      time: formatTime(index * pourSpacing),
      action: `Pour ${water}g over ${duration}s (~${rate.toFixed(1)}g/s)${index === 0 ? ' to bloom evenly' : ''}`,
      water_poured_g: water,
      water_accumulated_g: accumulated,
    }
  })
  steps.push({
    step: steps.length + 1,
    time: formatTime(rule.totalTimeSeconds),
    action: 'Allow the bed to finish drawing down.',
    water_poured_g: 0,
    water_accumulated_g: waterG,
  })

  return {
    method,
    recipe_mode: 'standard',
    display_name: `${method.replaceAll('_', ' ')} ${goal} recipe`,
    objective: `A deterministic ${goal} recipe tuned for this coffee and brewer.`,
    parameters: {
      coffee_g: coffeeG,
      water_g: waterG,
      ratio: formatRatio(waterG, coffeeG),
      temperature_c: rule.temperatureC,
      filter: rule.filter,
      total_time: formatTime(rule.totalTimeSeconds),
    },
    grind: {
      k_ultra: { range: '', starting_point: '' },
      fellow_opus: { range: '', starting_point: '' },
      q_air: { range: '', starting_point: '' },
      baratza_encore_esp: { range: '', starting_point: '' },
      timemore_c2: { range: '', starting_point: '' },
    },
    range_logic: {
      base_range: `${rule.grindRange.low}–${rule.grindRange.high} clicks`,
      process_offset: '0 clicks',
      roast_offset: '0 clicks',
      freshness_offset: '0 clicks',
      density_offset: '0 clicks',
      final_operating_range: `${rule.grindRange.low}–${rule.grindRange.high} clicks`,
      compressed: false,
      starting_point: '',
    },
    steps,
    quick_adjustments: {
      too_acidic: 'Grind one step finer or raise water temperature by 1°C.',
      too_bitter: 'Grind one step coarser or lower water temperature by 1°C.',
      flat_or_lifeless: 'Use a slightly finer grind and pour more gently.',
      slow_drain: 'Grind one step coarser and reduce agitation.',
      fast_drain: 'Grind one step finer and keep the pour centered.',
    },
  }
}

function buildFourSixRecipe(bean: BeanProfile, waterG: number, coffeeG: number, goal: BrewGoal): Recipe {
  const firstSplit = goal === 'clarity' ? [0.24, 0.16] : goal === 'sweetness' ? [0.16, 0.24] : [0.2, 0.2]
  const weights = [...firstSplit, 0.2, 0.2, 0.2]
  const additions = allocateIntegerWater(waterG, weights)
  let accumulated = 0
  const steps = additions.map((water, index) => {
    accumulated += water
    const duration = Math.max(1, Math.round(water / 3))
    return {
      step: index + 1,
      time: formatTime(index * 45),
      action: `Pour ${water}g over ${duration}s (~${(water / duration).toFixed(1)}g/s)${index === 0 ? ' for the first 40% balance control' : ''}`,
      water_poured_g: water,
      water_accumulated_g: accumulated,
    }
  })
  steps.push({ step: 6, time: '3:30', action: 'Allow the coffee to draw down; finish by 4:00.', water_poured_g: 0, water_accumulated_g: waterG })

  return {
    ...buildBaseRecipe('v60', RULE_CATALOG.v60, waterG, coffeeG, goal),
    recipe_mode: 'four_six',
    display_name: `V60 4:6 ${goal} recipe`,
    objective: `A deterministic V60 4:6 recipe prioritizing ${goal}.`,
    parameters: { ...buildBaseRecipe('v60', RULE_CATALOG.v60, waterG, coffeeG, goal).parameters, total_time: '3:30' },
    steps,
  }
}

export function getMethodCapacity(method: MethodId): { minWaterG: number; maxWaterG: number } {
  return { ...RULE_CATALOG[method].capacity }
}

export function generateDeterministicRecipe({
  method,
  bean,
  goal,
  targetWaterG,
  recipeMode = 'standard',
  evaluationDate,
  engineVersion = DETERMINISTIC_ENGINE_VERSION,
}: {
  method: MethodId
  bean: BeanProfile
  goal: BrewGoal
  targetWaterG: number
  recipeMode?: RecipeMode
  evaluationDate: string
  engineVersion?: string
}): Recipe {
  const evaluation = parseUtcDate(evaluationDate)
  const roastDate = bean.roast_date ? parseUtcDate(bean.roast_date) : null
  if (!evaluation || (bean.roast_date && !roastDate) || (roastDate && roastDate > evaluation)) {
    throw new DeterministicRecipeError('INVALID_INPUT', 'Evaluation and roast dates must be real dates, and roast date cannot be in the future.')
  }
  if (!Number.isInteger(targetWaterG) || targetWaterG <= 0) {
    throw new DeterministicRecipeError('INVALID_INPUT', 'target water must be a positive integer number of grams.')
  }
  if (!(SUPPORTED_ENGINE_VERSIONS as readonly string[]).includes(engineVersion)) {
    throw new DeterministicRecipeError('INVALID_INPUT', `Unknown deterministic engine version: ${engineVersion}.`)
  }
  if (recipeMode === 'four_six' && method !== 'v60') {
    throw new DeterministicRecipeError('UNSUPPORTED_MODE', 'The 4:6 recipe mode is available only for V60.')
  }

  const rule = RULE_CATALOG[method]
  if (targetWaterG < rule.capacity.minWaterG || targetWaterG > rule.capacity.maxWaterG) {
    throw new DeterministicRecipeError(
      'CAPACITY_EXCEEDED',
      `${method} supports ${rule.capacity.minWaterG}–${rule.capacity.maxWaterG}g of water.`,
      rule.capacity,
    )
  }

  const ratio = rule.ratio + goalRatioOffset(goal)
  const coffeeG = Math.max(1, Math.round(targetWaterG / ratio))
  const base = recipeMode === 'four_six'
    ? buildFourSixRecipe(bean, targetWaterG, coffeeG, goal)
    : buildBaseRecipe(method, rule, targetWaterG, coffeeG, goal)
  const temperatureC = Math.max(60, Math.min(100, base.parameters.temperature_c + beanTemperatureOffset(bean)))
  const recipe = applySkillGrindSettings(
    { ...base, parameters: { ...base.parameters, temperature_c: temperatureC } },
    bean,
    { now: evaluation, parityMode: 'skill_v2' },
  )

  return {
    ...recipe,
    generation_metadata: {
      engine_version: engineVersion,
      evaluation_date: evaluationDate,
      applied_rule_ids: [
        `catalog:${engineVersion}`,
        `method:${method}:capacity`,
        `method:${method}:base`,
        `goal:${goal}`,
        `bean:${bean.process}`,
        `roast:${bean.roast_level}`,
        ...(recipeMode === 'four_six' ? ['mode:v60-four-six'] : []),
      ],
    },
  }
}
