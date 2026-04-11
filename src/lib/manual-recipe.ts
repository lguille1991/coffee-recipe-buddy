import { createEmptyEditDraft, recomputeAccumulated, validateSteps, type EditDraft } from '@/app/recipes/[id]/_lib/editing'
import type { BeanProfile, GrinderId, MethodId, RecipeDraftStep, RecipeWithAdjustment } from '@/types/recipe'
import { METHOD_DISPLAY_NAMES, RecipeWithAdjustmentSchema } from '@/types/recipe'
import { deriveSecondaryGrindSettings } from '@/lib/grind-settings'
import { grinderValueToKUltraClicks, isValidQAirSetting } from '@/lib/grinder-converter'

export type ManualRecipeDraft = {
  bean_info: BeanProfile
  method: MethodId
  display_name: string
  edit_draft: EditDraft
}

export type ManualRecipeValidationResult = {
  valid: boolean
  error: string | null
}

const METHOD_FILTERS: Record<MethodId, string> = {
  v60: 'Hario V60 02 bleached',
  origami: 'Origami Air M paper filter',
  orea_v4: 'Orea V4 flat-bottom filter',
  hario_switch: 'Hario Switch paper filter',
  kalita_wave: 'Kalita Wave 185 filter',
  chemex: 'Chemex bonded filter',
  ceado_hoop: 'Ceado Hoop paper filter',
  pulsar: 'NextLevel Pulsar filter',
  aeropress: 'AeroPress paper filter',
}

const MANUAL_QUICK_ADJUSTMENTS: RecipeWithAdjustment['quick_adjustments'] = {
  too_acidic: 'Adjust manually after tasting. Start by grinding slightly finer or extending contact time.',
  too_bitter: 'Adjust manually after tasting. Start by grinding slightly coarser or reducing contact time.',
  flat_or_lifeless: 'Adjust manually after tasting. Try raising temperature or increasing agitation slightly.',
  slow_drain: 'Adjust manually after tasting. Try grinding slightly coarser or reducing agitation.',
  fast_drain: 'Adjust manually after tasting. Try grinding slightly finer or increasing agitation.',
}

const MANUAL_BREW_TIME_REGEX = /^\d+:\d{2}(-\d+:\d{2})?$/

function buildDisplayName(method: MethodId, bean: BeanProfile) {
  const methodName = METHOD_DISPLAY_NAMES[method]
  const beanName = bean.bean_name?.trim()
  const roaster = bean.roaster?.trim()

  if (beanName) return `${methodName} · ${beanName}`
  if (roaster) return `${methodName} · ${roaster}`
  return methodName
}

function cleanSteps(steps: RecipeDraftStep[]) {
  return recomputeAccumulated(
    steps.map((step, index) => ({
      ...step,
      step: index + 1,
    })),
  ).map(step => ({
    step: step.step,
    time: step.time,
    action: step.action.trim(),
    water_poured_g: step.water_poured_g,
    water_accumulated_g: step.water_accumulated_g,
  }))
}

export function createManualRecipeDraft(bean: BeanProfile, method: MethodId): ManualRecipeDraft {
  return {
    bean_info: bean,
    method,
    display_name: buildDisplayName(method, bean),
    edit_draft: createEmptyEditDraft(),
  }
}

export function validateManualRecipeDraft(
  draft: ManualRecipeDraft,
  preferredGrinder: GrinderId,
  tempUnit: 'C' | 'F',
): ManualRecipeValidationResult {
  const { edit_draft: editDraft } = draft

  if (editDraft.coffee_g <= 0) return { valid: false, error: 'Coffee dose is required.' }
  if (editDraft.water_g <= 0) return { valid: false, error: 'Water amount is required.' }
  if (editDraft.temperature_display === '') return { valid: false, error: 'Temperature is required.' }
  if (!editDraft.total_time.trim()) return { valid: false, error: 'Brew time is required.' }
  if (editDraft.grind_preferred_value === '') return { valid: false, error: 'Grind setting is required.' }

  if (!MANUAL_BREW_TIME_REGEX.test(editDraft.total_time)) {
    return { valid: false, error: 'Brew time must use m:ss or m:ss-m:ss format with no spaces, for example 1:00 or 1:00-1:45.' }
  }

  if (preferredGrinder === 'q_air' && (typeof editDraft.grind_preferred_value !== 'string' || !isValidQAirSetting(editDraft.grind_preferred_value))) {
    return { valid: false, error: 'Q-Air grind must use rotations.major.minor format, for example 2.5.0.' }
  }

  const stepError = validateSteps(editDraft.steps, editDraft.water_g)
  if (stepError) return { valid: false, error: stepError }

  const recipe = buildRecipeFromManualDraft(draft, preferredGrinder, tempUnit)
  const parsed = RecipeWithAdjustmentSchema.safeParse(recipe)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { valid: false, error: issue ? `${issue.path.join('.')} ${issue.message}` : 'Recipe draft is incomplete.' }
  }

  return { valid: true, error: null }
}

export function buildRecipeFromManualDraft(
  draft: ManualRecipeDraft,
  preferredGrinder: GrinderId,
  tempUnit: 'C' | 'F',
): RecipeWithAdjustment {
  const { bean_info: bean, method, edit_draft: editDraft } = draft
  const coffeeG = typeof editDraft.coffee_g === 'number' ? editDraft.coffee_g : 0
  const waterG = typeof editDraft.water_g === 'number' ? editDraft.water_g : 0
  const temperatureC = typeof editDraft.temperature_display === 'number'
    ? (tempUnit === 'F'
      ? Math.round((editDraft.temperature_display - 32) * 5 / 9)
      : editDraft.temperature_display)
    : 0

  const kUltraClicks = editDraft.grind_preferred_value === ''
    ? 0
    : grinderValueToKUltraClicks(preferredGrinder, editDraft.grind_preferred_value)

  const secondary = deriveSecondaryGrindSettings(method, kUltraClicks, kUltraClicks, kUltraClicks)
  const steps = cleanSteps(editDraft.steps)
  const ratioValue = coffeeG > 0 ? Number((waterG / coffeeG).toFixed(1)) : 0
  const ratio = ratioValue > 0 ? `1:${ratioValue.toFixed(1)}` : '1:0.0'

  return {
    method,
    display_name: draft.display_name || buildDisplayName(method, bean),
    objective: 'Manual recipe created without AI guidance.',
    parameters: {
      coffee_g: coffeeG,
      water_g: waterG,
      ratio,
      temperature_c: temperatureC,
      filter: METHOD_FILTERS[method],
      total_time: editDraft.total_time.trim(),
    },
    grind: {
      k_ultra: {
        range: `${kUltraClicks}–${kUltraClicks} clicks`,
        starting_point: `${kUltraClicks} clicks`,
        note: 'Manual recipe entry.',
      },
      q_air: secondary.q_air,
      baratza_encore_esp: secondary.baratza_encore_esp,
      timemore_c2: secondary.timemore_c2,
    },
    range_logic: {
      base_range: 'Manual recipe',
      process_offset: 'Not AI-generated',
      roast_offset: 'Not AI-generated',
      freshness_offset: bean.roast_date ? `Roast date noted: ${bean.roast_date}` : 'Roast date not provided',
      density_offset: bean.altitude_masl ? `Altitude noted: ${bean.altitude_masl} masl` : 'Altitude not provided',
      final_operating_range: `${kUltraClicks}–${kUltraClicks} clicks`,
      compressed: false,
      starting_point: `${kUltraClicks} clicks`,
    },
    steps,
    quick_adjustments: MANUAL_QUICK_ADJUSTMENTS,
  }
}
