import { NextResponse } from 'next/server'
import { SHARE_SNAPSHOT_SELECT } from '@/lib/recipe-select'
import { getRecipeShareInfo } from '@/lib/share'
import { createClient } from '@/lib/supabase/server'
import type { SavedRecipe } from '@/types/recipe'

type Params = { params: Promise<{ id: string }> }

// ─── GET /api/recipes/:id/share ───────────────────────────────────────────────
// Returns the existing share token and URL if this recipe is shared; 404 otherwise.

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shareInfo = await getRecipeShareInfo(supabase, id, user.id)
  if (!shareInfo.shareToken) {
    return NextResponse.json({
      shareToken: null,
      url: null,
      commentCount: null,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  }

  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`

  return NextResponse.json({
    shareToken: shareInfo.shareToken,
    url: `${baseUrl}/share/${shareInfo.shareToken}`,
    commentCount: shareInfo.commentCount,
  }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}

// ─── POST /api/recipes/:id/share ──────────────────────────────────────────────
// Creates a share link for the recipe. Returns existing token if already shared.

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch recipe — RLS ensures ownership
  const { data: recipeRow, error: recipeError } = await supabase
    .from('recipes')
    .select(SHARE_SNAPSHOT_SELECT)
    .eq('id', id)
    .eq('archived', false)
    .single()

  if (recipeError || !recipeRow) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  const recipe = recipeRow as unknown as Pick<
    SavedRecipe,
    'bean_info' | 'current_recipe_json' | 'image_url' | 'notes'
  >

  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`

  // Return existing share if one already exists for this recipe
  const { data: existing } = await supabase
    .from('shared_recipes')
    .select('share_token')
    .eq('recipe_id', id)
    .single()

  if (existing) {
    return NextResponse.json({
      shareToken: existing.share_token,
      url: `${baseUrl}/share/${existing.share_token}`,
    })
  }

  // Fetch owner's display name to embed in snapshot (avoids RLS join issues on public view)
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const shareToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

  const snapshot = {
    bean_info: recipe.bean_info,
    current_recipe_json: recipe.current_recipe_json,
    image_url: recipe.image_url ?? null,
    owner_display_name: profile?.display_name ?? null,
    notes: recipe.notes ?? null,
  }

  const { data: shared, error: insertError } = await supabase
    .from('shared_recipes')
    .insert({
      owner_id: user.id,
      recipe_id: id,
      snapshot_json: snapshot,
      share_token: shareToken,
    })
    .select('share_token')
    .single()

  if (insertError || !shared) {
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
  }

  return NextResponse.json({
    shareToken: shared.share_token,
    url: `${baseUrl}/share/${shared.share_token}`,
  }, { status: 201 })
}

// ─── DELETE /api/recipes/:id/share ────────────────────────────────────────────
// Revokes the share link (removes from shared_recipes).

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('shared_recipes')
    .delete()
    .eq('recipe_id', id)
    .eq('owner_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
