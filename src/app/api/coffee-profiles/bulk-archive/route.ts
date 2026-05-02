import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'

const BulkArchiveProfilesRequestSchema = z.object({
  profile_ids: z.array(z.string().uuid()).min(1).max(2000),
})

export async function POST(request: Request) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = BulkArchiveProfilesRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const profileIds = Array.from(new Set(parsed.data.profile_ids))

  const { data: activeLinkedRows, error: linkedError } = await supabase
    .from('recipes')
    .select('coffee_profile_id')
    .eq('user_id', user.id)
    .eq('archived', false)
    .in('coffee_profile_id', profileIds)

  if (linkedError) {
    return NextResponse.json({ error: linkedError.message }, { status: 500 })
  }

  const blockedProfileIds = Array.from(new Set(
    ((activeLinkedRows ?? []) as Array<{ coffee_profile_id: string | null }>)
      .map(row => row.coffee_profile_id)
      .filter((id): id is string => Boolean(id)),
  ))

  const archiveCandidates = profileIds.filter(id => !blockedProfileIds.includes(id))

  const { data: archivedRows, error: archiveError } = archiveCandidates.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('coffee_profiles')
      .update({ archived_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', archiveCandidates)
      .is('archived_at', null)
      .select('id')

  if (archiveError) {
    return NextResponse.json({ error: archiveError.message }, { status: 500 })
  }

  const archivedIds = ((archivedRows ?? []) as Array<{ id: string }>).map(row => row.id)
  return NextResponse.json({
    success: true,
    archived_ids: archivedIds,
    archived_count: archivedIds.length,
    blocked_profile_ids: blockedProfileIds,
    blocked_count: blockedProfileIds.length,
    requested_count: profileIds.length,
  })
}
