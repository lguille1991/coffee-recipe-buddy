import type { BeanProfile, Recipe } from '@/types/recipe'
import { buildDerivedGrindSettings } from '@/lib/grind-settings'

interface MethodBaseRange {
  low: number
  high: number
  label: string
}

const CLICK_UNIT = 1

const METHOD_BASE_RANGES: Record<string, MethodBaseRange> = {
  v60: { low: 53, high: 92, label: 'V60 base (0.5.3–0.9.2)' },
  origami: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  orea_v4: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  hario_switch: { low: 60, high: 100, label: 'Steep-and-release base (0.6.0–1.0.0)' },
  kalita_wave: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  chemex: { low: 70, high: 100, label: 'Chemex-leaning coarse base' },
  ceado_hoop: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  pulsar: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  aeropress: { low: 43, high: 100, label: 'AeroPress base (0.4.3–1.0.0)' },
}

function clampClicks(value: number): number {
  return Math.max(40, Math.min(100, value))
}

function normalizeVariety(variety?: string | null): string {
  return (variety ?? '').trim().toLowerCase()
}

function normalizeOrigin(origin?: string | null): string {
  return (origin ?? '').trim().toLowerCase()
}

function processOffset(process: BeanProfile['process']): number {
  switch (process) {
    case 'natural':
      return 2 * CLICK_UNIT
    case 'honey':
      return 1 * CLICK_UNIT
    case 'anaerobic':
      return 3 * CLICK_UNIT
    case 'washed':
    case 'unknown':
    default:
      return 0
  }
}

function roastOffset(roast: BeanProfile['roast_level']): number {
  switch (roast) {
    case 'light':
      return -1 * CLICK_UNIT
    case 'medium-light':
      return 0
    case 'medium-dark':
      return 1 * CLICK_UNIT
    case 'dark':
      return 2 * CLICK_UNIT
    case 'medium':
    default:
      return 0
  }
}

function altitudeOffset(altitudeMasl?: number | null): number {
  if (!altitudeMasl) return 0
  if (altitudeMasl >= 1200) return -1 * CLICK_UNIT
  if (altitudeMasl < 800) return 1 * CLICK_UNIT
  return 0
}

function originOffset(origin?: string | null): number {
  const normalized = normalizeOrigin(origin)
  if (!normalized) return 0

  if (/\b(?:brazil|cerrado)\b/.test(normalized)) return 1 * CLICK_UNIT
  if (/\b(?:ethiopia|yirgacheffe|sidamo)\b/.test(normalized)) return -1 * CLICK_UNIT
  return 0
}

function varietyOffset(variety?: string | null): number {
  const normalized = normalizeVariety(variety)
  if (!normalized) return 0

  if (/\bpacamara|maragogipe\b/.test(normalized)) return 1 * CLICK_UNIT
  if (/\bgesha|geisha|heirloom\b/.test(normalized)) return -1 * CLICK_UNIT
  return 0
}

export function applySkillGrindSettings(
  recipe: Recipe,
  bean: BeanProfile,
): Recipe {
  const methodBase = METHOD_BASE_RANGES[recipe.method] ?? METHOD_BASE_RANGES.v60
  const processDelta = processOffset(bean.process)
  const altitudeDelta = altitudeOffset(bean.altitude_masl)
  const roastDelta = roastOffset(bean.roast_level)
  const varietyDelta = varietyOffset(bean.variety)
  const originDelta = originOffset(bean.origin)

  const totalDelta = processDelta + altitudeDelta + roastDelta + varietyDelta + originDelta

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
      freshness_offset: '0 clicks',
      density_offset: `${altitudeDelta >= 0 ? '+' : ''}${altitudeDelta} (altitude) + ${varietyDelta >= 0 ? '+' : ''}${varietyDelta} (variety) + ${originDelta >= 0 ? '+' : ''}${originDelta} (origin)`,
      final_operating_range: `${low}–${high} clicks`,
      compressed,
      starting_point: nextGrind.k_ultra.starting_point,
    },
  }
}
