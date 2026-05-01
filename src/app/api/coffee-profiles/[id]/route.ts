import { NextResponse } from 'next/server'
import { createCoffeeProfileSignedUrl } from '@/lib/coffee-profile-storage'
import { createClient } from '@/lib/supabase/server'
import { UpdateCoffeeProfileRequestSchema } from '@/types/coffee-profile'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
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
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpdateCoffeeProfileRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('coffee_profiles')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: Params) {
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
