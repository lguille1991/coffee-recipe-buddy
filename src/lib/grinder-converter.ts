// Grinder conversion utilities.
// K-Ultra is the primary reference. All conversions go through microns.

export interface GrinderSetting {
  range: string
  starting_point: string
  description?: string
  note?: string
}

export type GrinderEditValue = number | string

const K_ULTRA_FULL_ROTATION_CLICKS = 100
const K_ULTRA_NUMBER_CLICKS = 10
const K_ULTRA_NOTATION_REGEX = /^\d+\.[0-9](?:\.[0-9])?$/

// ─── K-Ultra: clicks → microns ───────────────────────────────────────────────

// Piecewise linear interpolation based on the grind table.
const K_ULTRA_TABLE: Array<[number, number]> = [
  [40, 440], [45, 495], [50, 550], [55, 605], [60, 660],
  [65, 715], [70, 770], [72, 792], [74, 814], [76, 836],
  [78, 858], [80, 880], [81, 891], [82, 902], [83, 913],
  [84, 924], [85, 935], [86, 946], [87, 957], [88, 968],
  [90, 990], [95, 1045], [100, 1100], [110, 1210], [120, 1320],
]

export function kUltraClicksToMicrons(clicks: number): number {
  const table = K_ULTRA_TABLE
  if (clicks <= table[0][0]) return table[0][1]
  if (clicks >= table[table.length - 1][0]) return table[table.length - 1][1]

  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (clicks >= x0 && clicks <= x1) {
      const t = (clicks - x0) / (x1 - x0)
      return Math.round(y0 + t * (y1 - y0))
    }
  }
  return clicks * 11 // fallback linear
}

// ─── Q-Air: microns → rotations ──────────────────────────────────────────────
// Anchor points derived from the tested rotation-based grind table (0.0–4.0 rotations).

const Q_AIR_TABLE: Array<[number, number]> = [
  [0,    0.0],
  [200,  0.6],
  [400,  1.2],
  [550,  1.6],
  [700,  2.2],
  [850,  2.6],
  [900,  2.8],
  [1200, 3.6],
  [1400, 4.0],
]

function micronsToQAirRaw(microns: number): number {
  const table = Q_AIR_TABLE
  if (microns <= table[0][0]) return table[0][1]
  if (microns >= table[table.length - 1][0]) return table[table.length - 1][1]

  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (microns >= x0 && microns <= x1) {
      const t = (microns - x0) / (x1 - x0)
      return y0 + t * (y1 - y0) // full precision; formatting handled by formatQAirSetting
    }
  }
  return 6.0
}

/**
 * Converts a decimal rotation value to Q-Air's R.C.M notation.
 * R = full rotations, C = clicks (0–9), M = micro-adjustments (0–2).
 * 10 clicks = 1 rotation; 3 micro-adjustments = 1 click.
 */
function formatQAirSetting(rotations: number): string {
  const totalMicros = Math.round(rotations * 30) // 1 rotation = 30 micro-adjustments
  const r = Math.floor(totalMicros / 30)
  const remaining = totalMicros % 30
  const c = Math.floor(remaining / 3)
  const m = remaining % 3
  return `${r}.${c}.${m}`
}

export function isValidQAirSetting(value: string): boolean {
  return /^\d+\.\d\.\d$/.test(value.trim())
}

function parseQAirSetting(value: string): { rotations: number; totalMicros: number } | null {
  const trimmed = value.trim()
  if (!isValidQAirSetting(trimmed)) return null

  const [rotationsStr, majorStr, minorStr] = trimmed.split('.')
  const rotations = parseInt(rotationsStr, 10)
  const major = parseInt(majorStr, 10)
  const minor = parseInt(minorStr, 10)
  const totalMicros = rotations * 30 + major * 3 + minor

  return {
    rotations: totalMicros / 30,
    totalMicros,
  }
}

export function micronsToQAir(microns: number): number {
  return micronsToQAirRaw(microns)
}

export function kUltraRangeToQAir(
  lowClicks: number,
  highClicks: number,
  startingClicks: number,
): GrinderSetting {
  const lowMicrons = kUltraClicksToMicrons(lowClicks)
  const highMicrons = kUltraClicksToMicrons(highClicks)
  const startMicrons = kUltraClicksToMicrons(startingClicks)

  const lowSetting = micronsToQAirRaw(lowMicrons)
  const highSetting = micronsToQAirRaw(highMicrons)
  const startSetting = micronsToQAirRaw(startMicrons)

  return {
    range: `${formatQAirSetting(lowSetting)}–${formatQAirSetting(highSetting)}`,
    starting_point: formatQAirSetting(startSetting),
  }
}

// ─── Baratza Encore ESP: microns → click ─────────────────────────────────────

const BARATZA_TABLE: Array<[number, number]> = [
  [200, 1], [300, 5], [380, 8], [430, 10], [500, 12],
  [600, 14], [650, 15], [700, 16], [750, 17], [800, 18],
  [850, 19], [900, 20], [950, 21], [1000, 22], [1050, 23],
  [1100, 24], [1150, 26], [1200, 28], [1250, 30], [1350, 35], [1500, 40],
]

function micronsToBaratzaRaw(microns: number): number {
  const table = BARATZA_TABLE
  if (microns <= table[0][0]) return table[0][1]
  if (microns >= table[table.length - 1][0]) return table[table.length - 1][1]

  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (microns >= x0 && microns <= x1) {
      const t = (microns - x0) / (x1 - x0)
      return Math.round(y0 + t * (y1 - y0))
    }
  }
  return 18
}

const POUR_OVER_METHODS = new Set([
  'v60', 'origami', 'orea_v4', 'hario_switch', 'kalita_wave',
  'chemex', 'ceado_hoop', 'pulsar',
])

export function kUltraRangeToBaratza(
  lowClicks: number,
  highClicks: number,
  startingClicks: number,
  method: string,
): GrinderSetting {
  const isPourOver = POUR_OVER_METHODS.has(method)

  const lowMicrons = kUltraClicksToMicrons(lowClicks)
  const highMicrons = kUltraClicksToMicrons(highClicks)
  const startMicrons = kUltraClicksToMicrons(startingClicks)

  let lowClick = micronsToBaratzaRaw(lowMicrons)
  let highClick = micronsToBaratzaRaw(highMicrons)
  let startClick = micronsToBaratzaRaw(startMicrons)

  let note = 'Adjust ±1 click based on drain speed.'

  if (isPourOver) {
    let clamped = false

    if (lowClick < 14) { lowClick = 14; clamped = true }
    if (highClick < 14) { highClick = 14; clamped = true }
    if (startClick < 14) { startClick = 14; clamped = true }

    if (lowClick > 24) { lowClick = 24; clamped = true }
    if (highClick > 24) { highClick = 24; clamped = true }
    if (startClick > 24) { startClick = 24; clamped = true }

    if (clamped) {
      note = 'At boundary of pour-over zone (14–24). Step ±1 click based on drain speed.'
    } else {
      note = 'Within pour-over zone (14–24). Adjust ±1 click based on drain speed.'
    }
  }

  return {
    range: `clicks ${lowClick}–${highClick}`,
    starting_point: `${startClick} clicks`,
    note,
  }
}

// ─── Timemore C2: microns → click ────────────────────────────────────────────

const TIMEMORE_C2_TABLE: Array<[number, number]> = [
  [100, 2], [200, 4], [230, 6], [300, 8], [350, 10],
  [400, 12], [450, 14], [550, 16], [650, 18], [750, 20],
  [870, 22], [950, 24], [1050, 26], [1200, 28], [1400, 30],
]

function micronsToTimemoreC2Raw(microns: number): number {
  const table = TIMEMORE_C2_TABLE
  if (microns <= table[0][0]) return table[0][1]
  if (microns >= table[table.length - 1][0]) return table[table.length - 1][1]

  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (microns >= x0 && microns <= x1) {
      const t = (microns - x0) / (x1 - x0)
      return Math.round(y0 + t * (y1 - y0))
    }
  }
  return 20
}

export function kUltraRangeToTimemoreC2(
  lowClicks: number,
  highClicks: number,
  startingClicks: number,
  method: string,
): GrinderSetting {
  const isPourOver = POUR_OVER_METHODS.has(method)

  const lowMicrons = kUltraClicksToMicrons(lowClicks)
  const highMicrons = kUltraClicksToMicrons(highClicks)
  const startMicrons = kUltraClicksToMicrons(startingClicks)

  let lowClick = micronsToTimemoreC2Raw(lowMicrons)
  let highClick = micronsToTimemoreC2Raw(highMicrons)
  let startClick = micronsToTimemoreC2Raw(startMicrons)

  let note = 'Adjust ±1 click based on drain speed.'

  if (isPourOver) {
    let clamped = false

    if (lowClick < 14) { lowClick = 14; clamped = true }
    if (highClick < 14) { highClick = 14; clamped = true }
    if (startClick < 14) { startClick = 14; clamped = true }

    if (lowClick > 22) { lowClick = 22; clamped = true }
    if (highClick > 22) { highClick = 22; clamped = true }
    if (startClick > 22) { startClick = 22; clamped = true }

    if (clamped) {
      note = 'At boundary of pour-over zone (14–22). Step ±1 click based on drain speed.'
    } else {
      note = 'Within pour-over zone (14–22). Adjust ±1 click based on drain speed.'
    }
  }

  return {
    range: `clicks ${lowClick}–${highClick}`,
    starting_point: `${startClick} clicks`,
    note,
  }
}

// ─── Parse K-Ultra click range from a string like "81–84 clicks" ─────────────

export function parseKUltraRange(rangeStr: string): { low: number; high: number; mid: number } | null {
  const match = rangeStr.match(/(\d+)[–—-](\d+)/)
  if (!match) return null
  const low = parseInt(match[1], 10)
  const high = parseInt(match[2], 10)
  const mid = Math.round((low + high) / 2)
  return { low, high, mid }
}

export function isValidKUltraSetting(value: string): boolean {
  return K_ULTRA_NOTATION_REGEX.test(value.trim())
}

export function formatKUltraSetting(clicks: number): string {
  const normalized = Math.max(0, Math.round(clicks))
  const rotations = Math.floor(normalized / K_ULTRA_FULL_ROTATION_CLICKS)
  const remaining = normalized % K_ULTRA_FULL_ROTATION_CLICKS
  const number = Math.floor(remaining / K_ULTRA_NUMBER_CLICKS)
  const tick = remaining % K_ULTRA_NUMBER_CLICKS
  return `${rotations}.${number}.${tick}`
}

export function parseKUltraSetting(value: string): number | null {
  const trimmed = value.trim()
  if (!isValidKUltraSetting(trimmed)) return null
  const [rotationsRaw, numberRaw = '0', tickRaw = '0'] = trimmed.split('.')
  const rotations = parseInt(rotationsRaw, 10)
  const number = parseInt(numberRaw, 10)
  const tick = parseInt(tickRaw, 10)
  if (
    Number.isNaN(rotations)
    || Number.isNaN(number)
    || Number.isNaN(tick)
    || number < 0
    || number > 9
    || tick < 0
    || tick > 9
  ) {
    return null
  }

  return rotations * K_ULTRA_FULL_ROTATION_CLICKS + number * K_ULTRA_NUMBER_CLICKS + tick
}

// ─── Back-conversion utilities (for edit mode) ────────────────────────────────

// Inverse of K_ULTRA_TABLE: microns → K-Ultra clicks
export function micronsToKUltraClicks(microns: number): number {
  const table = K_ULTRA_TABLE
  if (microns <= table[0][1]) return table[0][0]
  if (microns >= table[table.length - 1][1]) return table[table.length - 1][0]
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (microns >= y0 && microns <= y1) {
      const t = (microns - y0) / (y1 - y0)
      return Math.round(x0 + t * (x1 - x0))
    }
  }
  return Math.round(microns / 11)
}

// Inverse of Q_AIR_TABLE: rotations → microns
function qAirRotationsToMicrons(rotations: number): number {
  const table = Q_AIR_TABLE
  if (rotations <= table[0][1]) return table[0][0]
  if (rotations >= table[table.length - 1][1]) return table[table.length - 1][0]
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (rotations >= y0 && rotations <= y1) {
      const t = (rotations - y0) / (y1 - y0)
      return Math.round(x0 + t * (x1 - x0))
    }
  }
  return 700
}

// Inverse of BARATZA_TABLE: clicks → microns
function baratzaClicksToMicrons(clicks: number): number {
  const table = BARATZA_TABLE
  if (clicks <= table[0][1]) return table[0][0]
  if (clicks >= table[table.length - 1][1]) return table[table.length - 1][0]
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (clicks >= y0 && clicks <= y1) {
      const t = (clicks - y0) / (y1 - y0)
      return Math.round(x0 + t * (x1 - x0))
    }
  }
  return 800
}

// Inverse of TIMEMORE_C2_TABLE: clicks → microns
function timemoreC2ClicksToMicrons(clicks: number): number {
  const table = TIMEMORE_C2_TABLE
  if (clicks <= table[0][1]) return table[0][0]
  if (clicks >= table[table.length - 1][1]) return table[table.length - 1][0]
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (clicks >= y0 && clicks <= y1) {
      const t = (clicks - y0) / (y1 - y0)
      return Math.round(x0 + t * (x1 - x0))
    }
  }
  return 800
}

/**
 * Parse a grinder's starting_point string into a plain integer for use in edit inputs.
 * - K-Ultra / Baratza / Timemore: extract the number from "81 clicks" or "clicks 81"
 * - Q-Air: parse R.C.M → total Q-Air clicks (R*10 + C), ignoring micro-adjustments
 */
export function parseGrinderValueForEdit(grinder: string, startingPoint: string): GrinderEditValue {
  if (grinder === 'q_air') {
    return isValidQAirSetting(startingPoint) ? startingPoint.trim() : '1.2.0'
  }
  if (grinder === 'k_ultra') {
    const parsedKUltra = parseKUltraSetting(startingPoint)
    if (parsedKUltra !== null) return formatKUltraSetting(parsedKUltra)
  }
  const match = startingPoint.match(/(\d+)/)
  if (!match) return grinder === 'k_ultra' ? '0.8.0' : 80
  return grinder === 'k_ultra'
    ? formatKUltraSetting(parseInt(match[1], 10))
    : parseInt(match[1], 10)
}

/**
 * Convert a grinder's edit-input value to K-Ultra clicks.
 * - K-Ultra: identity
 * - Q-Air: total Q-Air clicks → rotations → microns → K-Ultra clicks
 * - Baratza / Timemore C2: clicks → microns → K-Ultra clicks
 */
export function grinderValueToKUltraClicks(grinder: string, value: GrinderEditValue): number {
  if (grinder === 'k_ultra') {
    if (typeof value === 'string') {
      const parsed = parseKUltraSetting(value)
      if (parsed !== null) return parsed
      // Backward compatibility: legacy persisted values use "NN clicks".
      const legacyMatch = value.match(/(\d+)/)
      if (legacyMatch) return parseInt(legacyMatch[1], 10)
      return Math.round(Number(value))
    }
    return Math.round(Number(value))
  }
  if (grinder === 'q_air') {
    const parsed = typeof value === 'string' ? parseQAirSetting(value) : null
    const microns = qAirRotationsToMicrons(parsed?.rotations ?? 1.2)
    return micronsToKUltraClicks(microns)
  }
  if (grinder === 'baratza_encore_esp') {
    return micronsToKUltraClicks(baratzaClicksToMicrons(Number(value)))
  }
  if (grinder === 'timemore_c2') {
    return micronsToKUltraClicks(timemoreC2ClicksToMicrons(Number(value)))
  }
  return Math.round(Number(value))
}

/**
 * Convert K-Ultra clicks to the preferred grinder's edit-input value.
 * - K-Ultra: identity
 * - Q-Air: microns → rotations → total Q-Air clicks (integer)
 * - Baratza / Timemore C2: microns → clicks (integer)
 */
export function kUltraClicksToGrinderValue(grinder: string, clicks: number): GrinderEditValue {
  if (grinder === 'k_ultra') return formatKUltraSetting(clicks)
  if (grinder === 'q_air') {
    const microns = kUltraClicksToMicrons(clicks)
    const rotations = micronsToQAirRaw(microns)
    return formatQAirSetting(rotations)
  }
  if (grinder === 'baratza_encore_esp') {
    return micronsToBaratzaRaw(kUltraClicksToMicrons(clicks))
  }
  if (grinder === 'timemore_c2') {
    return micronsToTimemoreC2Raw(kUltraClicksToMicrons(clicks))
  }
  return clicks
}

/**
 * Parse the K-Ultra final_operating_range and return low/high in the preferred grinder's units.
 */
export function parseGrinderRange(grinder: string, kUltraRangeStr: string): { low: number; high: number } | null {
  const parsed = parseKUltraRange(kUltraRangeStr)
  if (!parsed) return null
  if (grinder === 'k_ultra') {
    return { low: parsed.low, high: parsed.high }
  }
  return {
    low: Number(kUltraClicksToGrinderValue(grinder, parsed.low)),
    high: Number(kUltraClicksToGrinderValue(grinder, parsed.high)),
  }
}

export function formatGrinderSettingForDisplay(grinder: string, value: string): string {
  if (grinder === 'q_air') return value
  if (grinder === 'k_ultra') {
    const parsed = parseKUltraSetting(value)
    if (parsed !== null) return value
    const numericMatch = value.match(/(\d+)/)
    if (!numericMatch) return value
    return formatKUltraSetting(parseInt(numericMatch[1], 10))
  }
  return value.replace(/^clicks?\s+(\d+)$/i, '$1 clicks')
}

export function formatGrinderRangeForEdit(grinder: string, kUltraRangeStr: string): string | null {
  const parsed = parseKUltraRange(kUltraRangeStr)
  if (!parsed) return null

  if (grinder === 'q_air') {
    const low = kUltraClicksToGrinderValue(grinder, parsed.low)
    const high = kUltraClicksToGrinderValue(grinder, parsed.high)
    return `${low}–${high}`
  }

  const numericRange = parseGrinderRange(grinder, kUltraRangeStr)
  if (!numericRange) return null
  if (grinder === 'k_ultra') {
    return `${formatKUltraSetting(numericRange.low)}–${formatKUltraSetting(numericRange.high)}`
  }
  return `${numericRange.low}–${numericRange.high} clicks`
}
