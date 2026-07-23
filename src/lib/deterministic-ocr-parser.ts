import type { BeanProfile, ExtractionResponse } from '@/types/recipe'

export type OcrTextBlock = {
  text: string
  confidence?: number
}

type BeanField = keyof Pick<
  BeanProfile,
  'bean_name' | 'roaster' | 'variety' | 'finca' | 'producer' | 'process' | 'origin' | 'altitude_masl' | 'roast_level' | 'tasting_notes'
>

const LABEL_TO_FIELD: Record<string, BeanField> = {
  'coffee': 'bean_name',
  'coffee name': 'bean_name',
  'nombre del cafe': 'bean_name',
  'nombre cafe': 'bean_name',
  'roaster': 'roaster',
  'roastery': 'roaster',
  'tostador': 'roaster',
  'tostaduria': 'roaster',
  'variety': 'variety',
  'varietal': 'variety',
  'variedad': 'variety',
  'farm': 'finca',
  'finca': 'finca',
  'producer': 'producer',
  'productor': 'producer',
  'process': 'process',
  'processing': 'process',
  'proceso': 'process',
  'origin': 'origin',
  'origen': 'origin',
  'region': 'origin',
  'ubicacion': 'origin',
  'altitude': 'altitude_masl',
  'altitud': 'altitude_masl',
  'elevation': 'altitude_masl',
  'cultivado a': 'altitude_masl',
  'roast': 'roast_level',
  'roast level': 'roast_level',
  'tueste': 'roast_level',
  'tostado': 'roast_level',
  'nivel de tueste': 'roast_level',
  'tasting notes': 'tasting_notes',
  'notes': 'tasting_notes',
  'notas de cata': 'tasting_notes',
  'notas': 'tasting_notes',
  'perfil': 'tasting_notes',
}

const SPACE_SEPARATED_LABELS = new Set([
  'farm', 'finca', 'producer', 'productor', 'region', 'ubicacion',
  'altitude', 'altitud', 'elevation', 'tueste', 'tostado', 'roast', 'roast level',
])

const PROCESS_ALIASES: Record<string, BeanProfile['process']> = {
  washed: 'washed', lavado: 'washed', lavada: 'washed', semilavado: 'washed', 'semi lavado': 'washed',
  natural: 'natural', naturals: 'natural',
  honey: 'honey', miel: 'honey', 'yellow honey': 'honey', 'black honey': 'honey',
  anaerobic: 'anaerobic', anaerobico: 'anaerobic', anaerobica: 'anaerobic',
  carbonic: 'carbonic', 'carbonic maceration': 'carbonic', 'maceracion carbonica': 'carbonic',
  'thermal shock': 'thermal_shock', 'choque termico': 'thermal_shock',
  experimental: 'experimental', experimento: 'experimental',
}

const VARIETY_ALIASES: Record<string, string> = {
  geisha: 'Geisha',
  gesha: 'Gesha',
  pacamara: 'Pacamara',
  pacas: 'Pacas',
  'bourbon rosa': 'Bourbon Rosa',
  'pink bourbon': 'Pink Bourbon',
  sl28: 'SL28',
  'sl 28': 'SL28',
}

const ROAST_ALIASES: Record<string, BeanProfile['roast_level']> = {
  light: 'light', 'light roast': 'light', claro: 'light',
  'medium light': 'medium-light', 'medium light roast': 'medium-light', 'medio claro': 'medium-light',
  medium: 'medium', 'medium roast': 'medium', medio: 'medium',
  'medium dark': 'medium-dark', 'medium dark roast': 'medium-dark', 'medio oscuro': 'medium-dark',
  dark: 'dark', 'dark roast': 'dark', oscuro: 'dark',
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9+,.\-/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanValue(value: string) {
  return value.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, '').trim()
}

function parseAltitude(value: string) {
  const match = normalize(value).match(/(\d{1,2}(?:,\d{3})|\d{3,4})(?:\s*(?:-|to|a)\s*(\d{1,2}(?:,\d{3})|\d{3,4}))?\s*(?:m|masl|msnm)?/)
  if (!match) return null
  const low = Number(match[1].replace(',', ''))
  const high = match[2] ? Number(match[2].replace(',', '')) : low
  if (low < 300 || high > 3000) return null
  return Math.round((low + high) / 2)
}

function parseStandaloneAltitude(value: string) {
  if (!/\b(?:masl|msnm|m)\b/i.test(value)) return null
  return parseAltitude(value)
}

function parseNotes(value: string) {
  const notes = value.split(/[,;/]/).map(note => cleanValue(note)).filter(Boolean)
  return notes.length ? notes : null
}

function parseValue(field: BeanField, value: string): BeanProfile[BeanField] | null {
  if (!value) return null
  const normalized = normalize(value)
  if (field === 'process') return PROCESS_ALIASES[normalized] ?? null
  if (field === 'roast_level') return ROAST_ALIASES[normalized] ?? null
  if (field === 'altitude_masl') return parseAltitude(value)
  if (field === 'tasting_notes') return parseNotes(value)
  return cleanValue(value) || null
}

function parseCompactIdentity(line: string): Partial<Pick<BeanProfile, 'process' | 'variety'>> | null {
  const normalized = normalize(line)
  const aliases = Object.keys(PROCESS_ALIASES).toSorted((a, b) => b.length - a.length)
  for (const alias of aliases) {
    if (normalized === alias) return { process: PROCESS_ALIASES[alias] }
    if (!normalized.endsWith(alias)) continue
    const prefix = normalized.slice(0, -alias.length).replace(/[\s-]+$/, '').trim()
    if (!prefix) continue

    const process = PROCESS_ALIASES[alias]
    const variety = VARIETY_ALIASES[prefix]
    if (variety) return { process, variety }
    if (/[–—-]/.test(line)) return { process }
  }
  return null
}

function extractLabelAndValue(line: string) {
  const normalized = normalize(line)
  const standaloneField = LABEL_TO_FIELD[normalized]
  if (standaloneField) return { field: standaloneField, value: '' }

  const separatorIndex = line.search(/[:–—-]/)
  if (separatorIndex > 0) {
    const field = LABEL_TO_FIELD[normalize(line.slice(0, separatorIndex))]
    const value = cleanValue(line.slice(separatorIndex + 1))
    if (field && value) return { field, value }
  }

  for (const label of SPACE_SEPARATED_LABELS) {
    if (normalized.startsWith(`${label} `)) {
      const field = LABEL_TO_FIELD[label]
      const value = cleanValue(line.slice(label.length))
      if (value) return { field, value }
    }
  }

  return null
}

function confidenceFor(block: OcrTextBlock) {
  if (typeof block.confidence !== 'number' || !Number.isFinite(block.confidence)) return 0
  return Math.max(0, Math.min(1, block.confidence > 1 ? block.confidence / 100 : block.confidence))
}

/**
 * Parses only explicit English/Spanish field labels. Accents, punctuation, and
 * line breaks are normalized; unlabelled bag prose is intentionally ignored.
 * A field's confidence is the OCR confidence of the exact label/value block.
 */
export function parseCoffeeBagOcr(blocks: readonly OcrTextBlock[]): ExtractionResponse {
  const bean: BeanProfile = { process: 'unknown', roast_level: 'unknown' }
  const confidence: Record<string, number> = {}

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    const standaloneAltitude = parseStandaloneAltitude(block.text)
    if (standaloneAltitude !== null) {
      bean.altitude_masl = standaloneAltitude
      confidence.altitude_masl = confidenceFor(block)
    }
    const standaloneRoast = ROAST_ALIASES[normalize(block.text)]
    if (standaloneRoast) {
      bean.roast_level = standaloneRoast
      confidence.roast_level = confidenceFor(block)
    }
    const standaloneVariety = VARIETY_ALIASES[normalize(block.text)]
    if (standaloneVariety) {
      bean.variety = standaloneVariety
      confidence.variety = confidenceFor(block)
    }
    const compactIdentity = parseCompactIdentity(block.text)
    if (compactIdentity) {
      bean.process = compactIdentity.process ?? bean.process
      confidence.process = confidenceFor(block)
      if (compactIdentity.variety) {
        bean.variety = compactIdentity.variety
        confidence.variety = confidenceFor(block)
      }
    }
    const match = extractLabelAndValue(block.text)
    if (!match) continue

    const nextBlock = blocks[index + 1]
    const nextIsLabel = nextBlock ? extractLabelAndValue(nextBlock.text) : null
    const rawValue = match.value || (nextBlock && !nextIsLabel ? nextBlock.text : '')
    const parsed = parseValue(match.field, rawValue)
    if (parsed === null) continue

    ;(bean as Record<string, unknown>)[match.field] = parsed
    confidence[match.field] = confidenceFor(match.value ? block : nextBlock ?? block)
  }

  const foundFields = Object.keys(confidence)
  if (foundFields.length === 0) {
    return {
      bean,
      confidence,
      status: 'empty',
      warnings: ['No explicitly labelled coffee details were found. Please review and complete the profile.'],
    }
  }

  const complete = bean.process !== 'unknown' && bean.roast_level !== 'unknown'
  return {
    bean,
    confidence,
    status: complete ? 'complete' : 'partial',
    warnings: complete ? [] : ['Some coffee details could not be read. Please review and complete the profile.'],
  }
}
