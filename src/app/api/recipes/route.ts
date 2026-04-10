import { NextResponse } from 'next/server'
import { listRecipesForUser } from '@/lib/recipe-list'
import { createClient } from '@/lib/supabase/server'
import { SaveRecipeRequestSchema } from '@/types/recipe'
import { CURRENT_SCHEMA_VERSION } from '@/lib/recipe-migrations'

// ─── POST /api/recipes — save a recipe ───────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = SaveRecipeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { bean_info, method, original_recipe_json, current_recipe_json, feedback_history, image_data_url, parent_recipe_id, scale_factor } = parsed.data

  let image_url: string | null = null

  // Upload bag photo to Supabase Storage if provided
  if (image_data_url) {
    const base64Data = image_data_url.split(',')[1]
    const mimeMatch = image_data_url.match(/data:([^;]+);/)
    const mime = mimeMatch?.[1] ?? 'image/jpeg'
    const ext = mime.split('/')[1] ?? 'jpg'
    const buffer = Buffer.from(base64Data, 'base64')

    const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('bag-photos')
      .upload(filePath, buffer, { contentType: mime, upsert: false })

    if (!uploadError) {
      const { data: signedData } = await supabase.storage
        .from('bag-photos')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1-year URL
      image_url = signedData?.signedUrl ?? null
    }
  }

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      schema_version: CURRENT_SCHEMA_VERSION,
      bean_info,
      method,
      original_recipe_json,
      current_recipe_json,
      feedback_history,
      image_url,
      parent_recipe_id: parent_recipe_id ?? null,
      scale_factor: scale_factor ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// ─── GET /api/recipes — list recipes ─────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const method = searchParams.get('method')
  const q = searchParams.get('q')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  try {
    const { recipes } = await listRecipesForUser(supabase, {
      userId: user.id,
      method: method ?? undefined,
      q: q ?? undefined,
      page,
      limit,
    })

    return NextResponse.json({ recipes, page, limit }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load recipes' },
      { status: 500 },
    )
  }
}
