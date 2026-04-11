import type { Recipe } from '@/types/recipe'
import {
  kUltraRangeToBaratza,
  kUltraRangeToQAir,
  kUltraRangeToTimemoreC2,
} from './grinder-converter'

type SecondaryGrindSettings = Pick<
  Recipe['grind'],
  'q_air' | 'baratza_encore_esp' | 'timemore_c2'
>

export function parseClickCount(value: string, fallback: number | null = null): number | null {
  const match = value.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : fallback
}

export function deriveSecondaryGrindSettings(
  method: string,
  lowClicks: number,
  highClicks: number,
  startingClicks: number,
): SecondaryGrindSettings {
  const qAir = kUltraRangeToQAir(lowClicks, highClicks, startingClicks)
  const baratza = kUltraRangeToBaratza(lowClicks, highClicks, startingClicks, method)
  const timemore = kUltraRangeToTimemoreC2(lowClicks, highClicks, startingClicks, method)

  return {
    q_air: qAir,
    baratza_encore_esp: baratza,
    timemore_c2: timemore,
  }
}

export function buildDerivedGrindSettings(
  recipe: Pick<Recipe, 'grind' | 'method'>,
  lowClicks: number,
  highClicks: number,
  startingClicks: number,
): Recipe['grind'] {
  const secondary = deriveSecondaryGrindSettings(
    recipe.method,
    lowClicks,
    highClicks,
    startingClicks,
  )

  return {
    k_ultra: {
      ...recipe.grind.k_ultra,
      range: `${lowClicks}–${highClicks} clicks`,
      starting_point: `${startingClicks} clicks`,
    },
    q_air: {
      ...recipe.grind.q_air,
      ...secondary.q_air,
    },
    baratza_encore_esp: {
      ...recipe.grind.baratza_encore_esp,
      ...secondary.baratza_encore_esp,
    },
    timemore_c2: {
      ...recipe.grind.timemore_c2,
      ...secondary.timemore_c2,
    },
  }
}
