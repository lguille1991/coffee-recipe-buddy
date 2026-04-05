import {
  BeanProfile,
  MethodId,
  MethodRecommendation,
  METHOD_DISPLAY_NAMES,
} from '@/types/recipe'

type MethodScores = Record<MethodId, number>

const ALL_METHODS: MethodId[] = [
  'v60', 'origami', 'orea_v4', 'hario_switch', 'kalita_wave',
  'chemex', 'ceado_hoop', 'pulsar', 'aeropress',
]

function initScores(): MethodScores {
  return Object.fromEntries(ALL_METHODS.map(m => [m, 0])) as MethodScores
}

function scoreProcess(scores: MethodScores, process: BeanProfile['process']) {
  const rules: Record<string, { best: MethodId[]; good: MethodId[]; avoid: MethodId[] }> = {
    washed: {
      best: ['v60', 'origami', 'orea_v4'],
      good: ['kalita_wave', 'chemex'],
      avoid: [],
    },
    natural: {
      best: ['hario_switch', 'pulsar', 'kalita_wave'],
      good: ['ceado_hoop', 'aeropress'],
      avoid: [],
    },
    honey: {
      best: ['hario_switch', 'kalita_wave', 'ceado_hoop'],
      good: ['v60', 'origami'],
      avoid: [],
    },
    anaerobic: {
      best: ['pulsar', 'aeropress', 'hario_switch'],
      good: ['ceado_hoop'],
      avoid: ['v60', 'origami'],
    },
    unknown: { best: [], good: [], avoid: [] },
  }

  const rule = rules[process]
  if (!rule) return
  rule.best.forEach(m => { scores[m] += 3 })
  rule.good.forEach(m => { scores[m] += 1 })
  rule.avoid.forEach(m => { scores[m] -= 2 })
}

function scoreRoast(scores: MethodScores, roast: BeanProfile['roast_level']) {
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
      good: [],
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
  rule.best.forEach(m => { scores[m] += 2 })
  rule.good.forEach(m => { scores[m] += 1 })
  rule.avoid.forEach(m => { scores[m] -= 1 })
}

function scoreVariety(scores: MethodScores, variety?: string) {
  if (!variety) return

  const lower = variety.toLowerCase()
  const isExotic = /gesha|geisha|pacamara|maragogipe|laurina|pink bourbon/.test(lower)
  const isClassic = /bourbon|typica|caturra|catuai|mundo novo/.test(lower)

  if (isExotic) {
    ;(['v60', 'origami', 'orea_v4'] as MethodId[]).forEach(m => { scores[m] += 2 })
    scores['pulsar'] += 1
  } else if (isClassic) {
    ;(['kalita_wave', 'hario_switch', 'chemex'] as MethodId[]).forEach(m => { scores[m] += 2 })
    scores['v60'] += 1
  }
}

function scoreFlavorNotes(scores: MethodScores, notes?: string[]) {
  if (!notes || notes.length === 0) return

  const joined = notes.join(' ').toLowerCase()

  const patterns: Array<{ keywords: RegExp; methods: MethodId[] }> = [
    { keywords: /floral|jasmine|rose|lavender|hibiscus/, methods: ['v60', 'origami', 'orea_v4'] },
    { keywords: /fruity|berry|tropical|stone fruit|cherry|peach/, methods: ['hario_switch', 'pulsar', 'kalita_wave'] },
    { keywords: /chocolate|nutty|caramel|toffee|hazelnut/, methods: ['chemex', 'kalita_wave', 'ceado_hoop'] },
    { keywords: /citrus|bright|lemon|lime|orange|grapefruit/, methods: ['v60', 'origami', 'orea_v4'] },
    { keywords: /earthy|tobacco|spice|ferment|wine|funk/, methods: ['aeropress', 'ceado_hoop', 'hario_switch'] },
    { keywords: /complex|layered|wine/, methods: ['pulsar', 'hario_switch'] },
    { keywords: /clean|crisp|tea|delicate/, methods: ['v60', 'origami'] },
  ]

  patterns.forEach(({ keywords, methods }) => {
    if (keywords.test(joined)) {
      methods.forEach(m => { scores[m] += 2 })
    }
  })
}

function scoreAltitude(scores: MethodScores, altitude?: number) {
  if (!altitude) return

  if (altitude >= 1800) {
    scores['pulsar'] += 1
    scores['aeropress'] += 1
  } else if (altitude < 1000) {
    scores['ceado_hoop'] += 1
    scores['kalita_wave'] += 1
  }
}

function buildRationale(
  method: MethodId,
  bean: BeanProfile,
): string {
  const name = METHOD_DISPLAY_NAMES[method]

  const rationaleMap: Partial<Record<MethodId, Record<string, string>>> = {
    v60: {
      washed: 'Maximum clarity for this washed bean — the V60 highlights brightness and florals.',
      natural: 'The V60 can work for naturals, though Switch or Kalita may control body better.',
      default: 'The V60 delivers outstanding clarity and acidity separation for this bean profile.',
    },
    origami: {
      washed: 'Similar to V60, the Origami highlights delicate washed flavors with a faster drain.',
      default: 'The Origami Air M highlights clarity and florals, ideal for light-roasted specialty beans.',
    },
    orea_v4: {
      default: 'The Orea V4 flat-bottom design ensures even saturation — great for accentuating brightness and sweetness.',
    },
    hario_switch: {
      natural: 'Hybrid immersion controls body and sweetness — ideal for this natural process bean.',
      honey: 'The Switch manages the richer body of honey-process coffees beautifully.',
      default: 'The Hario Switch hybrid method balances clarity and body for this bean.',
    },
    kalita_wave: {
      natural: 'The flat-bed design gives structure and even extraction for fruit-forward naturals.',
      default: 'The Kalita Wave delivers balanced extraction with body and sweetness — a forgiving choice.',
    },
    chemex: {
      default: 'The Chemex thick filter removes oils for a clean, tea-like cup with excellent clarity.',
    },
    ceado_hoop: {
      default: 'The Ceado Hoop single-pour style is consistent and forgiving across most bean profiles.',
    },
    pulsar: {
      default: 'The NextLevel Pulsar high-extraction design extracts maximum sweetness and complexity.',
    },
    aeropress: {
      anaerobic: 'The AeroPress handles the heavy ferment notes of anaerobic process well under pressure.',
      dark: 'AeroPress excels at darker roasts — pressure extraction reduces bitterness.',
      default: 'The AeroPress is a versatile high-pressure brewer that adapts well to this bean.',
    },
  }

  const map = rationaleMap[method] || {}
  return map[bean.process] || map['default'] || `${name} suits this bean profile well.`
}

export function recommendMethods(bean: BeanProfile): MethodRecommendation[] {
  const scores = initScores()

  scoreProcess(scores, bean.process ?? undefined)
  scoreRoast(scores, bean.roast_level ?? undefined)
  scoreVariety(scores, bean.variety ?? undefined)
  scoreFlavorNotes(scores, bean.tasting_notes ?? undefined)
  scoreAltitude(scores, bean.altitude_masl ?? undefined)

  const sorted = ALL_METHODS
    .map(m => ({ method: m, score: scores[m] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return sorted.map((entry, idx) => ({
    method: entry.method,
    displayName: METHOD_DISPLAY_NAMES[entry.method],
    rank: idx + 1,
    score: entry.score,
    rationale: buildRationale(entry.method, bean),
  }))
}
