import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_SCHEMA_VERSION } from '@/lib/recipe-migrations'
import { ShareSnapshotSchema } from '@/types/recipe'

type Params = { params: Promise<{ token: string }> }

// ─── POST /api/share/:token/clone ─────────────────────────────────────────────
// Auth required. Copies the share snapshot into the authenticated user's library
// as a new saved recipe.

export async function POST(_request: Request, { params }: Params) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the shared snapshot (public RLS allows this without auth)
  const { data: shared, error: shareError } = await supabase
    .from('shared_recipes')
    .select('snapshot_json')
    .eq('share_token', token)
    .single()

  if (shareError || !shared) {
    return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
  }

  const parsed = ShareSnapshotSchema.safeParse(shared.snapshot_json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid snapshot data' }, { status: 422 })
  }

  const { bean_info, current_recipe_json, image_url } = parsed.data

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      schema_version: CURRENT_SCHEMA_VERSION,
      bean_info,
      method: current_recipe_json.method,
      original_recipe_json: current_recipe_json,
      current_recipe_json,
      feedback_history: [],
      image_url: image_url ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to clone recipe' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
