import type { MethodId, Recipe } from '@/types/recipe'

type MethodRatioBounds = { low: number; high: number }
export type RangeLogicContext = {
  processOffsetClicks: number
  roastOffsetClicks: number
  freshnessOffsetClicks: number
  isNatural: boolean
  isAnaerobic: boolean
  isLightRoast: boolean
  isVeryFresh: boolean
}

export const METHOD_RATIO_BOUNDS: Record<MethodId, MethodRatioBounds> = {
  v60: { low: 15, high: 17 },
  origami: { low: 15, high: 17 },
  orea_v4: { low: 15, high: 17 },
  hario_switch: { low: 13, high: 16 },
  kalita_wave: { low: 15, high: 17 },
  chemex: { low: 15, high: 17 },
  ceado_hoop: { low: 14, high: 16 },
  pulsar: { low: 14, high: 16 },
  aeropress: { low: 11, high: 16 },
}

const DEFAULT_METHOD_RATIO_BOUNDS: MethodRatioBounds = { low: 13, high: 17 }

export function getMethodRatioBounds(method: string): MethodRatioBounds {
  const normalized = method.toLowerCase().replace(/\s+/g, '_') as MethodId
  return METHOD_RATIO_BOUNDS[normalized] ?? DEFAULT_METHOD_RATIO_BOUNDS
}

export function parseClickOffset(offset: string): number {
  const match = offset.match(/([+-]?\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

export function formatClickOffset(clicks: number): string {
  if (clicks > 0) return `+${clicks} clicks`
  if (clicks < 0) return `${clicks} clicks`
  return '0 clicks'
}

export function inferRangeLogicContext(rangeLogic: Recipe['range_logic']): RangeLogicContext {
  const processOffset = parseClickOffset(rangeLogic.process_offset)
  const roastOffset = parseClickOffset(rangeLogic.roast_offset)
  const freshnessOffset = parseClickOffset(rangeLogic.freshness_offset)

  const processText = rangeLogic.process_offset.toLowerCase()
  const roastText = rangeLogic.roast_offset.toLowerCase()
  const freshnessText = rangeLogic.freshness_offset.toLowerCase()

  return {
    processOffsetClicks: processOffset,
    roastOffsetClicks: roastOffset,
    freshnessOffsetClicks: freshnessOffset,
    isNatural:
      processText.includes('natural') ||
      (processOffset >= 2 && processOffset <= 4),
    isAnaerobic:
      processText.includes('anaerobic') ||
      processOffset >= 5,
    isLightRoast:
      roastText.includes('light') ||
      roastOffset <= -1,
    isVeryFresh:
      freshnessText.includes('fresh') ||
      freshnessOffset >= 2,
  }
}
