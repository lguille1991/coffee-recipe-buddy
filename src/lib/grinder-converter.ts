// Grinder conversion utilities.
// K-Ultra is the primary reference. All conversions go through microns.

export interface GrinderSetting {
  range: string
  starting_point: string
  description?: string
  note?: string
}

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

// ─── Q-Air: microns → setting ────────────────────────────────────────────────

const Q_AIR_TABLE: Array<[number, number]> = [
  [300, 1.0], [350, 1.5], [400, 2.0], [450, 2.5], [500, 3.0],
  [560, 3.5], [620, 4.0], [680, 4.5], [740, 5.0], [800, 5.5],
  [840, 5.8], [870, 6.0], [900, 6.2], [930, 6.5], [960, 6.8],
  [990, 7.0], [1010, 7.2], [1050, 7.5], [1100, 8.0], [1150, 8.5],
  [1200, 9.0], [1300, 10.0],
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
      return Math.round((y0 + t * (y1 - y0)) * 10) / 10
    }
  }
  return 6.0
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
    range: `${lowSetting.toFixed(1)}–${highSetting.toFixed(1)}`,
    starting_point: startSetting.toFixed(1),
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
    starting_point: `click ${startClick}`,
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
