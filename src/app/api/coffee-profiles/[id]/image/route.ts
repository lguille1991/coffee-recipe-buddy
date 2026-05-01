import { NextResponse } from 'next/server'
import { createCoffeeProfileSignedUrl, replaceCoffeeProfilePrimaryImage } from '@/lib/coffee-profile-storage'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('coffee_profiles')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Coffee profile not found' }, { status: 404 })
  }

  const form = await request.formData()
  const imageFile = form.get('image')
  if (!(imageFile instanceof File)) {
    return NextResponse.json({ error: 'image file is required' }, { status: 400 })
  }

  const buffer = Buffer.from(await imageFile.arrayBuffer())
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: 'Empty image file' }, { status: 400 })
  }

  try {
    const uploaded = await replaceCoffeeProfilePrimaryImage(supabase, {
      userId: user.id,
      profileId: id,
      buffer,
      mimeType: imageFile.type || 'image/jpeg',
    })

    const signedUrl = await createCoffeeProfileSignedUrl(supabase, uploaded.storage_path)

    return NextResponse.json({
      image: {
        id: uploaded.id,
        mime_type: uploaded.mime_type,
        width: uploaded.width,
        height: uploaded.height,
        size_bytes: uploaded.size_bytes,
        signed_url: signedUrl,
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload image'
    if (message === 'Unsupported image type') {
      return NextResponse.json({ error: message }, { status: 415 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
