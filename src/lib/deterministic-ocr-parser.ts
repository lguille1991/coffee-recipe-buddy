import type { BeanProfile, ExtractionResponse } from '@/types/recipe'

export type OcrBoundingBox = {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type OcrTextBlock = {
  text: string
  confidence?: number
  bbox?: OcrBoundingBox
  source?: string
  order?: number
}

type BeanField = keyof Pick<
  BeanProfile,
  'bean_name' | 'roaster' | 'variety' | 'finca' | 'producer' | 'process' | 'origin' | 'altitude_masl' | 'roast_level' | 'tasting_notes'
>

type Candidate = {
  value: BeanProfile[BeanField]
  confidence: number
  strength: number
}

const LABEL_TO_FIELD: Record<string, BeanField> = {
  coffee: 'bean_name',
  'coffee name': 'bean_name',
  'nombre del cafe': 'bean_name',
  'nombre cafe': 'bean_name',
  roaster: 'roaster',
  roastery: 'roaster',
  tostador: 'roaster',
  tostaduria: 'roaster',
  variety: 'variety',
  varietal: 'variety',
  variedad: 'variety',
  farm: 'finca',
  finca: 'finca',
  producer: 'producer',
  productor: 'producer',
  process: 'process',
  processing: 'process',
  proceso: 'process',
  origin: 'origin',
  origen: 'origin',
  region: 'origin',
  ubicacion: 'origin',
  territorio: 'origin',
  altitude: 'altitude_masl',
  altitud: 'altitude_masl',
  elevation: 'altitude_masl',
  'cultivado a': 'altitude_masl',
  roast: 'roast_level',
  'roast level': 'roast_level',
  tueste: 'roast_level',
  tostado: 'roast_level',
  'nivel de tueste': 'roast_level',
  'tasting notes': 'tasting_notes',
  notes: 'tasting_notes',
  'notas de cata': 'tasting_notes',
  notas: 'tasting_notes',
  perfil: 'tasting_notes',
}

const SPACE_SEPARATED_LABELS = new Set([
  'farm', 'finca', 'producer', 'productor', 'region', 'ubicacion',
  'altitude', 'altitud', 'elevation', 'tueste', 'tostado', 'roast', 'roast level',
])

const PROCESS_ALIASES: Record<string, BeanProfile['process']> = {
  washed: 'washed',
  wash: 'washed',
  lavado: 'washed',
  lavada: 'washed',
  lav: 'washed',
  semilavado: 'washed',
  'semi lavado': 'washed',
  natural: 'natural',
  naturals: 'natural',
  honey: 'honey',
  miel: 'honey',
  'yellow honey': 'honey',
  'black honey': 'honey',
  anaerobic: 'anaerobic',
  anaerobico: 'anaerobic',
  anaerobica: 'anaerobic',
  carbonic: 'carbonic',
  'carbonic maceration': 'carbonic',
  'maceracion carbonica': 'carbonic',
  'thermal shock': 'thermal_shock',
  'choque termico': 'thermal_shock',
  experimental: 'experimental',
  experimento: 'experimental',
}

const FUZZY_NATURAL_ALIASES = new Set(['naturp', 'vaturp', 'va turp', 'va turd', 'vat ye', 'va rue', 'varye', 'var ye'])
const MIN_FUZZY_CONFIDENCE = 0.5
const MIN_INFERRED_PRODUCER_CONFIDENCE = 0.7

const VARIETY_ALIASES: Record<string, string> = {
  geisha: 'Geisha',
  gesha: 'Gesha',
  geist: 'Geisha',
  pacamara: 'Pacamara',
  acamara: 'Pacamara',
  pacas: 'Pacas',
  'bourbon rosa': 'Bourbon Rosa',
  'pink bourbon': 'Pink Bourbon',
  sl28: 'SL28',
  'sl 28': 'SL28',
}

const ROAST_ALIASES: Record<string, BeanProfile['roast_level']> = {
  light: 'light',
  'light roast': 'light',
  claro: 'light',
  'medium light': 'medium-light',
  'medium light roast': 'medium-light',
  'medio claro': 'medium-light',
  medium: 'medium',
  'medium roast': 'medium',
  medio: 'medium',
  'medium dark': 'medium-dark',
  'medium dark roast': 'medium-dark',
  'medio oscuro': 'medium-dark',
  dark: 'dark',
  'dark roast': 'dark',
  oscuro: 'dark',
}

const COUNTRY_ORIGIN = /\b(?:el salvador|brazil|brasil|colombia|guatemala|honduras|costa rica|panama|ethiopia|ethiopia|kenya)\b/i

const TASTING_NOTE_ALIASES: Array<[string, string]> = [
  ['strawberry fruit tart', 'strawberry fruit tart'],
  ['wildflower honey', 'wildflower honey'],
  ['concord grape', 'concord grape'],
  ['naranja dulce', 'naranja dulce'],
  ['blue berry', 'blue berry'],
  ['blueberry', 'blueberry'],
  ['frambuesa', 'frambuesa'],
  ['cardamomo', 'cardamomo'],
  ['mandarina', 'mandarina'],
  ['durazno', 'durazno'],
  ['chocolate', 'chocolate'],
  ['avellana', 'avellana'],
  ['caramelo', 'caramelo'],
  ['toronja', 'toronja'],
  ['te verde', 'te verde'],
  ['manzana', 'manzana'],
  ['naranja', 'naranja'],
  ['ciruela', 'ciruela'],
  ['cereza', 'cereza'],
  ['panela', 'panela'],
  ['toffee', 'toffee'],
  ['higo', 'higo'],
  ['pera', 'pera'],
  ['pina', 'piña'],
]

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9+,.\-/|:\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanValue(value: string) {
  return value.replace(/^[:\-–—|.\s]+|[:\-–—|.\s]+$/g, '').replace(/\s+/g, ' ').trim()
}

function titleCaseUppercase(value: string) {
  const cleaned = cleanValue(value)
  if (!cleaned || cleaned !== cleaned.toLocaleUpperCase()) return cleaned
  return cleaned.toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, match => match.toLocaleUpperCase())
}

function titleCase(value: string) {
  return cleanValue(value).toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, match => match.toLocaleUpperCase())
}

function parseAltitude(value: string) {
  const match = normalize(value).match(/(\d{1,2}(?:,\d{3})|\d{3,4})(?:\s*(?:-|to|a)\s*(\d{1,2}(?:,\d{3})|\d{3,4}))?/)
  if (!match) return null
  const low = Number(match[1].replace(',', ''))
  const high = match[2] ? Number(match[2].replace(',', '')) : low
  if (low < 300 || high > 3000) return null
  return Math.round((low + high) / 2)
}

function parseStandaloneAltitude(value: string) {
  if (!/(?:^|[\d\s])(?:masl|msnm|m)\b/i.test(value)) return null
  return parseAltitude(value)
}

function parseNotes(value: string) {
  const notes = value
    .split(/[,;/]|\r?\n/)
    .map(note => cleanValue(note))
    .filter(Boolean)
  return notes.length ? notes : null
}

function parseValue(field: BeanField, value: string): BeanProfile[BeanField] | null {
  if (!value) return null
  const normalized = normalize(value)
  if (field === 'process') return PROCESS_ALIASES[normalized] ?? null
  if (field === 'roast_level') return ROAST_ALIASES[normalized] ?? null
  if (field === 'altitude_masl') return parseAltitude(value)
  if (field === 'tasting_notes') return parseNotes(value)
  if (field === 'variety') return VARIETY_ALIASES[normalized] ?? titleCaseUppercase(value)
  if (field === 'origin' && (/^(?:finca|farm|altitud|altitude)\b/.test(normalized) || /\b(?:masl|msnm)\b/.test(normalized))) return null
  if (field === 'origin') return cleanValue(value).replace(/\bllamatepec\b/gi, 'Ilamatepec')
  return cleanValue(value) || null
}

function parseCompactIdentity(line: string): Partial<Pick<BeanProfile, 'bean_name' | 'process' | 'variety'>> | null {
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
    if (/[–—-]/.test(line)) return { process, bean_name: titleCase(prefix) }
  }
  return null
}

function extractLabelAndValue(line: string) {
  const normalized = normalize(line).replace(/[:.\s]+$/, '')
  const standaloneField = LABEL_TO_FIELD[normalized]
  if (standaloneField) return { field: standaloneField, value: '' }

  const separatorIndex = line.search(/[:–—]/)
  if (separatorIndex > 0) {
    const field = LABEL_TO_FIELD[normalize(line.slice(0, separatorIndex))]
    const value = cleanValue(line.slice(separatorIndex + 1))
    if (field) return { field, value }
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

function confidenceFor(block: OcrTextBlock | undefined) {
  if (!block || typeof block.confidence !== 'number' || !Number.isFinite(block.confidence)) return 0
  return Math.max(0, Math.min(1, block.confidence > 1 ? block.confidence / 100 : block.confidence))
}

function sameRun(left: OcrTextBlock, right: OcrTextBlock) {
  return !left.source || !right.source || left.source === right.source
}

function orderedAfter(label: OcrTextBlock, candidate: OcrTextBlock) {
  if (!sameRun(label, candidate)) return false
  if (typeof label.order === 'number' && typeof candidate.order === 'number') {
    return candidate.order > label.order && candidate.order - label.order <= 4
  }
  return true
}

function geometricallyNear(label: OcrTextBlock, candidate: OcrTextBlock) {
  if (!label.bbox || !candidate.bbox || !sameRun(label, candidate)) return false
  const verticalGap = candidate.bbox.y0 - label.bbox.y1
  const horizontalGap = Math.max(0, label.bbox.x0 - candidate.bbox.x1, candidate.bbox.x0 - label.bbox.x1)
  return verticalGap >= -0.015 && verticalGap <= 0.12 && horizontalGap <= 0.12
}

function followingBlocks(blocks: readonly OcrTextBlock[], index: number) {
  const label = blocks[index]
  const result: OcrTextBlock[] = []
  for (let offset = 1; offset <= 4 && index + offset < blocks.length; offset += 1) {
    const candidate = blocks[index + offset]
    if (!sameRun(label, candidate)) break
    if (extractLabelAndValue(candidate.text)) break
    if (!orderedAfter(label, candidate) && !geometricallyNear(label, candidate)) continue
    result.push(candidate)
  }
  return result
}

function splitTableRow(value: string) {
  return value.split(/\s*\|\s*|\s{2,}/).map(cleanValue).filter(Boolean)
}

function likelyPersonName(value: string) {
  const normalized = normalize(value)
  if (normalized.length < 5 || normalized.length > 45 || /\d|[,/:|]/.test(normalized)) return false
  const words = normalized.split(' ')
  return words.length >= 2 && words.length <= 4
}

function countryOrigin(value: string) {
  const match = value.match(COUNTRY_ORIGIN)
  return match ? titleCaseUppercase(match[0]) : null
}

function recognizedTastingNotes(value: string) {
  const corrected = normalize(value)
    .replace(/\bmanzara\b/g, 'manzana')
    .replace(/\branger\b/g, 'mandarina')
    .replace(/\bman\s+darina\b/g, 'mandarina')
    .replace(/\bchoc\s+olate\b/g, 'chocolate')
    .replace(/\bcho\s+colate\b/g, 'chocolate')
    .replace(/\bavellan\b/g, 'avellana')
  const found: string[] = []
  for (const [alias, canonical] of TASTING_NOTE_ALIASES) {
    if (new RegExp(`(?:^|[^a-z])${alias.replace(' ', '\\s+')}([^a-z]|$)`).test(corrected)) found.push(canonical)
  }
  return found
}

function confidenceForJoinedNote(blocks: readonly OcrTextBlock[], note: string) {
  const ordered = blocks.toSorted((left, right) => left.order! - right.order!)
  let best: number | null = null
  for (let start = 0; start < ordered.length; start += 1) {
    for (let size = 1; size <= 3 && start + size <= ordered.length; size += 1) {
      const window = ordered.slice(start, start + size)
      if (!recognizedTastingNotes(window.map(block => block.text).join(' ')).includes(note)) continue
      const confidence = Math.min(...window.map(confidenceFor))
      best = Math.max(best ?? 0, confidence)
    }
  }
  return best
}

function plausibleOriginContinuation(block: OcrTextBlock) {
  const normalized = normalize(block.text)
  if (!normalized || normalized.length > 60 || normalized.split(' ').length > 6 || /\d/.test(normalized)) return false
  if (extractLabelAndValue(block.text)) return false
  if (PROCESS_ALIASES[normalized] || ROAST_ALIASES[normalized] || VARIETY_ALIASES[normalized]) return false
  return likelyPersonName(block.text) || normalized.split(' ').length <= 3
}

function crossPassOriginContinuation(
  blocks: readonly OcrTextBlock[],
  labelBlock: OcrTextBlock,
  valueBlock: OcrTextBlock,
) {
  const anchor = valueBlock.bbox ?? labelBlock.bbox
  if (!anchor) return undefined
  return blocks
    .filter(candidate => (
      candidate !== labelBlock
      && candidate !== valueBlock
      && candidate.bbox
      && plausibleOriginContinuation(candidate)
      && candidate.bbox.y0 >= anchor.y0 - 0.015
      && candidate.bbox.y0 - anchor.y1 <= 0.08
      && Math.max(0, anchor.x0 - candidate.bbox.x1, candidate.bbox.x0 - anchor.x1) <= 0.15
    ))
    .toSorted((left, right) => {
      const leftGap = Math.max(0, left.bbox!.y0 - anchor.y1)
      const rightGap = Math.max(0, right.bbox!.y0 - anchor.y1)
      return leftGap - rightGap
    })[0]
}

/**
 * Extracts explicit English/Spanish fields from OCR lines. Layout metadata is
 * used only to pair labels with nearby values; bounded closed-vocabulary
 * aliases handle common OCR damage without interpreting arbitrary bag prose.
 */
export function parseCoffeeBagOcr(blocks: readonly OcrTextBlock[]): ExtractionResponse {
  const bean: BeanProfile = { process: 'unknown', roast_level: 'unknown' }
  const confidence: Record<string, number> = {}
  const candidates = new Map<BeanField, Candidate>()
  const unlabelledNotes = new Map<string, number>()

  const setCandidate = (
    field: BeanField,
    value: BeanProfile[BeanField] | null,
    block: OcrTextBlock | undefined,
    strength: number,
  ) => {
    if (value === null || value === undefined || value === '') return
    const candidate = { value, confidence: confidenceFor(block), strength }
    const current = candidates.get(field)
    const moreCompleteText = typeof current?.value === 'string'
      && typeof value === 'string'
      && ['bean_name', 'finca', 'producer', 'origin'].includes(field)
      && value.length >= current.value.length + 3
    if (
      current
      && (
        current.strength > strength
        || (current.strength === strength && current.confidence >= candidate.confidence && !moreCompleteText)
      )
    ) return
    candidates.set(field, candidate)
    ;(bean as Record<string, unknown>)[field] = value
    confidence[field] = candidate.confidence
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    const normalized = normalize(block.text)
    const following = followingBlocks(blocks, index)
    for (const note of recognizedTastingNotes(block.text)) {
      unlabelledNotes.set(note, Math.max(unlabelledNotes.get(note) ?? 0, confidenceFor(block)))
    }

    const tableLabels = splitTableRow(normalized)
    if (
      tableLabels.length >= 3
      && /caficult|agricult|producer|productor/.test(tableLabels[0])
      && /territorio|origin|origen|region/.test(tableLabels[1])
      && /finca|farm/.test(tableLabels[2])
    ) {
      const values = following[0] ? splitTableRow(following[0].text) : []
      if (values.length >= 3) {
        setCandidate('producer', titleCaseUppercase(values[0]), following[0], 4)
        setCandidate('origin', titleCaseUppercase(values[1]), following[0], 4)
        setCandidate('finca', titleCaseUppercase(values[2]).replace(/^Bellavista$/i, 'Bella Vista'), following[0], 4)
      }
    }

    const rowValues = splitTableRow(block.text)
    const hasCoffeeTableContext = rowValues.length >= 2 && blocks.some(other => (
      sameRun(block, other)
      && /cultora|territorio|finca|farm/.test(normalize(other.text))
      && (!block.bbox || !other.bbox || Math.abs(other.bbox.y0 - block.bbox.y0) <= 0.05)
    ))
    if (hasCoffeeTableContext) {
      const thirdValue = rowValues[2] ?? blocks.find(other => (
        sameRun(block, other)
        && other !== block
        && block.bbox
        && other.bbox
        && Math.abs(other.bbox.y0 - block.bbox.y0) <= 0.025
        && other.bbox.x0 > block.bbox.x1
      ))?.text
      setCandidate('producer', titleCaseUppercase(rowValues[0].replace(/^de\s+/i, '')), block, 3)
      setCandidate('origin', titleCaseUppercase(rowValues[1]), block, 3)
      if (thirdValue) setCandidate('finca', titleCaseUppercase(thirdValue).replace(/^Bellavista$/i, 'Bella Vista'), block, 3)
    }

    const standaloneAltitude = parseStandaloneAltitude(block.text)
    if (standaloneAltitude !== null) setCandidate('altitude_masl', standaloneAltitude, block, 2)
    const bareAltitude = /^\d{3,4}$/.test(normalized) ? parseAltitude(block.text) : null
    if (bareAltitude !== null && blocks.some(other => (
      other !== block
      && /^(?:m|ms|masl|msnm)$/.test(normalize(other.text))
      && (
        (block.bbox && other.bbox
          && Math.abs(other.bbox.y0 - block.bbox.y0) <= 0.035
          && Math.max(0, block.bbox.x0 - other.bbox.x1, other.bbox.x0 - block.bbox.x1) <= 0.05)
        || (
          sameRun(block, other)
          && typeof block.order === 'number'
          && typeof other.order === 'number'
          && Math.abs(block.order - other.order) <= 2
        )
      )
    ))) {
      setCandidate('altitude_masl', bareAltitude, block, 1)
    }

    const standaloneRoast = ROAST_ALIASES[normalized]
    if (standaloneRoast) setCandidate('roast_level', standaloneRoast, block, 2)

    const standaloneVariety = VARIETY_ALIASES[normalized]
    if (standaloneVariety) setCandidate('variety', standaloneVariety, block, 2)

    const compactIdentity = parseCompactIdentity(block.text)
    if (compactIdentity) {
      if (compactIdentity.process) setCandidate('process', compactIdentity.process, block, 2)
      if (compactIdentity.variety) setCandidate('variety', compactIdentity.variety, block, 3)
      if (compactIdentity.bean_name) setCandidate('bean_name', compactIdentity.bean_name, block, 2)
    }

    const hasIdentityContext = Boolean(candidates.get('variety'))
      || blocks.some(other => sameRun(block, other) && Boolean(VARIETY_ALIASES[normalize(other.text)]))
    if (
      hasIdentityContext
      && confidenceFor(block) >= MIN_FUZZY_CONFIDENCE
      && FUZZY_NATURAL_ALIASES.has(normalized)
    ) {
      setCandidate('process', 'natural', block, 1)
    }

    const singleOrigin = normalized.match(/^single origin\s+(.+)$/)
    if (singleOrigin) setCandidate('origin', titleCaseUppercase(singleOrigin[1]), block, 2)
    const originCountry = countryOrigin(block.text)
    const locationLikeCountryLine = normalized.split(' ').length <= 4
      || normalized.includes(',')
      || normalized.startsWith(normalize(originCountry ?? ''))
    if (originCountry && normalized.length <= 55 && locationLikeCountryLine) {
      setCandidate('origin', originCountry, block, 1)
    }

    const match = extractLabelAndValue(block.text)
    if (!match) continue

    let valueBlock = block
    let rawValue = match.value
    if (!rawValue && following.length) {
      valueBlock = following[0]
      rawValue = following[0].text
    }
    if (!rawValue && block.bbox) {
      const nearbyValue = blocks
        .filter(candidate => (
          candidate !== block
          && candidate.bbox
          && !extractLabelAndValue(candidate.text)
          && candidate.bbox.y0 >= block.bbox!.y1 - 0.01
          && candidate.bbox.y0 - block.bbox!.y1 <= 0.1
          && Math.max(0, block.bbox!.x0 - candidate.bbox.x1, candidate.bbox.x0 - block.bbox!.x1) <= 0.1
        ))
        .toSorted((left, right) => left.bbox!.y0 - right.bbox!.y0)[0]
      if (nearbyValue) {
        valueBlock = nearbyValue
        rawValue = nearbyValue.text
      }
    }

    if (match.field === 'altitude_masl' && !match.value) {
      const altitudeBlock = following.find(candidate => parseAltitude(candidate.text) !== null)
      if (altitudeBlock) {
        valueBlock = altitudeBlock
        rawValue = following.slice(0, following.indexOf(altitudeBlock) + 2).map(candidate => candidate.text).join(' ')
      }
    }

    if (match.field === 'tasting_notes') {
      const noteText = [
        match.value,
        ...following.slice(0, match.value ? 3 : 4).map(candidate => candidate.text),
      ].filter(Boolean).join('\n')
      setCandidate(match.field, parseNotes(noteText), match.value ? block : following[0] ?? block, 4)
      continue
    }

    if (match.field === 'origin' && rawValue) {
      const continuation = following.find(candidate => candidate !== valueBlock && !extractLabelAndValue(candidate.text))
        ?? (/[,\-/]\s*$/.test(rawValue)
          ? crossPassOriginContinuation(blocks, block, valueBlock)
          : undefined)
      if (continuation && /[,/-]\s*$/.test(rawValue)) rawValue = `${rawValue} ${continuation.text}`
    }

    setCandidate(match.field, parseValue(match.field, rawValue), valueBlock, 4)
  }

  for (let index = 0; index + 2 < blocks.length; index += 1) {
    const farm = extractLabelAndValue(blocks[index].text)
    const person = blocks[index + 1]
    const identity = blocks[index + 2]
    if (
      farm?.field === 'finca'
      && farm.value
      && likelyPersonName(person.text)
      && confidenceFor(person) >= MIN_INFERRED_PRODUCER_CONFIDENCE
      && sameRun(blocks[index], person)
      && sameRun(person, identity)
      && (VARIETY_ALIASES[normalize(identity.text)] || parseCompactIdentity(identity.text)?.variety)
    ) {
      setCandidate('producer', titleCaseUppercase(person.text), person, 2)
    }
  }

  for (const farmBlock of blocks) {
    const farm = extractLabelAndValue(farmBlock.text)
    if (farm?.field !== 'finca' || !farm.value || !farmBlock.bbox) continue
    const nearbyPerson = blocks
      .filter(candidate => (
        candidate !== farmBlock
        && candidate.bbox
        && candidate.bbox.y0 >= farmBlock.bbox!.y1
        && candidate.bbox.y0 - farmBlock.bbox!.y1 <= 0.06
        && Math.max(0, farmBlock.bbox!.x0 - candidate.bbox.x1, candidate.bbox.x0 - farmBlock.bbox!.x1) <= 0.08
        && likelyPersonName(candidate.text)
        && confidenceFor(candidate) >= MIN_INFERRED_PRODUCER_CONFIDENCE
        && !extractLabelAndValue(candidate.text)
      ))
      .toSorted((left, right) => left.bbox!.y0 - right.bbox!.y0)[0]
    if (nearbyPerson) setCandidate('producer', titleCaseUppercase(nearbyPerson.text), nearbyPerson, 2)
  }

  const blocksBySource = new Map<string, OcrTextBlock[]>()
  for (const block of blocks) {
    if (!block.source || typeof block.order !== 'number') continue
    const sourceBlocks = blocksBySource.get(block.source) ?? []
    sourceBlocks.push(block)
    blocksBySource.set(block.source, sourceBlocks)
  }
  for (const sourceBlocks of blocksBySource.values()) {
    const joined = sourceBlocks.toSorted((left, right) => left.order! - right.order!).map(block => block.text).join(' ')
    for (const note of recognizedTastingNotes(joined)) {
      const matchedConfidence = confidenceForJoinedNote(sourceBlocks, note)
      if (matchedConfidence !== null) {
        unlabelledNotes.set(note, Math.max(unlabelledNotes.get(note) ?? 0, matchedConfidence))
      }
    }
  }

  if (unlabelledNotes.size >= 2) {
    const explicit = Array.isArray(bean.tasting_notes) ? bean.tasting_notes : []
    const notes = unlabelledNotes.size >= 3
      ? explicit.filter(existing => [...unlabelledNotes.keys()].some(note => normalize(existing) === normalize(note)))
      : [...explicit]
    if (unlabelledNotes.size >= 3) {
      for (const note of unlabelledNotes.keys()) {
        if (!notes.some(existing => normalize(existing) === normalize(note))) notes.push(note)
      }
    }
    if (unlabelledNotes.size < 3) {
      for (const note of unlabelledNotes.keys()) {
        if (!notes.some(existing => normalize(existing).includes(normalize(note)))) notes.push(note)
      }
    }
    const averageConfidence = [...unlabelledNotes.values()].reduce((sum, value) => sum + value, 0) / unlabelledNotes.size
    const noteBlock = { text: notes.join(', '), confidence: averageConfidence }
    setCandidate('tasting_notes', notes, noteBlock, candidates.has('tasting_notes') ? 5 : 1)
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
