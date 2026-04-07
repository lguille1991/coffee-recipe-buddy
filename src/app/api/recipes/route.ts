import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SaveRecipeRequestSchema } from '@/types/recipe'
import { CURRENT_SCHEMA_VERSION } from '@/lib/recipe-migrations'

type FeedbackHistoryRow = Array<{ type?: string }>
type RecipeRow = { feedback_history?: FeedbackHistoryRow; parent_recipe_id?: string | null; [key: string]: unknown }

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
  const offset = (page - 1) * limit

  let query = supabase
    .from('recipes')
    .select('id, method, bean_info, image_url, created_at, schema_version, feedback_history, parent_recipe_id')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (method) {
    query = query.eq('method', method)
  }

  if (q) {
    // Full-text search across bean_info jsonb fields
    query = query.or(
      `bean_info->>'bean_name'.ilike.%${q}%,bean_info->>'origin'.ilike.%${q}%,bean_info->>'roaster'.ilike.%${q}%`,
    )
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const recipes = (data ?? []).map((row: RecipeRow) => {
    const history: FeedbackHistoryRow = row.feedback_history ?? []
    const has_manual_edits = history.some(r => r.type === 'manual_edit' || r.type === 'auto_adjust')
    const has_feedback_adjustments = history.some(r => !('type' in r) || r.type === 'feedback')
    const is_scaled = row.parent_recipe_id != null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { feedback_history: _fh, parent_recipe_id: _pid, ...rest } = row
    return { ...rest, has_manual_edits, has_feedback_adjustments, is_scaled }
  })

  return NextResponse.json({ recipes, page, limit })
}
