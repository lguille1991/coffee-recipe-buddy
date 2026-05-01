import type { BeanProfile, Recipe } from '@/types/recipe'
import {
  METHOD_TEMP_BASES,
  temperatureOriginOffset,
  temperatureProcessOffset,
  temperatureRoastOffset,
  temperatureVarietyOffset,
} from '@/lib/skill-reference'

function clampTemperature(value: number): number {
  return Math.max(88, Math.min(96, value))
}

export function applySkillTemperatureSettings(
  recipe: Recipe,
  bean: BeanProfile,
): Recipe {
  const base = METHOD_TEMP_BASES[recipe.method] ?? METHOD_TEMP_BASES.v60
  const baseTemp = Math.round((base.low + base.high) / 2)
  const processDelta = temperatureProcessOffset(bean.process)
  const roastDelta = temperatureRoastOffset(bean.roast_level)
  const originDelta = temperatureOriginOffset(bean.origin)
  const varietyDelta = temperatureVarietyOffset(bean.variety)

  const nextTemp = clampTemperature(
    baseTemp + processDelta + roastDelta + originDelta + varietyDelta,
  )

  return {
    ...recipe,
    parameters: {
      ...recipe.parameters,
      temperature_c: nextTemp,
    },
  }
}

