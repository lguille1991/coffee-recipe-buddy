// Grind adjustment engine for pour-over recipe scaling.
// Formula: ΔG = kd * ln(D2/D1) + kr * ln(R2/R1)
// Positive ΔG = coarser. Negative ΔG = finer.

const KD = 6    // dose coefficient — bed depth/flow dominates
const KR = 2.5  // ratio coefficient — extraction adjustment, softer effect

export type GrindDirection = 'coarser' | 'finer' | 'none'
export type GrindMagnitude = 'none' | 'slight' | 'moderate' | 'strong'

export interface GrindScalingResult {
  deltaG: number
  deltaKUltraClicks: number
  direction: GrindDirection
  magnitude: GrindMagnitude
}

export function computeGrindScalingDelta(
  d1: number,
  d2: number,
  r1: number,
  r2: number,
): GrindScalingResult {
  const invalid = (v: number) => v <= 0 || !isFinite(v)
  if (invalid(d1) || invalid(d2) || invalid(r1) || invalid(r2)) {
    return { deltaG: 0, deltaKUltraClicks: 0, direction: 'none', magnitude: 'none' }
  }

  const deltaG = KD * Math.log(d2 / d1) + KR * Math.log(r2 / r1)
  const deltaKUltraClicks = Math.round(deltaG)
  const absG = Math.abs(deltaG)

  const direction: GrindDirection =
    deltaKUltraClicks === 0 ? 'none' : deltaG > 0 ? 'coarser' : 'finer'

  const magnitude: GrindMagnitude =
    absG < 0.5 ? 'none' :
    absG < 1.5 ? 'slight' :
    absG < 3.0 ? 'moderate' : 'strong'

  return { deltaG, deltaKUltraClicks, direction, magnitude }
}
