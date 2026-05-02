import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createCoffeeProfileSignedUrl, replaceCoffeeProfilePrimaryImage } from '@/lib/coffee-profile-storage'
import { buildDuplicateFingerprint, sortDuplicateCandidates, type DuplicateCandidate } from '@/lib/coffee-profile-duplicates'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import { CreateCoffeeProfileRequestSchema } from '@/types/coffee-profile'

const DEFAULT_LIMIT = 20

const CreateCoffeeProfileWithImageSchema = CreateCoffeeProfileRequestSchema.extend({
  image_data_url: z.string().optional(),
  image_mime_type: z.string().optional(),
})

type ProfileRow = {
  id: string
  user_id: string
  bean_profile_json: {
    roaster?: string | null
    roast_level?: string | null
  }
  label: string
  scan_source: 'scan' | 'manual' | 'mixed'
  created_at: string
  updated_at: string
  last_used_at: string | null
  archived_at: string | null
}

type DuplicateRow = DuplicateCandidate & {
  archived_at: string | null
  duplicate_fingerprint: string | null
}

type ImageRow = {
  id: string
  coffee_profile_id: string
  storage_path: string
}

export async function POST(request: Request) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateCoffeeProfileWithImageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const {
    label,
    bean_profile_json,
    scan_source,
    image_data_url,
    image_mime_type,
  } = parsed.data
  const duplicateFingerprint = parsed.data.duplicate_fingerprint ?? buildDuplicateFingerprint({
    label,
    bean_profile_json: {
      roaster: bean_profile_json.roaster,
      bean_name: bean_profile_json.bean_name,
      origin: bean_profile_json.origin,
      process: bean_profile_json.process,
      roast_level: bean_profile_json.roast_level,
    },
  })

  const { data: duplicateRows, error: duplicateError } = await supabase
    .from('coffee_profiles')
    .select('id, label, bean_profile_json, created_at, updated_at, archived_at, duplicate_fingerprint')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .eq('duplicate_fingerprint', duplicateFingerprint)

  if (duplicateError) {
    return NextResponse.json({ error: duplicateError.message }, { status: 500 })
  }

  const duplicateCandidates = sortDuplicateCandidates(
    ((duplicateRows ?? []) as DuplicateRow[]).map(row => ({
      id: row.id,
      label: row.label,
      bean_profile_json: {
        roaster: row.bean_profile_json.roaster ?? null,
        bean_name: row.bean_profile_json.bean_name ?? null,
        origin: row.bean_profile_json.origin ?? null,
        process: row.bean_profile_json.process ?? 'unknown',
        roast_level: row.bean_profile_json.roast_level ?? 'medium',
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
  )

  if (duplicateCandidates.length > 0) {
    return NextResponse.json({
      status: 'duplicate_blocked',
      error: 'An active coffee profile with the same label and bean attributes already exists',
      candidates: duplicateCandidates,
      selected_candidate_id: duplicateCandidates[0].id,
    }, { status: 409 })
  }

  const { data: profile, error } = await supabase
    .from('coffee_profiles')
    .insert({
      user_id: user.id,
      label,
      bean_profile_json,
      scan_source,
      duplicate_fingerprint: duplicateFingerprint,
    })
    .select()
    .single()

  if (error || !profile) {
    if ((error as { code?: string } | null)?.code === '23505') {
      const { data: existingRows } = await supabase
        .from('coffee_profiles')
        .select('id, label, bean_profile_json, created_at, updated_at')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .eq('duplicate_fingerprint', duplicateFingerprint)

      const candidates = sortDuplicateCandidates(((existingRows ?? []) as DuplicateCandidate[]).map(row => ({
        id: row.id,
        label: row.label,
        bean_profile_json: row.bean_profile_json,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })))

      if (candidates.length > 0) {
        return NextResponse.json({
          status: 'duplicate_blocked',
          error: 'An active coffee profile with the same label and bean attributes already exists',
          candidates,
          selected_candidate_id: candidates[0].id,
        }, { status: 409 })
      }
    }

    return NextResponse.json({ error: error?.message ?? 'Failed to create profile' }, { status: 500 })
  }

  let primaryImage: { id: string; signed_url: string | null } | null = null
  let primaryImageError: string | null = null

  if (image_data_url) {
    try {
      const mimeMatch = image_data_url.match(/^data:([^;]+);base64,/)
      const base64Data = image_data_url.split(',')[1]
      if (!mimeMatch || !base64Data) {
        throw new Error('Invalid image_data_url')
      }

      const uploaded = await replaceCoffeeProfilePrimaryImage(supabase, {
        userId: user.id,
        profileId: profile.id,
        buffer: Buffer.from(base64Data, 'base64'),
        mimeType: image_mime_type ?? mimeMatch[1],
      })
      const signedUrl = await createCoffeeProfileSignedUrl(supabase, uploaded.storage_path)
      primaryImage = { id: uploaded.id, signed_url: signedUrl }
    } catch (error) {
      primaryImageError = error instanceof Error ? error.message : 'Failed to upload profile image'
    }
  }

  return NextResponse.json({
    status: 'created',
    profile,
    primary_image: primaryImage,
    primary_image_error: primaryImageError,
    primary_image_status: primaryImage
      ? 'uploaded'
      : primaryImageError
        ? 'failed'
        : 'none',
  }, { status: 201 })
}

export async function GET(request: Request) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10), 1), 50)
  const archived = searchParams.get('archived') === 'true'

  let listQuery = supabase
    .from('coffee_profiles')
    .select('id, user_id, bean_profile_json, label, scan_source, created_at, updated_at, last_used_at, archived_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  listQuery = archived
    ? listQuery.not('archived_at', 'is', null)
    : listQuery.is('archived_at', null)

  const { data, error } = await listQuery.limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const filtered = (data ?? []) as ProfileRow[]

  const profileIds = filtered.map(row => row.id)
  const { data: images, error: imagesError } = profileIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('coffee_profile_images')
      .select('id, coffee_profile_id, storage_path')
      .in('coffee_profile_id', profileIds)
      .eq('user_id', user.id)
      .eq('is_primary', true)

  if (imagesError) {
    return NextResponse.json({ error: imagesError.message }, { status: 500 })
  }

  const imageByProfileId = new Map<string, { id: string; signed_url: string | null }>()
  await Promise.all(((images ?? []) as ImageRow[]).map(async image => {
    const signedUrl = await createCoffeeProfileSignedUrl(supabase, image.storage_path)
    imageByProfileId.set(image.coffee_profile_id, { id: image.id, signed_url: signedUrl })
  }))

  return NextResponse.json({
    profiles: filtered.map(row => ({
      ...row,
      primary_image: imageByProfileId.get(row.id) ?? null,
    })),
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
