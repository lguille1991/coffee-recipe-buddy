import type { BeanProfile, Recipe } from '@/types/recipe'
import { buildDerivedGrindSettings } from '@/lib/grind-settings'
import {
  METHOD_GRIND_BASES,
  grindAltitudeOffset,
  grindOriginOffset,
  grindProcessOffset,
  grindRoastOffset,
  grindVarietyOffset,
} from '@/lib/skill-reference'

function clampClicks(value: number): number {
  return Math.max(40, Math.min(100, value))
}

function freshnessOffset(roastDate?: string | null, now = new Date()): { clicks: number; label: string } {
  if (!roastDate) {
    return { clicks: 0, label: 'Unknown roast date (assume 7–21 days)' }
  }

  const roast = new Date(roastDate)
  if (Number.isNaN(roast.getTime())) {
    return { clicks: 0, label: 'Invalid roast date (assume 7–21 days)' }
  }

  const ageDays = Math.floor((now.getTime() - roast.getTime()) / (24 * 60 * 60 * 1000))
  if (ageDays <= 6) return { clicks: 2, label: '0–6 days (very fresh)' }
  if (ageDays <= 21) return { clicks: 0, label: '7–21 days (optimal)' }
  if (ageDays <= 35) return { clicks: -1, label: '22–35 days (aging)' }
  if (ageDays <= 60) return { clicks: -2, label: '36–60 days (stale)' }
  return { clicks: -3, label: '60+ days (very stale)' }
}

interface GrindOptions {
  now?: Date
}

export function applySkillGrindSettings(
  recipe: Recipe,
  bean: BeanProfile,
  options: GrindOptions = {},
): Recipe {
  const methodBase = METHOD_GRIND_BASES[recipe.method] ?? METHOD_GRIND_BASES.v60
  const processDelta = grindProcessOffset(bean.process)
  const altitudeDelta = grindAltitudeOffset(bean.altitude_masl)
  const roastDelta = grindRoastOffset(bean.roast_level)
  const varietyDelta = grindVarietyOffset(bean.variety)
  const originDelta = grindOriginOffset(bean.origin)
  const freshness = freshnessOffset(bean.roast_date, options.now)

  const totalDelta = processDelta + altitudeDelta + roastDelta + varietyDelta + originDelta + freshness.clicks

  const rawLow = clampClicks(methodBase.low + totalDelta)
  const rawHigh = clampClicks(methodBase.high + totalDelta)
  const starting = clampClicks(Math.round((rawLow + rawHigh) / 2))

  let low = rawLow
  let high = rawHigh
  let compressed = false

  if (high - low > 10) {
    compressed = true
    low = clampClicks(starting - 5)
    high = clampClicks(starting + 5)
  }

  const nextGrind = buildDerivedGrindSettings(recipe, low, high, starting)

  return {
    ...recipe,
    grind: nextGrind,
    range_logic: {
      ...recipe.range_logic,
      base_range: `${methodBase.low}–${methodBase.high} clicks (${methodBase.label})`,
      process_offset: `${bean.process} (${processDelta >= 0 ? '+' : ''}${processDelta} clicks)`,
      roast_offset: `${roastDelta >= 0 ? '+' : ''}${roastDelta} clicks`,
      freshness_offset: `${freshness.clicks >= 0 ? '+' : ''}${freshness.clicks} clicks (${freshness.label})`,
      density_offset: `${altitudeDelta >= 0 ? '+' : ''}${altitudeDelta} (altitude) + ${varietyDelta >= 0 ? '+' : ''}${varietyDelta} (variety) + ${originDelta >= 0 ? '+' : ''}${originDelta} (origin)`,
      final_operating_range: `${low}–${high} clicks`,
      compressed,
      starting_point: nextGrind.k_ultra.starting_point,
    },
  }
}
