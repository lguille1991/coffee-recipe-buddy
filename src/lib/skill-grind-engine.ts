import type { BeanProfile, Recipe } from '@/types/recipe'
import { buildDerivedGrindSettings } from '@/lib/grind-settings'
import {
  getMethodGrindBase,
  grindAltitudeOffset,
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
  strictParityMode?: boolean
  parityMode?: 'legacy' | 'skill_v2'
}

interface Range {
  low: number
  high: number
  label: string
}

const SKILL_V2_METHOD_BASES: Record<string, Range> = {
  v60: { low: 72, high: 79, label: 'Skill v2 V60 base' },
  origami: { low: 72, high: 79, label: 'Skill v2 Origami base' },
  orea_v4: { low: 71, high: 78, label: 'Skill v2 Orea V4 base' },
  hario_switch: { low: 75, high: 82, label: 'Skill v2 Hario Switch base' },
  kalita_wave: { low: 76, high: 82, label: 'Skill v2 Kalita Wave base' },
  chemex: { low: 78, high: 84, label: 'Skill v2 Chemex base' },
  ceado_hoop: { low: 76, high: 83, label: 'Skill v2 Ceado Hoop base' },
  pulsar: { low: 73, high: 80, label: 'Skill v2 Pulsar base' },
  aeropress: { low: 66, high: 76, label: 'Skill v2 AeroPress base' },
}

function isFloralDescriptor(value: string): boolean {
  return /\b(floral|citrus|tea|bergamot|jasmine|orange|lemon)\b/i.test(value)
}

function applySkillV2DensityOffset(bean: BeanProfile): { clicks: number; label: string } {
  const altitude = bean.altitude_masl
  const variety = (bean.variety ?? '').toLowerCase()

  const altitudeOffset = (() => {
    if (!altitude) return 0
    if (altitude >= 1400) return -1
    if (altitude < 1000) return 1
    return 0
  })()

  const varietyOffset = (() => {
    if (!variety) return 0
    if (/\bgesha|geisha|heirloom\b/.test(variety)) return -1
    if (/\bpacamara|maragogipe|catimor|robusta\b/.test(variety)) return 1
    return 0
  })()

  if (altitudeOffset === 0 && varietyOffset === 0) {
    return { clicks: 0, label: '0 (aligned density neutral)' }
  }

  if (altitudeOffset !== 0 && varietyOffset !== 0) {
    if (Math.sign(altitudeOffset) === Math.sign(varietyOffset)) {
      return { clicks: altitudeOffset, label: `${altitudeOffset >= 0 ? '+' : ''}${altitudeOffset} (aligned altitude+variety)` }
    }
    return { clicks: 0, label: '0 (altitude/variety canceled)' }
  }

  const single = altitudeOffset !== 0 ? altitudeOffset : varietyOffset
  return { clicks: single, label: `${single >= 0 ? '+' : ''}${single} (single density factor)` }
}

function applyPriorityDelta(current: number, delta: number): number {
  if (delta === 0 || current === 0) return current + delta
  if (Math.sign(current) === Math.sign(delta)) return current + delta
  // Lower-priority deltas are allowed to moderate, but not invert, higher-priority direction.
  if (Math.abs(delta) >= Math.abs(current)) return 0
  return current + delta
}

export function applySkillGrindSettings(
  recipe: Recipe,
  bean: BeanProfile,
  options: GrindOptions = {},
): Recipe {
  const strictParityMode = options.strictParityMode ?? false
  const parityMode = options.parityMode ?? 'legacy'

  if (parityMode === 'skill_v2') {
    const methodBase = SKILL_V2_METHOD_BASES[recipe.method] ?? SKILL_V2_METHOD_BASES.v60
    const processDelta = grindProcessOffset(bean.process)
    const roastDelta = grindRoastOffset(bean.roast_level)
    const freshness = freshnessOffset(bean.roast_date, options.now)
    const density = applySkillV2DensityOffset(bean)
    const notes = bean.tasting_notes ?? []

    const isWashedFloral =
      bean.process === 'washed'
      && (bean.roast_level === 'light' || bean.roast_level === 'medium-light')
      && (bean.altitude_masl ?? 0) >= 1300
      && notes.some(isFloralDescriptor)

    const freshnessDelta = (() => {
      if (!isWashedFloral) return freshness.clicks
      if (!bean.roast_date) return Math.min(1, freshness.clicks)
      const roast = new Date(bean.roast_date)
      if (Number.isNaN(roast.getTime())) return Math.min(1, freshness.clicks)
      const ageDays = Math.floor(((options.now ?? new Date()).getTime() - roast.getTime()) / (24 * 60 * 60 * 1000))
      if (ageDays < 4) return freshness.clicks
      return Math.min(1, freshness.clicks)
    })()

    const floralGuardrail = isWashedFloral ? -1 : 0
    const densityDelta = density.clicks + floralGuardrail
    const processAndFreshness = applyPriorityDelta(processDelta, freshnessDelta)
    const withRoast = applyPriorityDelta(processAndFreshness, roastDelta)
    const totalDelta = applyPriorityDelta(withRoast, densityDelta)

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
        freshness_offset: `${freshnessDelta >= 0 ? '+' : ''}${freshnessDelta} clicks (${freshness.label})`,
        density_offset: density.label,
        final_operating_range: `${low}–${high} clicks`,
        compressed,
        starting_point: nextGrind.k_ultra.starting_point,
      },
    }
  }

  const methodBase = getMethodGrindBase(recipe.method, strictParityMode)
  const processDelta = grindProcessOffset(bean.process)
  const altitudeDelta = grindAltitudeOffset(bean.altitude_masl)
  const roastDelta = grindRoastOffset(bean.roast_level)
  const varietyDelta = grindVarietyOffset(bean.variety)
  const freshness = freshnessOffset(bean.roast_date, options.now)

  const totalDelta = processDelta + altitudeDelta + roastDelta + varietyDelta + freshness.clicks

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
      density_offset: `${altitudeDelta >= 0 ? '+' : ''}${altitudeDelta} (altitude) + ${varietyDelta >= 0 ? '+' : ''}${varietyDelta} (variety)`,
      final_operating_range: `${low}–${high} clicks`,
      compressed,
      starting_point: nextGrind.k_ultra.starting_point,
    },
  }
}
