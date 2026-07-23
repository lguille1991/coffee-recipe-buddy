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

  it('parses the explicit Spanish layout labels and recognized compact identity on the Pacamara Yellow Honey bag', () => {
    const result = parseCoffeeBagOcr([
      { text: 'D’LA PALMA', confidence: 0.99 },
      { text: 'Cultivado a: 1850 msnm', confidence: 0.95 },
      { text: 'Finca Machuca', confidence: 0.93 },
      { text: 'Pacamara Yellow Honey', confidence: 0.99 },
      { text: 'Productor', confidence: 0.91 },
      { text: 'Orlando Aguilar', confidence: 0.92 },
      { text: 'Notas: toffee, chocolate y frutos amarillos', confidence: 0.88 },
    ])

    expect(result).toMatchObject({
      bean: {
        altitude_masl: 1850,
        finca: 'Machuca',
        producer: 'Orlando Aguilar',
        tasting_notes: ['toffee', 'chocolate y frutos amarillos'],
        variety: 'Pacamara',
        process: 'honey',
        roast_level: 'unknown',
      },
      status: 'partial',
    })
    expect(result.bean.roaster).toBeUndefined()
  })

  it('parses supported labelled fields and compact variety/process identities from the supplied bag corpus', () => {
    const result = parseCoffeeBagOcr([
      { text: 'Geisha Natural', confidence: 0.94 },
      { text: 'Altitud: 1550 msnm', confidence: 0.95 },
      { text: 'Región: Apaneca, Ilamatepec, Santa Ana', confidence: 0.92 },
      { text: 'Tueste: Medio', confidence: 0.91 },
      { text: 'Perfil: Toronja, Pera, Te verde, Caramelo', confidence: 0.9 },
    ])

    expect(result).toMatchObject({
      bean: {
        variety: 'Geisha',
        process: 'natural',
        altitude_masl: 1550,
        origin: 'Apaneca, Ilamatepec, Santa Ana',
        roast_level: 'medium',
        tasting_notes: ['Toronja', 'Pera', 'Te verde', 'Caramelo'],
      },
      status: 'complete',
    })
  })

  it('extracts a compact process without guessing an ambiguous neighboring value', () => {
    const result = parseCoffeeBagOcr([{ text: 'Minas - Washed', confidence: 0.9 }])

    expect(result.bean).toEqual({ process: 'washed', roast_level: 'unknown' })
    expect(result.confidence).toEqual({ process: 0.9 })
    expect(result.status).toBe('partial')
    expect(parseCoffeeBagOcr([{ text: 'LAVADO', confidence: 0.8 }]).bean.process).toBe('washed')
  })

  it('recognizes exact compact varieties and process aliases', () => {
    expect(parseCoffeeBagOcr([{ text: 'Pacamara Semilavado', confidence: 0.8 }]).bean)
      .toMatchObject({ variety: 'Pacamara', process: 'washed' })
    expect(parseCoffeeBagOcr([{ text: 'Bourbon Rosa Lavado', confidence: 0.8 }]).bean)
      .toMatchObject({ variety: 'Bourbon Rosa', process: 'washed' })
    expect(parseCoffeeBagOcr([{ text: 'Pacamara Black Honey', confidence: 0.8 }]).bean)
      .toMatchObject({ variety: 'Pacamara', process: 'honey' })
  })

  it('does not mistake a labelled tasting note ending in a process word for a compact identity', () => {
    const result = parseCoffeeBagOcr([{ text: 'Notas: sabor natural', confidence: 0.8 }])

    expect(result.bean).toEqual({ process: 'unknown', roast_level: 'unknown', tasting_notes: ['sabor natural'] })
  })
})
