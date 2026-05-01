import type { BeanProfile } from '@/types/recipe'

export interface MethodGrindBase {
  low: number
  high: number
  label: string
}

export interface MethodTempBase {
  low: number
  high: number
}

export const METHOD_GRIND_BASES: Record<string, MethodGrindBase> = {
  v60: { low: 53, high: 92, label: 'V60 base (0.5.3–0.9.2)' },
  origami: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  orea_v4: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  hario_switch: { low: 60, high: 100, label: 'Steep-and-release base (0.6.0–1.0.0)' },
  kalita_wave: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  chemex: { low: 70, high: 100, label: 'Chemex-leaning coarse base' },
  ceado_hoop: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  pulsar: { low: 54, high: 100, label: 'Pour-over base (0.5.4–1.0.0)' },
  aeropress: { low: 43, high: 100, label: 'AeroPress base (0.4.3–1.0.0)' },
}

export const METHOD_TEMP_BASES: Record<string, MethodTempBase> = {
  v60: { low: 92, high: 94 },
  origami: { low: 92, high: 94 },
  orea_v4: { low: 92, high: 94 },
  hario_switch: { low: 91, high: 94 },
  kalita_wave: { low: 91, high: 93 },
  chemex: { low: 92, high: 94 },
  ceado_hoop: { low: 91, high: 94 },
  pulsar: { low: 91, high: 94 },
  aeropress: { low: 88, high: 92 },
}

export function grindProcessOffset(process: BeanProfile['process']): number {
  switch (process) {
    case 'washed':
      return -1
    case 'natural':
      return 2
    case 'honey':
      return 1
    case 'anaerobic':
      return 2
    case 'unknown':
    default:
      return 0
  }
}

export function grindRoastOffset(roast: BeanProfile['roast_level']): number {
  switch (roast) {
    case 'light':
      return -1
    case 'medium-dark':
      return 1
    case 'dark':
      return 2
    case 'medium-light':
    case 'medium':
    default:
      return 0
  }
}

export function grindAltitudeOffset(altitudeMasl?: number | null): number {
  if (!altitudeMasl) return 0
  if (altitudeMasl >= 1400) return -1
  if (altitudeMasl < 1000) return 1
  return 0
}

export function grindOriginOffset(origin?: string | null): number {
  const normalized = (origin ?? '').trim().toLowerCase()
  if (!normalized) return 0
  if (/\b(?:brazil|cerrado)\b/.test(normalized)) return 1
  if (/\b(?:ethiopia|yirgacheffe|sidamo)\b/.test(normalized)) return -1
  return 0
}

export function grindVarietyOffset(variety?: string | null): number {
  const normalized = (variety ?? '').trim().toLowerCase()
  if (!normalized) return 0
  if (/\bpacamara|maragogipe\b/.test(normalized)) return 1
  if (/\bgesha|geisha|heirloom\b/.test(normalized)) return -1
  if (/\bcatimor|robusta\b/.test(normalized)) return 1
  return 0
}

export function temperatureProcessOffset(process: BeanProfile['process']): number {
  switch (process) {
    case 'washed':
      return 1
    case 'natural':
      return -1
    case 'honey':
      return 0
    case 'anaerobic':
      return -2
    case 'unknown':
    default:
      return 0
  }
}

export function temperatureRoastOffset(roast: BeanProfile['roast_level']): number {
  switch (roast) {
    case 'light':
      return 1
    case 'medium-dark':
      return -1
    case 'dark':
      return -2
    case 'medium-light':
    case 'medium':
    default:
      return 0
  }
}

export function temperatureOriginOffset(origin?: string | null): number {
  const normalized = (origin ?? '').trim().toLowerCase()
  if (!normalized) return 0
  if (/\b(?:panama|gesha)\b/.test(normalized)) return -1
  if (/\b(?:ethiopia|kenya|brazil)\b/.test(normalized)) return 1
  if (/\byemen\b/.test(normalized)) return -1
  return 0
}

export function temperatureVarietyOffset(variety?: string | null): number {
  const normalized = (variety ?? '').trim().toLowerCase()
  if (!normalized) return 0
  if (/\bgesha|geisha\b/.test(normalized)) return -1
  return 0
}

