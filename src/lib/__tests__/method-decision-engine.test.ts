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
      expect(['high', 'medium', 'low']).toContain(r.confidence)
      expect(Array.isArray(r.reasonBadges)).toBe(true)
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

  it('anaerobic bean still prioritizes low-agitation brewers in top recommendation', () => {
    const results = recommendMethods(ANAEROBIC_BEAN)
    const methods = results.map(r => r.method)
    expect(['hario_switch', 'aeropress', 'pulsar']).toContain(results[0].method)
    expect(methods.some(method => ['hario_switch', 'aeropress', 'pulsar'].includes(method))).toBe(true)
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

  it('normalizes geisha spelling variants into the same recommendation result', () => {
    const base: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      tasting_notes: ['jasmine', 'black tea'],
    }

    const geshaResults = recommendMethods({ ...base, variety: 'Gesha' })
    const geishaResults = recommendMethods({ ...base, variety: 'Geisha' })

    expect(geshaResults.map(result => result.method)).toEqual(geishaResults.map(result => result.method))
  })

  it('treats tea-like floral coffees as clarity-first instead of generic naturals', () => {
    const teaLikeNatural: BeanProfile = {
      process: 'natural',
      roast_level: 'medium-light',
      variety: 'SL28',
      tasting_notes: ['green tea', 'floral', 'grapefruit', 'pear'],
      altitude_masl: 1550,
    }

    const results = recommendMethods(teaLikeNatural)
    expect(results[0].method).toBe('v60')
    expect(results[0].reasonBadges).toContain('tea-like')
  })

  it('uses origin pairing rules for ethiopian coffees', () => {
    const ethiopianBean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      origin: 'Ethiopia Yirgacheffe',
      tasting_notes: ['jasmine', 'lemon', 'black tea'],
    }

    const results = recommendMethods(ethiopianBean)
    expect(results[0].method).toBe('v60')
    expect(results.map(result => result.method).some(method => ['origami', 'orea_v4', 'chemex'].includes(method))).toBe(true)
  })

  it('uses origin pairing rules for brazilian coffees toward fuller-body brewers', () => {
    const brazilBean: BeanProfile = {
      process: 'natural',
      roast_level: 'medium-dark',
      origin: 'Brazil Cerrado',
      tasting_notes: ['chocolate', 'caramel', 'body'],
    }

    const results = recommendMethods(brazilBean)
    const methods = results.map(r => r.method)
    expect(methods).toContain('ceado_hoop')
    expect(methods.some(method => ['hario_switch', 'aeropress'].includes(method))).toBe(true)
  })

  it('does not apply origin-specific pairing boosts for unknown origin strings', () => {
    const unknownOriginBean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      origin: 'N/A',
      tasting_notes: ['jasmine', 'citrus'],
    }

    const noOriginBean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      tasting_notes: ['jasmine', 'citrus'],
    }

    const unknownOriginResults = recommendMethods(unknownOriginBean)
    const noOriginResults = recommendMethods(noOriginBean)

    expect(unknownOriginResults.map(result => result.method)).toEqual(
      noOriginResults.map(result => result.method),
    )
  })

  it('fresh coffees tilt toward forgiving brewers', () => {
    const freshBean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      roast_date: '2026-04-09',
      tasting_notes: ['citrus', 'floral'],
    }

    const results = recommendMethods(freshBean, { now: new Date('2026-04-12T12:00:00Z') })
    expect(results.map(result => result.method)).toContain('kalita_wave')
    expect(results[0].method).not.toBe('origami')
  })

  it('respects a body-focused brew goal', () => {
    const goalDrivenBean: BeanProfile = {
      process: 'washed',
      roast_level: 'light',
      tasting_notes: ['jasmine', 'orange'],
    }

    const results = recommendMethods(goalDrivenBean, { brewGoal: 'body' })
    expect(results.map(result => result.method)).toContain('hario_switch')
  })

  it('downgrades confidence when scan metadata is weak', () => {
    const lowConfidenceBean: BeanProfile = {
      process: 'unknown',
      roast_level: 'medium',
    }

    const results = recommendMethods(lowConfidenceBean, {
      source: 'scan',
      extractionConfidence: {
        process: 0.35,
        roast_level: 0.45,
        variety: 0.2,
      },
    })

    expect(results[0].confidence).toBe('low')
    expect(results[0].confidenceNote).toBeTruthy()
    expect(results.map(result => result.method)).toContain('kalita_wave')
  })

  it('no duplicate methods in top-3', () => {
    const results = recommendMethods(WASHED_LIGHT_BEAN)
    const methods = results.map(r => r.method)
    const unique = new Set(methods)
    expect(unique.size).toBe(3)
  })
})
