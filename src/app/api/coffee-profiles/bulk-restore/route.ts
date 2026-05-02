import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildDuplicateFingerprint } from '@/lib/coffee-profile-duplicates'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'

const BulkRestoreProfilesRequestSchema = z.object({
  profile_ids: z.array(z.string().uuid()).min(1).max(2000),
})

type ProfileRow = {
  id: string
  label: string
  archived_at: string | null
  duplicate_fingerprint: string | null
  bean_profile_json: {
    roaster?: string | null
    bean_name?: string | null
    origin?: string | null
    process?: string | null
    roast_level?: string | null
  }
}

export async function POST(request: Request) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = BulkRestoreProfilesRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const profileIds = Array.from(new Set(parsed.data.profile_ids))
  const { data: selectedRows, error: selectedError } = await supabase
    .from('coffee_profiles')
    .select('id, label, archived_at, duplicate_fingerprint, bean_profile_json')
    .eq('user_id', user.id)
    .in('id', profileIds)

  if (selectedError) {
    return NextResponse.json({ error: selectedError.message }, { status: 500 })
  }

  const selected = ((selectedRows ?? []) as ProfileRow[]).filter(row => row.archived_at != null)
  const selectedById = new Map(selected.map(row => [row.id, row]))

  const fingerprints = Array.from(new Set(selected.map(row => {
    if (row.duplicate_fingerprint) return row.duplicate_fingerprint
    return buildDuplicateFingerprint({
      label: row.label,
      bean_profile_json: {
        roaster: row.bean_profile_json.roaster,
        bean_name: row.bean_profile_json.bean_name,
        origin: row.bean_profile_json.origin,
        process: row.bean_profile_json.process ?? 'unknown',
        roast_level: row.bean_profile_json.roast_level ?? 'medium',
      },
    })
  })))

  const { data: activeRows, error: activeError } = fingerprints.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('coffee_profiles')
      .select('id, duplicate_fingerprint')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .in('duplicate_fingerprint', fingerprints)

  if (activeError) {
    return NextResponse.json({ error: activeError.message }, { status: 500 })
  }

  const activeFingerprintSet = new Set(
    ((activeRows ?? []) as Array<{ id: string; duplicate_fingerprint: string | null }>)
      .map(row => row.duplicate_fingerprint)
      .filter((fp): fp is string => Boolean(fp)),
  )

  const blockedProfileIds = selected
    .filter(row => {
      const fp = row.duplicate_fingerprint ?? buildDuplicateFingerprint({
        label: row.label,
        bean_profile_json: {
          roaster: row.bean_profile_json.roaster,
          bean_name: row.bean_profile_json.bean_name,
          origin: row.bean_profile_json.origin,
          process: row.bean_profile_json.process ?? 'unknown',
          roast_level: row.bean_profile_json.roast_level ?? 'medium',
        },
      })
      return activeFingerprintSet.has(fp)
    })
    .map(row => row.id)

  const restoreCandidates = profileIds.filter(id => selectedById.has(id) && !blockedProfileIds.includes(id))

  const { data: restoredRows, error: restoreError } = restoreCandidates.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('coffee_profiles')
      .update({ archived_at: null })
      .eq('user_id', user.id)
      .in('id', restoreCandidates)
      .not('archived_at', 'is', null)
      .select('id')

  if (restoreError) {
    return NextResponse.json({ error: restoreError.message }, { status: 500 })
  }

  const restoredIds = ((restoredRows ?? []) as Array<{ id: string }>).map(row => row.id)
  return NextResponse.json({
    success: true,
    restored_ids: restoredIds,
    restored_count: restoredIds.length,
    blocked_profile_ids: blockedProfileIds,
    blocked_count: blockedProfileIds.length,
    requested_count: profileIds.length,
  })
}
