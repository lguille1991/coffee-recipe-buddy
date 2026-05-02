import { NextResponse } from 'next/server'
import { uploadBagPhotoFromDataUrl } from '@/lib/bag-photo-storage'
import { buildIdempotencyKey, runIdempotent } from '@/lib/request-idempotency'
import { saveRecipeWithSnapshot } from '@/lib/save-recipe'
import { listRecipesForUser } from '@/lib/recipe-list'
import { createClient } from '@/lib/supabase/server'
import { SaveRecipeRequestSchema } from '@/types/recipe'

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

  const image_url = image_data_url
    ? await uploadBagPhotoFromDataUrl(supabase, user.id, image_data_url)
    : null

  try {
    const idempotencyKey = buildIdempotencyKey('recipes.save', {
      user_id: user.id,
      method,
      bean_info,
      original_recipe_json,
      current_recipe_json,
      feedback_history: feedback_history ?? [],
      parent_recipe_id: parent_recipe_id ?? null,
      scale_factor: scale_factor ?? null,
      image_url: image_url ?? null,
    })

    const { value: saved, replayed } = await runIdempotent(idempotencyKey, () => saveRecipeWithSnapshot(supabase, {
      userId: user.id,
      bean_info,
      method,
      original_recipe_json,
      current_recipe_json,
      feedback_history,
      image_url,
      parent_recipe_id: parent_recipe_id ?? null,
      scale_factor: scale_factor ?? null,
    }))

    return NextResponse.json(saved, { status: replayed ? 200 : 201 })
  } catch (snapshotError) {
    return NextResponse.json({
      error: snapshotError instanceof Error ? snapshotError.message : 'Failed to create recipe snapshot',
    }, { status: 500 })
  }
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
