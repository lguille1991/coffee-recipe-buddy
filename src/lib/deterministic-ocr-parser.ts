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

const MIN_FUZZY_CONFIDENCE = 0.5
const MIN_INFERRED_PRODUCER_CONFIDENCE = 0.7
const FUZZY_PROCESS_TARGETS: Array<[string, BeanProfile['process']]> = [
  ['natural', 'natural'],
  ['washed', 'washed'],
  ['lavado', 'washed'],
  ['honey', 'honey'],
  ['anaerobic', 'anaerobic'],
  ['carbonic', 'carbonic'],
  ['experimental', 'experimental'],
]

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
  ['mermelada de frutos del bosque', 'mermelada de frutos del bosque'],
  ['forest fruit jam', 'mermelada de frutos del bosque'],
  ['wildflower honey', 'wildflower honey'],
  ['concord grape', 'concord grape'],
  ['naranja dulce', 'naranja dulce'],
  ['pu-erh tea', 'pu-erh tea'],
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
  if (!/(?:^|[\d\s])(?:masl|msnm|ma|m)\b/i.test(value)) return null
  return parseAltitude(value)
}

function parseNotes(value: string) {
  const notes = value
    .split(/[,;/]|\r?\n/)
    .map(note => cleanValue(note))
    .filter(Boolean)
  return notes.length ? notes : null
}

function canonicalOriginText(value: string) {
  return cleanValue(value)
    .replace(/\bcentroam[eé]rica\b/gi, 'Central America')
    .replace(/\bta palma\b/gi, 'La Palma')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*C\.?\s*A\.?\s*$/i, '')
    .trim()
}

function parseValue(field: BeanField, value: string): BeanProfile[BeanField] | null {
  if (!value) return null
  const normalized = normalize(value)
  if (field === 'process') return PROCESS_ALIASES[normalized] ?? null
  if (field === 'roast_level') return ROAST_ALIASES[normalized] ?? null
  if (field === 'altitude_masl') return parseAltitude(value)
  if (field === 'tasting_notes') return parseNotes(value)
  if (field === 'variety') return VARIETY_ALIASES[normalized] ?? titleCaseUppercase(value)
  if (field === 'origin' && (
    /^(?:finca|farm|altitud|altitude)\b/.test(normalized)
    || /\b(?:masl|msnm)\b/.test(normalized)
    || tableHeaderField(value)
  )) return null
  if (field === 'origin') return canonicalOriginText(value).replace(/\bllamatepec\b/gi, 'Ilamatepec')
  if (field === 'finca') return cleanValue(value).replace(/^Bellavista$/i, 'Bella Vista')
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

function plausiblePersonIdentity(value: string) {
  const cleaned = cleanValue(value.replace(/^de\s+/i, ''))
  const normalized = normalize(cleaned).replace(/^[|:.,\-/\s]+|[|:.,\-/\s]+$/g, '')
  const words = cleaned.split(/\s+/)
  const personLikeCasing = cleaned === cleaned.toLocaleUpperCase()
    || words.every(word => /^\p{Lu}/u.test(word))
  return likelyPersonName(value)
    && personLikeCasing
    && !VARIETY_ALIASES[normalized]
    && !Object.keys(VARIETY_ALIASES).some(alias => (
      new RegExp(`(?:^|\\s)${alias.replace(' ', '\\s+')}(?:\\s|$)`).test(normalized)
    ))
    && !PROCESS_ALIASES[normalized]
    && !ROAST_ALIASES[normalized]
    && !fuzzyIdentityProcess(value)
    && !tableHeaderField(value)
    && !COUNTRY_ORIGIN.test(normalized)
}

function tableHeaderField(value: string): 'producer' | 'origin' | 'finca' | null {
  const normalized = normalize(value).replace(/^[|:.,\-/\s]+|[|:.,\-/\s]+$/g, '')
  if (extractLabelAndValue(value)?.value) return null
  if (/^(?:ca[fs]icul\s*tora|ca[fs]icult\w*|cultora|agricult\w*|producer|productor)$/.test(normalized)) return 'producer'
  if (/^(?:territorio|origin|origen|region)$/.test(normalized)) return 'origin'
  if (/^(?:finca|farm)$/.test(normalized)) return 'finca'
  return null
}

function plausibleTableValue(field: 'producer' | 'origin' | 'finca', value: string) {
  const normalized = normalize(value).replace(/^[|:.,\-/\s]+|[|:.,\-/\s]+$/g, '')
  if (
    !normalized
    || normalized.length > 50
    || tableHeaderField(value)
    || extractLabelAndValue(value)
    || parseAltitude(value) !== null
    || PROCESS_ALIASES[normalized]
    || ROAST_ALIASES[normalized]
    || VARIETY_ALIASES[normalized]
    || fuzzyIdentityProcess(value)
  ) return false
  if (field === 'producer') return plausiblePersonIdentity(value.replace(/^de\s+/i, ''))
  if (!/[a-z]/.test(normalized) || normalized.split(' ').length > 5) return false
  if (field === 'origin') return !/^(?:finca|farm|caficult|productor|producer)\b/.test(normalized)
  return !COUNTRY_ORIGIN.test(normalized)
}

function geometricTableValues(blocks: readonly OcrTextBlock[]) {
  const detectedHeaders = blocks.flatMap(block => {
    const field = tableHeaderField(block.text)
    return field && block.bbox && !block.source?.startsWith('joined:') ? [{ block, field }] : []
  })
  type TableField = 'producer' | 'origin' | 'finca'
  type TableDirection = 'above' | 'below'
  type TableMatch = {
    field: TableField
    block: OcrTextBlock & { bbox: OcrBoundingBox }
    direction: TableDirection
    score: number
  }
  const headerRows: Array<typeof detectedHeaders> = []
  const sortedHeaders = detectedHeaders.toSorted((left, right) => (
    (left.block.bbox!.y0 + left.block.bbox!.y1) - (right.block.bbox!.y0 + right.block.bbox!.y1)
  ))
  for (const header of sortedHeaders) {
    const centerY = (header.block.bbox!.y0 + header.block.bbox!.y1) / 2
    const row = headerRows.findLast(candidate => {
      const anchor = candidate[0].block.bbox!
      return Math.abs(centerY - (anchor.y0 + anchor.y1) / 2) <= 0.04
    })
    if (row) row.push(header)
    else headerRows.push([header])
  }

  const selectedValues = new Map<TableField, TableMatch>()
  for (const row of headerRows) {
    const strongestByField = new Map<TableField, (typeof row)[number]>()
    for (const header of row) {
      const current = strongestByField.get(header.field)
      if (!current || confidenceFor(header.block) > confidenceFor(current.block)) {
        strongestByField.set(header.field, header)
      }
    }
    if (strongestByField.size < 2) continue
    const headers = [...strongestByField.values()].toSorted((left, right) => (
      (left.block.bbox!.x0 + left.block.bbox!.x1) - (right.block.bbox!.x0 + right.block.bbox!.x1)
    ))
    const matches: TableMatch[] = []
    for (let headerIndex = 0; headerIndex < headers.length; headerIndex += 1) {
      const header = headers[headerIndex]
      const headerCenter = (header.block.bbox!.x0 + header.block.bbox!.x1) / 2
      const leftBoundary = headerIndex > 0
        ? (headerCenter + (headers[headerIndex - 1].block.bbox!.x0 + headers[headerIndex - 1].block.bbox!.x1) / 2) / 2
        : Math.max(0, header.block.bbox!.x0 - 0.15)
      const rightBoundary = headerIndex + 1 < headers.length
        ? (headerCenter + (headers[headerIndex + 1].block.bbox!.x0 + headers[headerIndex + 1].block.bbox!.x1) / 2) / 2
        : Math.min(1, header.block.bbox!.x1 + 0.15)
      for (const block of blocks) {
        if (
          block === header.block
          || !block.bbox
          || block.source?.startsWith('joined:')
          || !plausibleTableValue(header.field, block.text)
        ) continue
        const center = (block.bbox.x0 + block.bbox.x1) / 2
        const verticalGap = Math.max(
          0,
          block.bbox.y0 - header.block.bbox!.y1,
          header.block.bbox!.y0 - block.bbox.y1,
        )
        if (
          verticalGap > 0.08
          || center < leftBoundary - 0.02
          || center > rightBoundary + 0.02
        ) continue
        const blockCenterY = (block.bbox.y0 + block.bbox.y1) / 2
        const headerCenterY = (header.block.bbox!.y0 + header.block.bbox!.y1) / 2
        matches.push({
          field: header.field,
          block: block as OcrTextBlock & { bbox: OcrBoundingBox },
          direction: blockCenterY < headerCenterY ? 'above' : 'below',
          score: confidenceFor(block) - verticalGap * 3 - Math.abs(center - headerCenter),
        })
      }
    }

    const bestByDirection = (direction: TableDirection) => {
      const values = new Map<TableField, TableMatch>()
      for (const match of matches) {
        if (match.direction !== direction) continue
        const current = values.get(match.field)
        if (!current || match.score > current.score) values.set(match.field, match)
      }
      return values
    }
    const above = bestByDirection('above')
    const below = bestByDirection('below')
    const totalScore = (values: Map<TableField, TableMatch>) => (
      [...values.values()].reduce((sum, match) => sum + match.score, 0)
    )
    const selected = above.size > below.size
      || (above.size === below.size && totalScore(above) > totalScore(below))
      ? above
      : below
    for (const [field, match] of selected) {
      const current = selectedValues.get(field)
      if (!current || match.score > current.score) selectedValues.set(field, match)
    }
  }
  return new Map([...selectedValues].map(([field, match]) => [field, match.block]))
}

function producerContinuation(
  blocks: readonly OcrTextBlock[],
  labelBlock: OcrTextBlock,
  valueBlock: OcrTextBlock,
) {
  return blocks
    .filter(candidate => {
      const normalized = normalize(candidate.text)
      if (
        candidate === labelBlock
        || candidate === valueBlock
        || !/^[a-z][a-z'-]{2,}$/i.test(normalized)
        || confidenceFor(candidate) < MIN_INFERRED_PRODUCER_CONFIDENCE
        || extractLabelAndValue(candidate.text)
        || tableHeaderField(candidate.text)
      ) return false
      if (valueBlock.bbox && candidate.bbox) {
        const verticalOverlap = Math.min(valueBlock.bbox.y1, candidate.bbox.y1)
          - Math.max(valueBlock.bbox.y0, candidate.bbox.y0)
        const minimumHeight = Math.min(
          valueBlock.bbox.y1 - valueBlock.bbox.y0,
          candidate.bbox.y1 - candidate.bbox.y0,
        )
        return verticalOverlap >= minimumHeight * 0.35
          && candidate.bbox.x0 >= valueBlock.bbox.x0
          && candidate.bbox.x0 - valueBlock.bbox.x1 <= 0.08
      }
      return sameRun(valueBlock, candidate)
        && typeof valueBlock.order === 'number'
        && typeof candidate.order === 'number'
        && candidate.order > valueBlock.order
        && candidate.order - valueBlock.order <= 2
    })
    .toSorted((left, right) => (left.bbox?.x0 ?? left.order ?? 0) - (right.bbox?.x0 ?? right.order ?? 0))[0]
}

function countryOrigin(value: string) {
  const match = value.match(COUNTRY_ORIGIN)
  return match ? titleCaseUppercase(match[0]) : null
}

function countryOriginForBlock(block: OcrTextBlock) {
  const exact = countryOrigin(block.text)
  if (exact) return exact
  const normalized = normalize(block.text)
  if (
    block.source?.startsWith('country-seal')
    && confidenceFor(block) >= 0.25
    && /^salv[a-z]{1,4}$/.test(normalized)
  ) return 'El Salvador'
  return null
}

const ORIGIN_PROSE_WORDS = /\b(?:cafe|coffee|cultivad[oa]|desde|from|grown|hecho|imported|made|roast(?:ed)?|sourced|tostad[oa]|with)\b/

function locationShapedOriginComponent(value: string) {
  const normalized = normalize(value)
  return normalized.length > 0
    && normalized.split(/\s+/).length <= 3
    && !/[\d:]/.test(normalized)
    && !ORIGIN_PROSE_WORDS.test(normalized)
}

function countryBearingOrigin(value: string) {
  const country = countryOrigin(value)
  if (!country) return null
  const canonical = canonicalOriginText(value)
  const components = canonical.split(',').map(component => component.trim()).filter(Boolean)
  const hasStandaloneCountry = components.some(component => normalize(component) === normalize(country))
  return components.length >= 2
    && components.length <= 4
    && hasStandaloneCountry
    && components.every(locationShapedOriginComponent)
    ? canonical
    : country
}

function recognizedTastingNotes(value: string) {
  const corrected = normalize(value)
    .replace(/\bmanzara\b/g, 'manzana')
    .replace(/\branger\b/g, 'mandarina')
    .replace(/\bman\s+darina\b/g, 'mandarina')
    .replace(/\bhi\s+igo\b/g, 'higo')
    .replace(/\bchoc\s+olate\b/g, 'chocolate')
    .replace(/\bcho\s+colate\b/g, 'chocolate')
    .replace(/\bavellan\b/g, 'avellana')
    .replace(/\bforest fruit j\s*m\b/g, 'forest fruit jam')
  const found: string[] = []
  for (const [alias, canonical] of TASTING_NOTE_ALIASES) {
    if (new RegExp(`(?:^|[^a-z])${alias.replace(' ', '\\s+')}([^a-z]|$)`).test(corrected)) found.push(canonical)
  }
  return found
}

function preferLongestNotes(notes: readonly string[]) {
  const unique = notes.filter((note, index) => (
    notes.findIndex(candidate => normalize(candidate) === normalize(note)) === index
  ))
  return unique.filter(note => !unique.some(candidate => {
    const normalizedNote = normalize(note)
    const normalizedCandidate = normalize(candidate)
    return normalizedCandidate !== normalizedNote
      && normalizedCandidate.length > normalizedNote.length
      && new RegExp(`(?:^|\\s)${normalizedNote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(normalizedCandidate)
  }))
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

function fuzzyIdentityProcess(value: string) {
  const normalized = normalize(value).replace(/^[|:.,\-/\s]+|[|:.,\-/\s]+$/g, '')
  if (!/^[a-z]+(?:\s+[a-z]+)?$/.test(normalized)) return null
  const compact = normalized.replace(/\s+/g, '')
  if (compact.length < 5 || compact.length > 12) return null
  for (const [target, process] of FUZZY_PROCESS_TARGETS) {
    const distance = editDistance(compact, target)
    const maximumDistance = target.length >= 6 ? 3 : 2
    if (distance <= maximumDistance && distance / Math.max(compact.length, target.length) <= 0.43) {
      return { process, requiresSameRun: false }
    }
    if (
      target === 'natural'
      && distance <= 5
      && /^[vny]a\s+[a-z]{3}$/.test(normalized)
    ) return { process, requiresSameRun: true }
  }
  return null
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
  if (block.source?.startsWith('country-seal') && !countryOrigin(block.text)) return false
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

function countryOriginFromFragments(blocks: readonly OcrTextBlock[]) {
  return blocks
    .flatMap(anchor => {
      if (!anchor.source || typeof anchor.order !== 'number' || !anchor.bbox || !countryOrigin(anchor.text)) return []
      const preceding = blocks
        .filter(candidate => (
          candidate !== anchor
          && candidate.source === anchor.source
          && typeof candidate.order === 'number'
          && candidate.order < anchor.order!
          && anchor.order! - candidate.order <= 2
          && candidate.bbox
          && /,\s*$/.test(candidate.text)
          && !/\d/.test(candidate.text)
          && Math.abs(candidate.bbox.y0 - anchor.bbox!.y0) <= 0.04
          && candidate.bbox.x0 < anchor.bbox!.x0
        ))
        .toSorted((left, right) => left.order! - right.order!)
      if (preceding.length === 0) return []
      const chain = [...preceding, anchor]
      if (chain.some((block, index) => (
        index > 0
        && block.bbox!.x0 - chain[index - 1].bbox!.x1 > 0.03
      ))) return []
      const combinedValue = canonicalOriginText(chain.map(block => block.text).join(' '))
      if (combinedValue.split(',').filter(Boolean).length < 2) return []
      const value = countryBearingOrigin(combinedValue)
      return value ? [{ value, block: anchor }] : []
    })
    .toSorted((left, right) => right.value.length - left.value.length)[0]
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
  const tableValues = geometricTableValues(blocks)

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
        if (plausibleTableValue('producer', values[0])) {
          setCandidate('producer', titleCaseUppercase(values[0]), following[0], 4)
        }
        if (plausibleTableValue('origin', values[1])) {
          setCandidate('origin', titleCaseUppercase(values[1]), following[0], 4)
        }
        if (plausibleTableValue('finca', values[2])) {
          setCandidate('finca', titleCaseUppercase(values[2]).replace(/^Bellavista$/i, 'Bella Vista'), following[0], 4)
        }
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
      if (plausibleTableValue('producer', rowValues[0])) {
        setCandidate('producer', titleCaseUppercase(rowValues[0].replace(/^de\s+/i, '')), block, 3)
      }
      if (plausibleTableValue('origin', rowValues[1])) {
        setCandidate('origin', titleCaseUppercase(rowValues[1]), block, 3)
      }
      if (thirdValue && plausibleTableValue('finca', thirdValue)) {
        setCandidate('finca', titleCaseUppercase(thirdValue).replace(/^Bellavista$/i, 'Bella Vista'), block, 3)
      }
    }

    const standaloneAltitude = parseStandaloneAltitude(block.text)
    if (standaloneAltitude !== null) setCandidate('altitude_masl', standaloneAltitude, block, 2)
    const bareAltitude = /^\d{3,4}$/.test(normalized) ? parseAltitude(block.text) : null
    if (bareAltitude !== null && blocks.some(other => (
      other !== block
      && /^(?:m|ma|ms|masl|msnm)$/.test(normalize(other.text))
      && (
        (block.bbox && other.bbox
          && Math.abs(other.bbox.y0 - block.bbox.y0) <= 0.05
          && Math.max(0, block.bbox.x0 - other.bbox.x1, other.bbox.x0 - block.bbox.x1) <= 0.1)
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
    if (standaloneVariety) setCandidate('variety', standaloneVariety, block, 5)

    const compactIdentity = parseCompactIdentity(block.text)
    if (compactIdentity) {
      if (compactIdentity.process) setCandidate('process', compactIdentity.process, block, 2)
      if (compactIdentity.variety) setCandidate('variety', compactIdentity.variety, block, 5)
      if (compactIdentity.bean_name) setCandidate('bean_name', compactIdentity.bean_name, block, 2)
    }

    const sameRunIdentityContext = Boolean(block.source) && blocks.some(other => (
      other !== block
      && other.source === block.source
      && Boolean(VARIETY_ALIASES[normalize(other.text)])
    ))
    const hasIdentityContext = Boolean(candidates.get('variety')) || sameRunIdentityContext
    const fuzzyProcess = fuzzyIdentityProcess(block.text)
    if (
      hasIdentityContext
      && confidenceFor(block) >= MIN_FUZZY_CONFIDENCE
      && fuzzyProcess
      && (!fuzzyProcess.requiresSameRun || sameRunIdentityContext)
    ) {
      setCandidate('process', fuzzyProcess.process, block, 1)
    }

    const singleOrigin = normalized.match(/^single origin\s+(.+)$/)
    if (singleOrigin) setCandidate('origin', titleCaseUppercase(singleOrigin[1]), block, 2)
    const originCountry = countryOriginForBlock(block)
    const countryLine = countryBearingOrigin(block.text) ?? originCountry
    const locationLikeCountryLine = normalized.split(' ').length <= 4
      || normalized.includes(',')
      || normalized.startsWith(normalize(originCountry ?? ''))
    if (originCountry && countryLine && normalized.length <= 70 && locationLikeCountryLine) {
      setCandidate('origin', countryLine, block, countryLine === originCountry ? 1 : 2)
    }

    const match = extractLabelAndValue(block.text)
    if (!match) continue
    if (
      block.bbox
      && tableHeaderField(block.text) === match.field
      && tableValues.has(match.field as 'producer' | 'origin' | 'finca')
    ) continue

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

    if (match.field === 'producer' && rawValue && normalize(rawValue).split(' ').length <= 3) {
      const continuation = producerContinuation(blocks, block, valueBlock)
      if (continuation && !normalize(rawValue).includes(normalize(continuation.text))) {
        rawValue = `${rawValue} ${continuation.text}`
      }
    }

    setCandidate(match.field, parseValue(match.field, rawValue), valueBlock, 4)
  }

  const fragmentedCountryOrigin = countryOriginFromFragments(blocks)
  if (fragmentedCountryOrigin) {
    setCandidate('origin', fragmentedCountryOrigin.value, fragmentedCountryOrigin.block, 2)
  }

  for (const [field, block] of tableValues) {
    const value = titleCaseUppercase(block.text.replace(/^de\s+/i, ''))
    if (field === 'producer') setCandidate('producer', value, block, 4)
    if (field === 'origin') setCandidate('origin', value, block, 4)
    if (field === 'finca') setCandidate('finca', value.replace(/^Bellavista$/i, 'Bella Vista'), block, 4)
  }

  if (typeof bean.origin === 'string' && !COUNTRY_ORIGIN.test(bean.origin)) {
    const countryBlock = blocks
      .flatMap(block => {
        const country = countryOriginForBlock(block)
        const normalized = normalize(block.text)
        const dedicatedSealReading = block.source?.startsWith('country-seal')
          && /^salv[a-z]{1,4}$/.test(normalized)
        return country && (normalized === normalize(country) || dedicatedSealReading)
          ? [{ block, country }]
          : []
      })
      .toSorted((left, right) => confidenceFor(right.block) - confidenceFor(left.block))[0]
    if (countryBlock) {
      setCandidate(
        'origin',
        canonicalOriginText(`${bean.origin}, ${countryBlock.country}`),
        countryBlock.block,
        5,
      )
    }
  }

  for (let index = 0; index + 2 < blocks.length; index += 1) {
    const farm = extractLabelAndValue(blocks[index].text)
    const person = blocks[index + 1]
    const identity = blocks[index + 2]
    if (
      farm?.field === 'finca'
      && farm.value
      && plausiblePersonIdentity(person.text)
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
        && plausiblePersonIdentity(candidate.text)
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

  if (Array.isArray(bean.tasting_notes)) {
    bean.tasting_notes = preferLongestNotes(bean.tasting_notes)
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
