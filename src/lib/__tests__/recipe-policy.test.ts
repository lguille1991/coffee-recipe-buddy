import { describe, expect, it } from 'vitest'
import { BASE_RECIPE } from './fixtures'
import {
  formatClickOffset,
  getMethodRatioBounds,
  inferRangeLogicContext,
  parseClickOffset,
} from '../recipe-policy'

describe('recipe policy helpers', () => {
  it('returns shared method ratio bounds for known methods', () => {
    expect(getMethodRatioBounds('v60')).toEqual({ low: 15, high: 17 })
    expect(getMethodRatioBounds('Hario Switch')).toEqual({ low: 13, high: 16 })
  })

  it('falls back to default ratio bounds for unknown methods', () => {
    expect(getMethodRatioBounds('custom')).toEqual({ low: 13, high: 17 })
  })

  it('parses and formats click offsets consistently', () => {
    expect(parseClickOffset('+2 clicks')).toBe(2)
    expect(parseClickOffset('-1 click')).toBe(-1)
    expect(formatClickOffset(2)).toBe('+2 clicks')
    expect(formatClickOffset(0)).toBe('0 clicks')
  })

  it('infers range-logic context from offset strings in one place', () => {
    const context = inferRangeLogicContext({
      ...BASE_RECIPE.range_logic,
      process_offset: '+3 clicks',
      roast_offset: '-1 click',
      freshness_offset: '+2 clicks',
    })

    expect(context).toMatchObject({
      isNatural: true,
      isAnaerobic: false,
      isLightRoast: true,
      isVeryFresh: true,
    })
  })
})
