import {
  BeanProfile,
  BrewGoal,
  MethodId,
  MethodRecommendation,
  METHOD_DISPLAY_NAMES,
} from '@/types/recipe'

type MethodScores = Record<MethodId, number>
type ConfidenceMap = Record<string, number>
type RecommendationConfidence = MethodRecommendation['confidence']

interface MethodRecommendationOptions {
  brewGoal?: BrewGoal
  extractionConfidence?: ConfidenceMap | null
  now?: Date
  source?: 'manual' | 'scan'
}

interface ScoreState {
  scores: MethodScores
  reasons: Record<MethodId, string[]>
}

type SensoryFamily =
  | 'clarity'
  | 'floral'
  | 'citrus'
  | 'orchard-fruit'
  | 'tropical-fruit'
  | 'jammy-fruit'
  | 'chocolate-sweet'
  | 'tea-like'
  | 'fermenty'
  | 'body'

const ALL_METHODS: MethodId[] = [
  'v60', 'origami', 'orea_v4', 'hario_switch', 'kalita_wave',
  'chemex', 'ceado_hoop', 'pulsar', 'aeropress',
]

const SENSORY_WEIGHTS: Record<SensoryFamily, Partial<Record<MethodId, number>>> = {
  clarity: { v60: 2, origami: 2, orea_v4: 2, chemex: 1 },
  floral: { v60: 2, origami: 2, orea_v4: 1, chemex: 1 },
  citrus: { v60: 2, origami: 2, orea_v4: 1 },
  'orchard-fruit': { v60: 1, origami: 1, hario_switch: 1, kalita_wave: 1 },
  'tropical-fruit': { hario_switch: 2, pulsar: 2, kalita_wave: 1 },
  'jammy-fruit': { hario_switch: 2, kalita_wave: 2, pulsar: 1, aeropress: 1 },
  'chocolate-sweet': { chemex: 2, kalita_wave: 2, ceado_hoop: 2, hario_switch: 1 },
  'tea-like': { v60: 2, origami: 2, chemex: 2, orea_v4: 1 },
  fermenty: { aeropress: 2, hario_switch: 2, ceado_hoop: 1, pulsar: 1 },
  body: { hario_switch: 2, kalita_wave: 2, ceado_hoop: 2, aeropress: 1 },
}

const GOAL_WEIGHTS: Record<BrewGoal, Partial<Record<MethodId, number>>> = {
  clarity: { v60: 3, origami: 3, orea_v4: 3, chemex: 1 },
  balanced: { hario_switch: 3, kalita_wave: 3, ceado_hoop: 2, chemex: 1 },
  sweetness: { pulsar: 4, hario_switch: 3, kalita_wave: 2, ceado_hoop: 2 },
  body: { hario_switch: 8, ceado_hoop: 6, aeropress: 6, kalita_wave: 4, v60: -3, origami: -3, orea_v4: -2 },
  forgiving: { kalita_wave: 5, ceado_hoop: 5, hario_switch: 4, aeropress: 2 },
}

function initScoreState(): ScoreState {
  const scores = {} as MethodScores
  const reasons = {} as Record<MethodId, string[]>

  ALL_METHODS.forEach(method => {
    scores[method] = 0
    reasons[method] = []
  })

  return {
    scores,
    reasons,
  }
}

function applyWeight(
  state: ScoreState,
  method: MethodId,
  weight: number,
  reason: string,
) {
  state.scores[method] += weight
  state.reasons[method].push(reason)
}

function applyWeights(
  state: ScoreState,
  weights: Partial<Record<MethodId, number>>,
  reason: string,
) {
  Object.entries(weights).forEach(([method, weight]) => {
    if (!weight) return
    applyWeight(state, method as MethodId, weight, reason)
  })
}

function normalizeVariety(variety?: string | null): string | undefined {
  if (!variety) return undefined

  const lower = variety.trim().toLowerCase()
  const replacements: Array<[RegExp, string]> = [
    [/\bgeisha\b/g, 'gesha'],
    [/\bpink\s+bourbon\b/g, 'pink bourbon'],
    [/\bsl[\s-]?28\b/g, 'sl28'],
    [/\bsl[\s-]?34\b/g, 'sl34'],
    [/\bbourbon rosa\b/g, 'bourbon rosa'],
  ]

  return replacements.reduce((current, [pattern, value]) => current.replace(pattern, value), lower)
}

function normalizeNotes(notes?: string[] | null): string[] {
  if (!notes) return []
  return notes
    .map(note => note.trim().toLowerCase())
    .filter(Boolean)
}

function deriveSensoryFamilies(bean: BeanProfile): SensoryFamily[] {
  const joined = normalizeNotes(bean.tasting_notes).join(' ')
  const families = new Set<SensoryFamily>()

  const rules: Array<[RegExp, SensoryFamily[]]> = [
    [/\bfloral|jasmine|rose|lavender|hibiscus|flor de cafe\b/, ['floral', 'clarity']],
    [/\bcitrus|lim[aon]|orange|mandarin|mandarina|grapefruit|toronja|bright\b/, ['citrus', 'clarity']],
    [/\bpeach|durazno|pear|pera|apple|manzana|fig|higo|stone fruit\b/, ['orchard-fruit']],
    [/\bguava|tropical|mango|pineapple|maracuya\b/, ['tropical-fruit']],
    [/\bberry|cherry|cereza|forest fruit|marmalade|mermelada|jam|tamarind|tamarindo\b/, ['jammy-fruit']],
    [/\bchocolate|dark chocolate|caramel|caramelo|panela|toffee|maple|miel\b/, ['chocolate-sweet', 'body']],
    [/\btea|te negro|black tea|green tea|pu-erh|delicate|clean|crisp\b/, ['tea-like', 'clarity']],
    [/\bferment|funk|wine|rum|boozy|anaerobic|spice|cinnamon|canela\b/, ['fermenty']],
    [/\bcreamy|cream|cremoso|body|cuerpo|syrup|silky\b/, ['body']],
  ]

  rules.forEach(([pattern, mappedFamilies]) => {
    if (!pattern.test(joined)) return
    mappedFamilies.forEach(family => families.add(family))
  })

  return [...families]
}

function scoreProcess(state: ScoreState, process: BeanProfile['process']) {
  const rules: Record<string, { best: MethodId[]; good: MethodId[]; avoid: MethodId[] }> = {
    washed: {
      best: ['v60', 'origami', 'kalita_wave'],
      good: ['orea_v4', 'chemex'],
      avoid: [],
    },
    natural: {
      best: ['chemex', 'hario_switch', 'kalita_wave'],
      good: ['ceado_hoop', 'aeropress', 'pulsar'],
      avoid: [],
    },
    honey: {
      best: ['v60', 'kalita_wave', 'origami'],
      good: ['hario_switch', 'ceado_hoop'],
      avoid: [],
    },
    anaerobic: {
      best: ['pulsar', 'aeropress', 'hario_switch'],
      good: ['v60', 'ceado_hoop'],
      avoid: [],
    },
    unknown: { best: [], good: [], avoid: [] },
  }

  const rule = rules[process]
  if (!rule) return

  rule.best.forEach(method => applyWeight(state, method, 3, `${process} process match`))
  rule.good.forEach(method => applyWeight(state, method, 1, `${process} process fit`))
  rule.avoid.forEach(method => applyWeight(state, method, -2, `${process} process penalty`))
}

function scoreRoast(state: ScoreState, roast: BeanProfile['roast_level']) {
  const rules: Record<string, { best: MethodId[]; good: MethodId[]; avoid: MethodId[] }> = {
    light: {
      best: ['v60', 'origami', 'orea_v4', 'pulsar'],
      good: ['kalita_wave'],
      avoid: [],
    },
    'medium-light': {
      best: ['v60', 'origami', 'orea_v4', 'hario_switch'],
      good: ['kalita_wave', 'ceado_hoop'],
      avoid: [],
    },
    medium: {
      best: ['kalita_wave', 'hario_switch', 'chemex'],
      good: ['ceado_hoop'],
      avoid: [],
    },
    'medium-dark': {
      best: ['kalita_wave', 'chemex', 'hario_switch'],
      good: ['ceado_hoop'],
      avoid: ['v60', 'origami'],
    },
    dark: {
      best: ['aeropress', 'chemex', 'ceado_hoop'],
      good: ['kalita_wave'],
      avoid: ['v60', 'origami', 'orea_v4'],
    },
  }

  const rule = rules[roast]
  if (!rule) return

  rule.best.forEach(method => applyWeight(state, method, 2, `${roast} roast match`))
  rule.good.forEach(method => applyWeight(state, method, 1, `${roast} roast fit`))
  rule.avoid.forEach(method => applyWeight(state, method, -1, `${roast} roast penalty`))
}

function scoreVariety(state: ScoreState, variety?: string) {
  const normalized = normalizeVariety(variety)
  if (!normalized) return

  const isRareClarity = /\bgesha|pacamara|maragogipe|laurina|sl28|sl34\b/.test(normalized)
  const isSweetStructured = /\bbourbon rosa|pink bourbon|bourbon|typica|caturra|catuai|mundo novo\b/.test(normalized)

  if (isRareClarity) {
    applyWeights(state, { v60: 2, origami: 2, orea_v4: 1, chemex: 1 }, `variety ${normalized} prefers clarity`)
  }

  if (isSweetStructured) {
    applyWeights(state, { kalita_wave: 2, hario_switch: 2, chemex: 1, v60: 1 }, `variety ${normalized} rewards sweetness and balance`)
  }
}

function scoreOrigin(state: ScoreState, origin?: string | null) {
  if (!origin) return

  const normalized = origin.trim().toLowerCase()

  const rules: Array<{
    pattern: RegExp
    best: MethodId[]
    good?: MethodId[]
  }> = [
    { pattern: /\b(?:ethiopia|yirgacheffe|sidamo)\b/, best: ['v60', 'chemex', 'origami'], good: ['kalita_wave', 'orea_v4'] },
    { pattern: /\bkenya\b/, best: ['v60', 'kalita_wave', 'origami'], good: ['chemex', 'orea_v4'] },
    { pattern: /\b(?:colombia|huila)\b/, best: ['v60', 'kalita_wave', 'hario_switch'], good: ['origami', 'aeropress'] },
    { pattern: /\bbrazil\b/, best: ['ceado_hoop', 'hario_switch', 'aeropress'], good: ['kalita_wave', 'chemex'] },
    { pattern: /\bguatemala\b/, best: ['v60', 'kalita_wave', 'hario_switch'], good: ['origami'] },
    { pattern: /\byemen\b/, best: ['v60', 'chemex', 'origami'], good: ['kalita_wave'] },
    { pattern: /\bpanama\b/, best: ['v60', 'origami', 'kalita_wave'], good: ['orea_v4', 'chemex'] },
    { pattern: /\bcosta rica\b/, best: ['v60', 'kalita_wave', 'origami'], good: ['aeropress'] },
    { pattern: /\brwanda\b/, best: ['v60', 'origami', 'kalita_wave'], good: ['orea_v4'] },
    { pattern: /\bel salvador\b/, best: ['v60', 'chemex', 'kalita_wave'], good: ['origami'] },
    { pattern: /\b(?:indonesia|sumatra)\b/, best: ['ceado_hoop', 'hario_switch', 'aeropress'], good: ['kalita_wave'] },
  ]

  rules.forEach(rule => {
    if (!rule.pattern.test(normalized)) return
    rule.best.forEach(method => applyWeight(state, method, 3, `origin ${normalized} pairing`))
    rule.good?.forEach(method => applyWeight(state, method, 1, `origin ${normalized} fit`))
  })
}

function scoreSensoryFamilies(state: ScoreState, bean: BeanProfile) {
  const families = deriveSensoryFamilies(bean)
  families.forEach(family => {
    const weights = SENSORY_WEIGHTS[family]
    applyWeights(state, weights, `${family} sensory signal`)
  })
}

function scoreAltitude(state: ScoreState, altitude?: number) {
  if (!altitude) return

  if (altitude >= 1800) {
    applyWeights(state, { pulsar: 1, aeropress: 1, v60: 1 }, 'high-altitude density signal')
  } else if (altitude < 1200) {
    applyWeights(state, { ceado_hoop: 1, kalita_wave: 1, hario_switch: 1 }, 'lower-altitude forgiveness signal')
  }
}

function scoreFreshness(state: ScoreState, roastDate?: string, now = new Date()) {
  if (!roastDate) return

  const roast = new Date(roastDate)
  if (Number.isNaN(roast.getTime())) return

  const dayMs = 24 * 60 * 60 * 1000
  const ageDays = Math.floor((now.getTime() - roast.getTime()) / dayMs)

  if (ageDays >= 0 && ageDays <= 6) {
    applyWeights(state, { kalita_wave: 5, hario_switch: 5, ceado_hoop: 4, aeropress: 2 }, 'very fresh coffee needs a forgiving brewer')
    applyWeights(state, { v60: -3, origami: -3, orea_v4: -2 }, 'very fresh coffee penalty on high-clarity brewers')
  } else if (ageDays >= 7 && ageDays <= 21) {
    applyWeights(state, { v60: 1, origami: 1, orea_v4: 1, pulsar: 1 }, 'coffee is in a strong brewing window')
  } else if (ageDays >= 35) {
    applyWeights(state, { aeropress: 1, ceado_hoop: 1, hario_switch: 1 }, 'older coffee benefits from easier extraction')
  }
}

function scoreGoal(state: ScoreState, goal?: BrewGoal) {
  if (!goal) return
  applyWeights(state, GOAL_WEIGHTS[goal], `user goal: ${goal}`)
}

function computeInputConfidence(
  bean: BeanProfile,
  options: MethodRecommendationOptions,
): { confidence: RecommendationConfidence; note?: string } {
  const requiredFields = [bean.process, bean.roast_level].filter(Boolean).length
  const optionalFields = [
    bean.variety,
    bean.altitude_masl,
    bean.tasting_notes?.length ? 'notes' : undefined,
    bean.roast_date,
  ].filter(Boolean).length

  const baseScore = requiredFields * 0.3 + Math.min(optionalFields, 3) * 0.1

  if (options.source === 'manual') {
    if (baseScore >= 0.8) {
      return { confidence: 'high' }
    }
    return {
      confidence: 'medium',
      note: 'Manual entry is missing some detail, so these are starting points rather than precise matches.',
    }
  }

  const confidenceMap = options.extractionConfidence ?? {}
  const trackedKeys = ['process', 'roast_level', 'variety', 'altitude_masl', 'tasting_notes']
  const scores = trackedKeys
    .map(key => confidenceMap[key])
    .filter((value): value is number => typeof value === 'number')

  if (scores.length === 0) {
    return {
      confidence: baseScore >= 0.8 ? 'medium' : 'low',
      note: 'The bag scan did not provide strong confidence scores, so these recommendations are conservative.',
    }
  }

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length

  if (average >= 0.8 && baseScore >= 0.8) {
    return { confidence: 'high' }
  }

  if (average >= 0.6 && baseScore >= 0.6) {
    return {
      confidence: 'medium',
      note: 'Some bag details were inferred, so these are good starting points rather than hard rankings.',
    }
  }

  return {
    confidence: 'low',
    note: 'The scan is uncertain about important bean details. Treat these as safe starting points.',
  }
}

function applyConfidencePenalty(state: ScoreState, confidence: RecommendationConfidence) {
  if (confidence === 'high') return

  if (confidence === 'medium') {
    applyWeights(state, { kalita_wave: 1, hario_switch: 1, ceado_hoop: 1 }, 'medium-confidence safety tilt')
    return
  }

  applyWeights(state, { kalita_wave: 2, hario_switch: 2, ceado_hoop: 2, aeropress: 1 }, 'low-confidence safety tilt')
  applyWeights(state, { v60: -1, origami: -1, pulsar: -1 }, 'low-confidence penalty on demanding brewers')
}

function dedupeReasons(reasons: string[]): string[] {
  return [...new Set(reasons)]
}

function buildRationale(
  method: MethodId,
  entryReasons: string[],
  confidenceNote?: string,
): string {
  const primaryReasons = dedupeReasons(entryReasons).filter(reason => !reason.includes('penalty')).slice(0, 3)
  const summary = primaryReasons.length > 0
    ? primaryReasons.join(', ')
    : `${METHOD_DISPLAY_NAMES[method]} suits this bean profile well.`

  if (!confidenceNote) return summary
  return `${summary}. ${confidenceNote}`
}

function buildReasonBadges(entryReasons: string[]): string[] {
  const priority: Record<string, number> = {
    'tea-like': 0,
    floral: 1,
    citrus: 2,
    'goal: body': 3,
    'goal: forgiving': 3,
  }

  const labels = dedupeReasons(entryReasons)
    .filter(reason => !reason.includes('penalty'))
    .map(reason => reason
      .replace(' sensory signal', '')
      .replace(' process match', '')
      .replace(' process fit', '')
      .replace(' roast match', '')
      .replace(' roast fit', '')
      .replace('user goal: ', 'goal: ')
      .replace(' prefers clarity', '')
      .replace(' rewards sweetness and balance', '')
      .trim())
    .sort((left, right) => (priority[left] ?? 10) - (priority[right] ?? 10))

  return labels.slice(0, 3)
}

export function recommendMethods(
  bean: BeanProfile,
  options: MethodRecommendationOptions = {},
): MethodRecommendation[] {
  const state = initScoreState()
  const confidence = computeInputConfidence(bean, options)

  scoreProcess(state, bean.process ?? undefined)
  scoreRoast(state, bean.roast_level ?? undefined)
  scoreVariety(state, bean.variety ?? undefined)
  scoreOrigin(state, bean.origin)
  scoreSensoryFamilies(state, bean)
  scoreAltitude(state, bean.altitude_masl ?? undefined)
  scoreFreshness(state, bean.roast_date ?? undefined, options.now)
  scoreGoal(state, options.brewGoal)
  applyConfidencePenalty(state, confidence.confidence)

  const sorted = ALL_METHODS
    .map(method => ({
      method,
      score: state.scores[method],
      reasons: state.reasons[method],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return sorted.map((entry, idx) => ({
    method: entry.method,
    displayName: METHOD_DISPLAY_NAMES[entry.method],
    rank: idx + 1,
    score: entry.score,
    rationale: buildRationale(entry.method, entry.reasons, idx === 0 ? confidence.note : undefined),
    reasonBadges: buildReasonBadges(entry.reasons),
    confidence: confidence.confidence,
    confidenceNote: idx === 0 ? confidence.note : undefined,
  }))
}
