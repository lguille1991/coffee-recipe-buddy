import { describe, expect, it } from 'vitest'
import { parseCoffeeBagOcr } from '../deterministic-ocr-parser'

describe('parseCoffeeBagOcr', () => {
  it('parses explicitly labelled English and Spanish fields with token-derived confidence', () => {
    const result = parseCoffeeBagOcr([
      { text: 'Origin: Colombia', confidence: 92 },
      { text: 'Proceso', confidence: 0.8 },
      { text: 'Lavado', confidence: 0.75 },
      { text: 'Nivel de tueste: Medio claro', confidence: 0.66 },
      { text: 'Altitud: 1,800–1,900 msnm', confidence: 87 },
      { text: 'Notas: panela, naranja / floral', confidence: 0.55 },
    ])

    expect(result).toEqual({
      bean: {
        origin: 'Colombia',
        process: 'washed',
        roast_level: 'medium-light',
        altitude_masl: 1850,
        tasting_notes: ['panela', 'naranja', 'floral'],
      },
      confidence: {
        origin: 0.92,
        process: 0.75,
        roast_level: 0.66,
        altitude_masl: 0.87,
        tasting_notes: 0.55,
      },
      status: 'complete',
      warnings: [],
    })
  })

  it('does not infer values from unlabelled prose and reports an empty result', () => {
    const result = parseCoffeeBagOcr([
      { text: 'A bright, natural coffee with jasmine and peach notes.', confidence: 0.99 },
      { text: 'Origin stories are part of every coffee bag.', confidence: 0.99 },
    ])

    expect(result.bean).toEqual({ process: 'unknown', roast_level: 'unknown' })
    expect(result.status).toBe('empty')
    expect(result.warnings).toHaveLength(1)
  })

  it('normalizes accents, preserves a zero confidence score, and reports partial results', () => {
    const result = parseCoffeeBagOcr([
      { text: 'PROCESO: Anaeróbico', confidence: 0 },
      { text: 'Origen', confidence: 41 },
      { text: 'El Salvador', confidence: 0.4 },
    ])

    expect(result).toMatchObject({
      bean: { process: 'anaerobic', roast_level: 'unknown', origin: 'El Salvador' },
      confidence: { process: 0, origin: 0.4 },
      status: 'partial',
    })
  })
})
