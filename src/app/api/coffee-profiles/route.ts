import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createCoffeeProfileSignedUrl, uploadCoffeeProfileImage } from '@/lib/coffee-profile-storage'
import { createClient } from '@/lib/supabase/server'
import { CreateCoffeeProfileRequestSchema } from '@/types/coffee-profile'

const DEFAULT_LIMIT = 20

const CreateCoffeeProfileWithImageSchema = CreateCoffeeProfileRequestSchema.extend({
  image_data_url: z.string().optional(),
  image_width: z.number().int().positive().optional(),
  image_height: z.number().int().positive().optional(),
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

type ImageRow = {
  id: string
  coffee_profile_id: string
  storage_path: string
}

export async function POST(request: Request) {
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
    image_width,
    image_height,
    image_mime_type,
  } = parsed.data

  const { data: profile, error } = await supabase
    .from('coffee_profiles')
    .insert({
      user_id: user.id,
      label,
      bean_profile_json,
      scan_source,
    })
    .select()
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create profile' }, { status: 500 })
  }

  let primaryImage: { id: string; signed_url: string | null } | null = null

  if (image_data_url && image_width && image_height) {
    try {
      const uploaded = await uploadCoffeeProfileImage(supabase, {
        userId: user.id,
        profileId: profile.id,
        imageDataUrl: image_data_url,
        width: image_width,
        height: image_height,
        mimeType: image_mime_type,
      })
      const signedUrl = await createCoffeeProfileSignedUrl(supabase, uploaded.storage_path)
      primaryImage = { id: uploaded.id, signed_url: signedUrl }
    } catch {
      // Keep profile even if image upload fails; client can retry upload.
    }
  }

  return NextResponse.json({ profile, primary_image: primaryImage }, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10), 1), 50)
  const archived = searchParams.get('archived') === 'true'

  const { data, error } = await supabase
    .from('coffee_profiles')
    .select('id, user_id, bean_profile_json, label, scan_source, created_at, updated_at, last_used_at, archived_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const filtered = ((data ?? []) as ProfileRow[]).filter(row => archived ? row.archived_at !== null : row.archived_at === null)

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
