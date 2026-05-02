import { NextResponse } from 'next/server'
import { createCoffeeProfileSignedUrl } from '@/lib/coffee-profile-storage'
import { buildDuplicateFingerprint, sortDuplicateCandidates, type DuplicateCandidate } from '@/lib/coffee-profile-duplicates'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import { UpdateCoffeeProfileRequestSchema } from '@/types/coffee-profile'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: profile, error }, { data: imageData }, { data: linkedRecipes }] = await Promise.all([
    supabase
      .from('coffee_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('coffee_profile_images')
      .select('id, storage_path')
      .eq('coffee_profile_id', id)
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .maybeSingle(),
    supabase
      .from('recipes')
      .select('id, created_at, method, bean_info')
      .eq('coffee_profile_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (error || !profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const signedUrl = imageData
    ? await createCoffeeProfileSignedUrl(supabase, imageData.storage_path)
    : null

  return NextResponse.json({
    profile,
    primary_image: imageData ? { id: imageData.id, signed_url: signedUrl } : null,
    recent_recipes: linkedRecipes ?? [],
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function PATCH(request: Request, { params }: Params) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpdateCoffeeProfileRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('coffee_profiles')
    .select('label, bean_profile_json')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const nextLabel = parsed.data.label ?? existing.label
  const nextBean = parsed.data.bean_profile_json ?? existing.bean_profile_json
  const duplicateFingerprint = buildDuplicateFingerprint({
    label: nextLabel,
    bean_profile_json: {
      roaster: nextBean.roaster,
      bean_name: nextBean.bean_name,
      origin: nextBean.origin,
      process: nextBean.process,
      roast_level: nextBean.roast_level,
    },
  })

  const { data, error } = await supabase
    .from('coffee_profiles')
    .update({
      ...parsed.data,
      duplicate_fingerprint: duplicateFingerprint,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === '23505') {
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
    return NextResponse.json({ error: error?.message ?? 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: images } = await supabase
    .from('coffee_profile_images')
    .select('storage_path')
    .eq('coffee_profile_id', id)
    .eq('user_id', user.id)

  const paths = (images ?? []).map(image => image.storage_path)
  if (paths.length > 0) {
    await supabase.storage.from('coffee-bag-images').remove(paths)
  }

  const { error } = await supabase
    .from('coffee_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
