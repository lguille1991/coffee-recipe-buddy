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

    expect(result.bean).toEqual({ process: 'washed', roast_level: 'unknown', bean_name: 'Minas' })
    expect(result.confidence).toEqual({ process: 0.9, bean_name: 0.9 })
    expect(result.status).toBe('partial')
    expect(parseCoffeeBagOcr([{ text: 'LAVADO', confidence: 0.8 }]).bean.process).toBe('washed')
  })

  it('recognizes the explicit roast wording read from the Jaho label', () => {
    const result = parseCoffeeBagOcr([
      { text: 'MINAS', confidence: 0.88 },
      { text: 'WASHED', confidence: 0.92 },
      { text: 'MEDIUM ROAST', confidence: 0.91 },
    ])

    expect(result.bean).toMatchObject({ process: 'washed', roast_level: 'medium' })
    expect(result.bean.origin).toBeUndefined()
  })

  it('recognizes exact compact varieties and process aliases', () => {
    expect(parseCoffeeBagOcr([{ text: 'Pacamara Semilavado', confidence: 0.8 }]).bean)
      .toMatchObject({ variety: 'Pacamara', process: 'washed' })
    expect(parseCoffeeBagOcr([{ text: 'Bourbon Rosa Lavado', confidence: 0.8 }]).bean)
      .toMatchObject({ variety: 'Bourbon Rosa', process: 'washed' })
    expect(parseCoffeeBagOcr([{ text: 'Pacamara Black Honey', confidence: 0.8 }]).bean)
      .toMatchObject({ variety: 'Pacamara', process: 'honey' })
    expect(parseCoffeeBagOcr([{ text: 'acámara', confidence: 0.8 }]).bean)
      .toMatchObject({ variety: 'Pacamara' })
  })

  it('does not mistake a labelled tasting note ending in a process word for a compact identity', () => {
    const result = parseCoffeeBagOcr([{ text: 'Notas: sabor natural', confidence: 0.8 }])

    expect(result.bean).toEqual({ process: 'unknown', roast_level: 'unknown', tasting_notes: ['sabor natural'] })
  })

  it('parses split standalone values from the D’La Palma Geisha Natural layout', () => {
    const result = parseCoffeeBagOcr([
      { text: '1200 msnm', confidence: 0.98 },
      { text: 'Medio Claro', confidence: 0.97 },
      { text: 'Geisha', confidence: 0.99 },
      { text: 'Natural', confidence: 0.98 },
      { text: 'Finca Loma Verde', confidence: 0.96 },
      { text: 'Esperanza Aguilar', confidence: 0.95 },
    ])

    expect(result).toMatchObject({
      bean: {
        altitude_masl: 1200,
        roast_level: 'medium-light',
        process: 'natural',
        variety: 'Geisha',
        finca: 'Loma Verde',
      },
      confidence: {
        altitude_masl: 0.98,
        roast_level: 0.97,
        process: 0.98,
        variety: 0.99,
        finca: 0.96,
      },
      status: 'complete',
    })
    expect(result.bean.producer).toBeUndefined()
  })

  it('pairs a labelled altitude with a nearby split number and unit', () => {
    const result = parseCoffeeBagOcr([
      { text: 'Cultivado a:', confidence: 91, source: 'middle', order: 0 },
      { text: '1450', confidence: 88, source: 'middle', order: 1 },
      { text: 'msnm', confidence: 72, source: 'middle', order: 2 },
    ])

    expect(result.bean.altitude_masl).toBe(1450)
    expect(result.confidence.altitude_masl).toBe(0.88)
  })

  it('collects multiline tasting notes and a wrapped labelled origin', () => {
    const result = parseCoffeeBagOcr([
      { text: 'Región: Apaneca, Ilamatepec,', confidence: 91, source: 'details', order: 0 },
      { text: 'Santa Ana.', confidence: 89, source: 'details', order: 1 },
      { text: 'Perfil:', confidence: 94, source: 'details', order: 2 },
      { text: 'Toronja', confidence: 90, source: 'details', order: 3 },
      { text: 'Pera', confidence: 91, source: 'details', order: 4 },
      { text: 'Te verde', confidence: 87, source: 'details', order: 5 },
      { text: 'Caramelo', confidence: 92, source: 'details', order: 6 },
      { text: 'Tueste: Brew', confidence: 80, source: 'details', order: 7 },
    ])

    expect(result.bean).toMatchObject({
      origin: 'Apaneca, Ilamatepec, Santa Ana',
      tasting_notes: ['Toronja', 'Pera', 'Te verde', 'Caramelo'],
      roast_level: 'unknown',
    })
  })

  it('maps a labelled three-column producer, origin, and farm row', () => {
    const result = parseCoffeeBagOcr([
      { text: 'CAFICULTORA | TERRITORIO | FINCA', confidence: 82, source: 'details', order: 0 },
      { text: 'FAMILIA PLAZAS | ACEVEDO-HUILA. | BELLAVISTA', confidence: 91, source: 'details', order: 1 },
    ])

    expect(result.bean).toMatchObject({
      producer: 'Familia Plazas',
      origin: 'Acevedo-Huila',
      finca: 'Bella Vista',
    })
  })

  it('recognizes bounded process OCR variants only in an identity context', () => {
    const identity = parseCoffeeBagOcr([
      { text: 'Pacas', confidence: 96, source: 'identity', order: 0 },
      { text: 'Va TURP', confidence: 78, source: 'identity', order: 1 },
    ])
    const prose = parseCoffeeBagOcr([
      { text: 'Our natural landscape inspires every roast', confidence: 99 },
    ])

    expect(identity.bean).toMatchObject({ variety: 'Pacas', process: 'natural' })
    expect(prose.bean.process).toBe('unknown')
    expect(parseCoffeeBagOcr([
      { text: 'Pacas', confidence: 96, source: 'identity', order: 0 },
      { text: 'Va TURP', confidence: 30, source: 'identity', order: 1 },
    ]).bean.process).toBe('unknown')
  })

  it('uses the unlabelled person line between a farm and identity as producer', () => {
    const result = parseCoffeeBagOcr([
      { text: 'Finca Loma Verde', confidence: 96, source: 'identity', order: 0 },
      { text: 'Esperanza Aguilar', confidence: 95, source: 'identity', order: 1 },
      { text: 'Geisha', confidence: 99, source: 'identity', order: 2 },
    ])

    expect(result.bean).toMatchObject({
      finca: 'Loma Verde',
      producer: 'Esperanza Aguilar',
      variety: 'Geisha',
    })
  })

  it('prefers a complete labelled value over a higher-confidence truncated pass', () => {
    const result = parseCoffeeBagOcr([
      { text: 'Productor: Sa', confidence: 96 },
      { text: 'Productor: Saúl Gutierrez', confidence: 94 },
    ])

    expect(result.bean.producer).toBe('Saúl Gutierrez')
    expect(result.confidence.producer).toBe(0.94)
  })

  it('does not treat weights, roast dates, marketing copy, or unsupported roast wording as metadata', () => {
    const result = parseCoffeeBagOcr([
      { text: 'Net Weight: 340 g', confidence: 99 },
      { text: 'Roast date: 2026-07-23', confidence: 99 },
      { text: 'Naturally inspired coffee from the heart of Brazil', confidence: 99 },
      { text: 'Tueste: Brew', confidence: 99 },
      { text: 'Net weight: 1000 gram', confidence: 99 },
      { text: '1200', confidence: 99, source: 'full', order: 0 },
      { text: 'ms', confidence: 99, source: 'full', order: 8 },
    ])

    expect(result.bean).toEqual({ process: 'unknown', roast_level: 'unknown' })
    expect(result.status).toBe('empty')
  })

  it('requires enough confidence before inferring an unlabelled producer', () => {
    const result = parseCoffeeBagOcr([
      {
        text: 'Finca Loma Verde',
        confidence: 96,
        bbox: { x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.25 },
      },
      {
        text: 'Specialty Coffee',
        confidence: 40,
        bbox: { x0: 0.2, y0: 0.26, x1: 0.6, y1: 0.3 },
      },
    ])

    expect(result.bean.finca).toBe('Loma Verde')
    expect(result.bean.producer).toBeUndefined()
  })

  it('uses note-specific confidence for text joined across OCR lines', () => {
    const result = parseCoffeeBagOcr([
      { text: 'Unrelated heading', confidence: 99, source: 'notes', order: 0 },
      { text: 'Choc', confidence: 35, source: 'notes', order: 1 },
      { text: 'olate', confidence: 45, source: 'notes', order: 2 },
      { text: 'Blueberry', confidence: 60, source: 'notes', order: 3 },
    ])

    expect(result.bean.tasting_notes).toEqual(['blueberry', 'chocolate'])
    expect(result.confidence.tasting_notes).toBeCloseTo(0.475)
  })

  it('continues a wrapped origin across OCR passes using bounded geometry', () => {
    const result = parseCoffeeBagOcr([
      {
        text: 'Región: Huehuetenango,',
        confidence: 92,
        source: 'full',
        order: 0,
        bbox: { x0: 0.2, y0: 0.3, x1: 0.65, y1: 0.34 },
      },
      {
        text: 'La Democracia',
        confidence: 89,
        source: 'detail',
        order: 0,
        bbox: { x0: 0.22, y0: 0.35, x1: 0.5, y1: 0.39 },
      },
    ])

    expect(result.bean.origin).toBe('Huehuetenango, La Democracia')
  })
})
