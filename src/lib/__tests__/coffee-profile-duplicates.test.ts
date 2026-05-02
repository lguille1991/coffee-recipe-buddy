import { describe, expect, it } from 'vitest'
import { buildDuplicateFingerprint, sortDuplicateCandidates } from '@/lib/coffee-profile-duplicates'

describe('coffee-profile-duplicates', () => {
  it('normalizes whitespace, case, and optional blanks when building fingerprint', () => {
    const a = buildDuplicateFingerprint({
      label: '  El  Mirador ',
      bean_profile_json: {
        roaster: '  ACME Roasters  ',
        bean_name: ' Pink Bourbon ',
        origin: '  Colombia  ',
        process: 'Washed',
        roast_level: 'Medium-Light',
      },
    })

    const b = buildDuplicateFingerprint({
      label: 'el mirador',
      bean_profile_json: {
        roaster: 'acme roasters',
        bean_name: 'pink bourbon',
        origin: 'colombia',
        process: 'washed',
        roast_level: 'medium-light',
      },
    })

    expect(a).toBe(b)
  })

  it('treats missing optional fields as empty strings', () => {
    const fingerprint = buildDuplicateFingerprint({
      label: 'Coffee',
      bean_profile_json: {
        roaster: undefined,
        bean_name: null,
        origin: undefined,
        process: 'unknown',
        roast_level: 'medium',
      },
    })

    expect(fingerprint).toContain('roaster=')
    expect(fingerprint).toContain('bean_name=')
    expect(fingerprint).toContain('origin=')
  })

  it('sorts candidates by updated_at desc then created_at desc', () => {
    const sorted = sortDuplicateCandidates([
      {
        id: 'older',
        label: 'A',
        bean_profile_json: { process: 'washed', roast_level: 'medium' },
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'newer',
        label: 'A',
        bean_profile_json: { process: 'washed', roast_level: 'medium' },
        created_at: '2026-05-02T00:00:00.000Z',
        updated_at: '2026-05-03T00:00:00.000Z',
      },
    ])

    expect(sorted[0]?.id).toBe('newer')
  })
})
