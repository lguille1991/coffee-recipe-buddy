import { describe, it, expect } from 'vitest'
import { recommendMethods } from '../method-decision-engine'
import { WASHED_LIGHT_BEAN, NATURAL_MEDIUM_BEAN, ANAEROBIC_BEAN } from './fixtures'
import type { BeanProfile } from '@/types/recipe'

describe('recommendMethods', () => {
  it('always returns exactly 3 recommendations', () => {
    expect(recommendMethods(WASHED_LIGHT_BEAN)).toHaveLength(3)
    expect(recommendMethods(NATURAL_MEDIUM_BEAN)).toHaveLength(3)
    expect(recommendMethods(ANAEROBIC_BEAN)).toHaveLength(3)
  })

  it('assigns ranks 1, 2, 3 in order', () => {
    const results = recommendMethods(WASHED_LIGHT_BEAN)
    expect(results.map(r => r.rank)).toEqual([1, 2, 3])
  })

  it('results are sorted by descending score', () => {
    const results = recommendMethods(WASHED_LIGHT_BEAN)
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
    expect(results[1].score).toBeGreaterThanOrEqual(results[2].score)
  })

  it('all recommendations include method, displayName, score, and rationale', () => {
    const results = recommendMethods(WASHED_LIGHT_BEAN)
    for (const r of results) {
      expect(r.method).toBeTruthy()
      expect(r.displayName).toBeTruthy()
      expect(typeof r.score).toBe('number')
      expect(r.rationale).toBeTruthy()
    }
  })

  it('washed light bean ranks v60/origami/orea_v4 in top-3', () => {
    const results = recommendMethods(WASHED_LIGHT_BEAN)
    const methods = results.map(r => r.method)
    const clarityMethods = ['v60', 'origami', 'orea_v4']
    const hasClarity = methods.some(m => clarityMethods.includes(m))
    expect(hasClarity).toBe(true)
  })

  it('natural medium bean ranks hario_switch or kalita_wave in top-3', () => {
    const results = recommendMethods(NATURAL_MEDIUM_BEAN)
    const methods = results.map(r => r.method)
    const naturalFriendly = ['hario_switch', 'kalita_wave', 'pulsar']
    const hasNaturalFriendly = methods.some(m => naturalFriendly.includes(m))
    expect(hasNaturalFriendly).toBe(true)
  })

  it('anaerobic bean avoids v60 and origami in top recommendation', () => {
    const results = recommendMethods(ANAEROBIC_BEAN)
    // v60 and origami get -2 from anaerobic process rule, should not be rank 1
    expect(results[0].method).not.toBe('v60')
    expect(results[0].method).not.toBe('origami')
  })

  it('high-altitude anaerobic dark bean has pulsar or aeropress in top-3', () => {
    // anaerobic: pulsar +3, aeropress +3; dark: aeropress +2; altitude 2000: pulsar +1, aeropress +1
    // → aeropress=6, pulsar=4 — both clearly in top-3
    const highAltitudeBean: BeanProfile = {
      process: 'anaerobic',
      roast_level: 'dark',
      altitude_masl: 2000,
    }
    const results = recommendMethods(highAltitudeBean)
    const methods = results.map(r => r.method)
    const altitudeBoosted = ['pulsar', 'aeropress']
    const hasAltitudeBoosted = methods.some(m => altitudeBoosted.includes(m))
    expect(hasAltitudeBoosted).toBe(true)
  })

  it('floral notes boost v60/origami/orea_v4', () => {
    const floralBean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      tasting_notes: ['jasmine', 'floral'],
    }
    const results = recommendMethods(floralBean)
    const methods = results.map(r => r.method)
    const floralFriendly = ['v60', 'origami', 'orea_v4']
    const hasFloral = methods.some(m => floralFriendly.includes(m))
    expect(hasFloral).toBe(true)
  })

  it('exotic variety (gesha) boosts v60/origami/orea_v4', () => {
    const geshaBean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      variety: 'Gesha',
    }
    const results = recommendMethods(geshaBean)
    const methods = results.map(r => r.method)
    const geshaFriendly = ['v60', 'origami', 'orea_v4']
    const hasGesha = methods.some(m => geshaFriendly.includes(m))
    expect(hasGesha).toBe(true)
  })

  it('no duplicate methods in top-3', () => {
    const results = recommendMethods(WASHED_LIGHT_BEAN)
    const methods = results.map(r => r.method)
    const unique = new Set(methods)
    expect(unique.size).toBe(3)
  })
})
