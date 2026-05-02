import { NextResponse } from 'next/server'
import { buildDuplicateFingerprint, sortDuplicateCandidates, type DuplicateCandidate } from '@/lib/coffee-profile-duplicates'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import type { BeanProfile } from '@/types/recipe'

type Params = { params: Promise<{ id: string }> }

type ProfileRow = {
  id: string
  user_id: string
  label: string
  bean_profile_json: {
    roaster?: string | null
    bean_name?: string | null
    origin?: string | null
    process?: string | null
    roast_level?: string | null
  }
  archived_at: string | null
  duplicate_fingerprint: string | null
}

const PROCESS_VALUES: ReadonlySet<BeanProfile['process']> = new Set([
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'carbonic',
  'thermal_shock',
  'experimental',
  'unknown',
])

const ROAST_VALUES: ReadonlySet<BeanProfile['roast_level']> = new Set([
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark',
])

function normalizeProcess(value: string | null | undefined): BeanProfile['process'] {
  if (value && PROCESS_VALUES.has(value as BeanProfile['process'])) {
    return value as BeanProfile['process']
  }
  return 'unknown'
}

function normalizeRoastLevel(value: string | null | undefined): BeanProfile['roast_level'] {
  if (value && ROAST_VALUES.has(value as BeanProfile['roast_level'])) {
    return value as BeanProfile['roast_level']
  }
  return 'medium'
}

export async function POST(_request: Request, { params }: Params) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('coffee_profiles')
    .select('id, user_id, label, bean_profile_json, archived_at, duplicate_fingerprint')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle<ProfileRow>()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile || !profile.archived_at) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const duplicateFingerprint = profile.duplicate_fingerprint ?? buildDuplicateFingerprint({
    label: profile.label,
    bean_profile_json: {
      roaster: profile.bean_profile_json.roaster,
      bean_name: profile.bean_profile_json.bean_name,
      origin: profile.bean_profile_json.origin,
      process: normalizeProcess(profile.bean_profile_json.process),
      roast_level: normalizeRoastLevel(profile.bean_profile_json.roast_level),
    },
  })

  const { data: restored, error: restoreError } = await supabase
    .from('coffee_profiles')
    .update({ archived_at: null, duplicate_fingerprint: duplicateFingerprint })
    .eq('id', id)
    .eq('user_id', user.id)
    .not('archived_at', 'is', null)
    .select()
    .single<ProfileRow>()

  if (restoreError) {
    if (restoreError.code === '23505') {
      const { data: duplicates } = await supabase
        .from('coffee_profiles')
        .select('id, label, bean_profile_json, created_at, updated_at')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .eq('duplicate_fingerprint', duplicateFingerprint)
        .neq('id', id)

      const candidates = sortDuplicateCandidates((duplicates ?? []) as DuplicateCandidate[])
      if (candidates.length > 0) {
        return NextResponse.json({
          status: 'duplicate_blocked',
          error: 'An active coffee profile with the same label and bean attributes already exists',
          candidates,
          selected_candidate_id: candidates[0].id,
        }, { status: 409 })
      }
    }

    return NextResponse.json({ error: restoreError.message }, { status: 500 })
  }

  if (!restored) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(restored)
}
