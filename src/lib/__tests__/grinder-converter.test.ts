import { describe, it, expect } from 'vitest'
import {
  kUltraClicksToMicrons,
  kUltraRangeToQAir,
  kUltraRangeToBaratza,
  kUltraRangeToTimemoreC2,
  parseKUltraRange,
  parseGrinderValueForEdit,
  grinderValueToKUltraClicks,
  kUltraClicksToGrinderValue,
  parseGrinderRange,
  micronsToKUltraClicks,
} from '../grinder-converter'

// ─── kUltraClicksToMicrons ────────────────────────────────────────────────────

describe('kUltraClicksToMicrons', () => {
  it('returns table anchor values exactly', () => {
    expect(kUltraClicksToMicrons(40)).toBe(440)
    expect(kUltraClicksToMicrons(80)).toBe(880)
    expect(kUltraClicksToMicrons(100)).toBe(1100)
    expect(kUltraClicksToMicrons(120)).toBe(1320)
  })

  it('interpolates between anchor points', () => {
    // Between 80 (880µm) and 81 (891µm): midpoint 80.5 → 885.5 → rounded to 886
    expect(kUltraClicksToMicrons(80.5)).toBe(886)
  })

  it('clamps below minimum table entry', () => {
    expect(kUltraClicksToMicrons(10)).toBe(440)
  })

  it('clamps above maximum table entry', () => {
    expect(kUltraClicksToMicrons(200)).toBe(1320)
  })
})

// ─── parseKUltraRange ─────────────────────────────────────────────────────────

describe('parseKUltraRange', () => {
  it('parses en-dash format', () => {
    expect(parseKUltraRange('81–84 clicks')).toEqual({ low: 81, high: 84, mid: 83 })
  })

  it('parses hyphen format', () => {
    expect(parseKUltraRange('78-82 clicks')).toEqual({ low: 78, high: 82, mid: 80 })
  })

  it('computes mid as round((low+high)/2)', () => {
    // 80+85=165/2=82.5 → rounded to 83
    expect(parseKUltraRange('80–85 clicks')?.mid).toBe(83)
    // 80+84=164/2=82 → 82
    expect(parseKUltraRange('80–84 clicks')?.mid).toBe(82)
  })

  it('returns null for invalid string', () => {
    expect(parseKUltraRange('no numbers here')).toBeNull()
    expect(parseKUltraRange('')).toBeNull()
  })
})

// ─── kUltraRangeToQAir ───────────────────────────────────────────────────────

describe('kUltraRangeToQAir', () => {
  it('returns R.C.M formatted strings', () => {
    const result = kUltraRangeToQAir(80, 85, 82)
    // Just check format is R.C.M (three dot-separated integers)
    expect(result.range).toMatch(/^\d+\.\d+\.\d+–\d+\.\d+\.\d+$/)
    expect(result.starting_point).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('lower clicks produce lower Q-Air setting', () => {
    const fine = kUltraRangeToQAir(60, 65, 62)
    const coarse = kUltraRangeToQAir(90, 95, 92)
    // Parse first number (rotations) from starting_point
    const fineR = parseInt(fine.starting_point.split('.')[0])
    const coarseR = parseInt(coarse.starting_point.split('.')[0])
    expect(fineR).toBeLessThan(coarseR)
  })
})

// ─── kUltraRangeToBaratza ────────────────────────────────────────────────────

describe('kUltraRangeToBaratza', () => {
  it('produces output in pour-over zone 14–24 for v60', () => {
    const result = kUltraRangeToBaratza(80, 86, 82, 'v60')
    const start = parseInt(result.starting_point)
    expect(start).toBeGreaterThanOrEqual(14)
    expect(start).toBeLessThanOrEqual(24)
  })

  it('clamps very fine grind to minimum 14 for pour-over', () => {
    // clicks 40 → 440µm → Baratza ~10 clicks → clamped to 14
    const result = kUltraRangeToBaratza(40, 45, 42, 'v60')
    const start = parseInt(result.starting_point)
    expect(start).toBe(14)
    expect(result.note).toContain('boundary')
  })

  it('does not clamp for aeropress (non-pour-over)', () => {
    // clicks 40 → 440µm → Baratza ~10 clicks — no clamping
    const result = kUltraRangeToBaratza(40, 45, 42, 'aeropress')
    const start = parseInt(result.starting_point)
    expect(start).toBeLessThan(14)
  })

  it('formats range as "clicks X–Y"', () => {
    const result = kUltraRangeToBaratza(80, 86, 82, 'v60')
    expect(result.range).toMatch(/^clicks \d+–\d+$/)
  })
})

// ─── kUltraRangeToTimemoreC2 ─────────────────────────────────────────────────

describe('kUltraRangeToTimemoreC2', () => {
  it('produces output in pour-over zone 14–22 for origami', () => {
    const result = kUltraRangeToTimemoreC2(80, 86, 82, 'origami')
    const start = parseInt(result.starting_point)
    expect(start).toBeGreaterThanOrEqual(14)
    expect(start).toBeLessThanOrEqual(22)
  })

  it('clamps very fine grind to minimum 14 for pour-over', () => {
    const result = kUltraRangeToTimemoreC2(40, 45, 42, 'kalita_wave')
    const start = parseInt(result.starting_point)
    expect(start).toBe(14)
  })

  it('does not apply boundary note for aeropress', () => {
    // Aeropress is not a pour-over method — no zone clamping logic is applied
    const result = kUltraRangeToTimemoreC2(40, 45, 42, 'aeropress')
    expect(result.note).not.toContain('boundary')
    expect(result.note).not.toContain('pour-over zone')
  })
})

// ─── parseGrinderValueForEdit ─────────────────────────────────────────────────

describe('parseGrinderValueForEdit', () => {
  it('extracts clicks from k_ultra starting_point string', () => {
    expect(parseGrinderValueForEdit('k_ultra', '82 clicks')).toBe(82)
    expect(parseGrinderValueForEdit('k_ultra', 'click 95')).toBe(95)
  })

  it('converts Q-Air R.C.M to total Q-Air clicks (R*10 + C)', () => {
    // "2.5.0" → R=2, C=5 → 2*10+5 = 25
    expect(parseGrinderValueForEdit('q_air', '2.5.0')).toBe(25)
    // "3.2.1" → 32
    expect(parseGrinderValueForEdit('q_air', '3.2.1')).toBe(32)
  })

  it('extracts clicks for baratza and timemore', () => {
    expect(parseGrinderValueForEdit('baratza_encore_esp', '18 clicks')).toBe(18)
    expect(parseGrinderValueForEdit('timemore_c2', '17 clicks')).toBe(17)
  })
})

// ─── kUltraClicksToGrinderValue ──────────────────────────────────────────────

describe('kUltraClicksToGrinderValue', () => {
  it('returns identity for k_ultra', () => {
    expect(kUltraClicksToGrinderValue('k_ultra', 82)).toBe(82)
  })

  it('returns an integer for all grinder types', () => {
    const clicks = 82
    expect(Number.isInteger(kUltraClicksToGrinderValue('k_ultra', clicks))).toBe(true)
    expect(Number.isInteger(kUltraClicksToGrinderValue('q_air', clicks))).toBe(true)
    expect(Number.isInteger(kUltraClicksToGrinderValue('baratza_encore_esp', clicks))).toBe(true)
    expect(Number.isInteger(kUltraClicksToGrinderValue('timemore_c2', clicks))).toBe(true)
  })
})

// ─── grinderValueToKUltraClicks ───────────────────────────────────────────────

describe('grinderValueToKUltraClicks', () => {
  it('returns identity for k_ultra', () => {
    expect(grinderValueToKUltraClicks('k_ultra', 82)).toBe(82)
  })

  it('round-trips k_ultra → baratza → k_ultra within ±5 clicks', () => {
    const originalClicks = 82
    const baratzaVal = kUltraClicksToGrinderValue('baratza_encore_esp', originalClicks)
    const backToKUltra = grinderValueToKUltraClicks('baratza_encore_esp', baratzaVal)
    expect(Math.abs(backToKUltra - originalClicks)).toBeLessThanOrEqual(5)
  })

  it('round-trips k_ultra → timemore_c2 → k_ultra within ±5 clicks', () => {
    const originalClicks = 82
    const c2Val = kUltraClicksToGrinderValue('timemore_c2', originalClicks)
    const backToKUltra = grinderValueToKUltraClicks('timemore_c2', c2Val)
    expect(Math.abs(backToKUltra - originalClicks)).toBeLessThanOrEqual(5)
  })
})

// ─── micronsToKUltraClicks ───────────────────────────────────────────────────

describe('micronsToKUltraClicks', () => {
  it('is the approximate inverse of kUltraClicksToMicrons', () => {
    // For exact table anchor points, the inverse should be exact
    expect(micronsToKUltraClicks(440)).toBe(40)
    expect(micronsToKUltraClicks(880)).toBe(80)
    expect(micronsToKUltraClicks(1100)).toBe(100)
  })
})

// ─── parseGrinderRange ────────────────────────────────────────────────────────

describe('parseGrinderRange', () => {
  it('returns null for invalid range string', () => {
    expect(parseGrinderRange('k_ultra', 'invalid')).toBeNull()
  })

  it('returns low and high in k_ultra clicks for k_ultra grinder', () => {
    const result = parseGrinderRange('k_ultra', '81–84 clicks')
    expect(result).toEqual({ low: 81, high: 84 })
  })

  it('returns low and high in baratza clicks for baratza grinder', () => {
    const result = parseGrinderRange('baratza_encore_esp', '81–84 clicks')
    expect(result).not.toBeNull()
    expect(result!.low).toBeLessThanOrEqual(result!.high)
  })
})
