import type { BeanProfile } from '@/types/recipe'

export const DUPLICATE_KEY_FIELDS = [
  'label',
  'roaster',
  'bean_name',
  'origin',
  'process',
  'roast_level',
] as const

type DuplicateKeyField = typeof DUPLICATE_KEY_FIELDS[number]

export type DuplicateProfileInput = {
  label: string
  bean_profile_json: Pick<BeanProfile, 'roaster' | 'bean_name' | 'origin' | 'process' | 'roast_level'>
}

export type DuplicateCandidate = {
  id: string
  label: string
  bean_profile_json: {
    roaster?: string | null
    bean_name?: string | null
    origin?: string | null
    process: string
    roast_level: string
  }
  created_at: string
  updated_at: string
}

function normalizeString(value: string | null | undefined): string {
  if (!value) return ''
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function buildDuplicateFingerprint(input: DuplicateProfileInput): string {
  const normalized: Record<DuplicateKeyField, string> = {
    label: normalizeString(input.label),
    roaster: normalizeString(input.bean_profile_json.roaster),
    bean_name: normalizeString(input.bean_profile_json.bean_name),
    origin: normalizeString(input.bean_profile_json.origin),
    process: normalizeString(input.bean_profile_json.process),
    roast_level: normalizeString(input.bean_profile_json.roast_level),
  }

  return DUPLICATE_KEY_FIELDS.map(key => `${key}=${normalized[key]}`).join('|')
}

export function sortDuplicateCandidates(candidates: DuplicateCandidate[]): DuplicateCandidate[] {
  return [...candidates].sort((a, b) => {
    const updatedDiff = Date.parse(b.updated_at) - Date.parse(a.updated_at)
    if (updatedDiff !== 0) return updatedDiff
    return Date.parse(b.created_at) - Date.parse(a.created_at)
  })
}

