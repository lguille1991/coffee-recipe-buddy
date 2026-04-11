import { Recipe, BeanProfile, ValidationResult, RecipeSchema } from '@/types/recipe'
import { getMethodRatioBounds } from './recipe-policy'

const POUR_OVER_METHODS = new Set([
  'v60', 'origami', 'orea_v4', 'hario_switch', 'kalita_wave',
  'chemex', 'ceado_hoop', 'pulsar',
])

export function validateRecipe(
  rawRecipe: unknown,
  bean: BeanProfile,
  method: string,
): ValidationResult {
  const errors: string[] = []

  // 1. Zod schema validation
  const parsed = RecipeSchema.safeParse(rawRecipe)
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(i => `Schema: ${i.path.join('.')} — ${i.message}`),
    }
  }

  const recipe: Recipe = parsed.data

  // 2. Ratio math: coffee_g × ratio_number ≈ water_g (±5g)
  const ratioMatch = recipe.parameters.ratio.match(/1:(\d+\.?\d*)/)
  if (ratioMatch) {
    const ratioNum = parseFloat(ratioMatch[1])
    const expectedWater = recipe.parameters.coffee_g * ratioNum
    if (Math.abs(expectedWater - recipe.parameters.water_g) > 5) {
      errors.push(
        `Ratio math mismatch: ${recipe.parameters.coffee_g}g × ${ratioNum} = ${expectedWater.toFixed(1)}g, but water_g = ${recipe.parameters.water_g}g (>5g off).`
      )
    }

    // Check ratio is within method's range
    const ratioRange = getMethodRatioBounds(method || recipe.method)
    const { low: minRatio, high: maxRatio } = ratioRange
    if (ratioNum < minRatio || ratioNum > maxRatio) {
      errors.push(
        `Ratio 1:${ratioNum} outside method range 1:${minRatio}–1:${maxRatio} for ${recipe.display_name}.`
      )
    }
  }

  // 3. Water sum: sum(steps water_poured_g) = water_g
  const totalPoured = recipe.steps.reduce((sum, s) => sum + s.water_poured_g, 0)
  if (Math.abs(totalPoured - recipe.parameters.water_g) > 1) {
    errors.push(
      `Step water sum ${totalPoured}g ≠ water_g ${recipe.parameters.water_g}g. Steps must sum exactly.`
    )
  }

  // 4. Final accumulated water = water_g
  const lastStep = recipe.steps[recipe.steps.length - 1]
  if (Math.abs(lastStep.water_accumulated_g - recipe.parameters.water_g) > 1) {
    errors.push(
      `Last step accumulated ${lastStep.water_accumulated_g}g ≠ water_g ${recipe.parameters.water_g}g.`
    )
  }

  // 5. All 4 grinders present (schema already enforces, but double-check non-empty)
  if (!recipe.grind.k_ultra.range || !recipe.grind.q_air.range || !recipe.grind.baratza_encore_esp.range || !recipe.grind.timemore_c2.range) {
    errors.push('All 4 grinder ranges must be present and non-empty.')
  }

  // 6. All 5 quick adjustment keys present (schema enforces, but check non-empty)
  const qa = recipe.quick_adjustments
  const qaKeys = ['too_acidic', 'too_bitter', 'flat_or_lifeless', 'slow_drain', 'fast_drain'] as const
  qaKeys.forEach(key => {
    if (!qa[key] || qa[key].trim().length === 0) {
      errors.push(`quick_adjustments.${key} is missing or empty.`)
    }
  })

  // 7. range_logic completeness
  const rl = recipe.range_logic
  const rlKeys = ['base_range', 'process_offset', 'roast_offset', 'freshness_offset', 'density_offset', 'final_operating_range'] as const
  rlKeys.forEach(key => {
    if (!rl[key] || rl[key].trim().length === 0) {
      errors.push(`range_logic.${key} is missing or empty.`)
    }
  })

  // 8. Grinder zone constraints for pour-over
  if (POUR_OVER_METHODS.has(recipe.method)) {
    const baratzaStartMatch = recipe.grind.baratza_encore_esp.starting_point.match(/(\d+)/)
    if (baratzaStartMatch) {
      const baratzaClick = parseInt(baratzaStartMatch[1], 10)
      if (baratzaClick < 14 || baratzaClick > 24) {
        errors.push(
          `Baratza Encore ESP starting_point (click ${baratzaClick}) outside pour-over zone 14–24.`
        )
      }
    }

    const c2StartMatch = recipe.grind.timemore_c2.starting_point.match(/(\d+)/)
    if (c2StartMatch) {
      const c2Click = parseInt(c2StartMatch[1], 10)
      if (c2Click < 14 || c2Click > 22) {
        errors.push(
          `Timemore C2 starting_point (click ${c2Click}) outside pour-over zone 14–22.`
        )
      }
    }
  }

  // 9. Final range width ≤ 10 K-Ultra clicks (Block 5B)
  const finalRangeMatch = rl.final_operating_range.match(/(\d+)[–—-](\d+)\s*clicks?/i)
  if (finalRangeMatch) {
    const low = parseInt(finalRangeMatch[1], 10)
    const high = parseInt(finalRangeMatch[2], 10)
    if (high - low > 10) {
      errors.push(
        `Final operating range width ${high - low} clicks exceeds the 10-click accumulation cap.`
      )
    }
  }

  // 10. Temperature sanity (60–100°C)
  const temp = recipe.parameters.temperature_c
  if (temp < 60 || temp > 100) {
    errors.push(`Temperature ${temp}°C is outside valid brew range (60–100°C).`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function buildRetryPrompt(errors: ValidationResult['errors']): string {
  return (
    '\n\nThe previous recipe output failed validation. Fix ALL of the following errors and output the corrected JSON:\n' +
    errors.map(e => `- ${e}`).join('\n') +
    '\n\nOutput ONLY the corrected JSON. No explanation.'
  )
}
