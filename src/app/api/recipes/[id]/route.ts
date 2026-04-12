import { NextResponse } from 'next/server'
import { getSavedRecipeDetail } from '@/lib/recipe-detail'
import { createRecipeSnapshot, mirrorRecipeLiveSnapshot } from '@/lib/recipe-snapshots'
import { createClient } from '@/lib/supabase/server'
import {
  UpdateNotesRequestSchema,
  UpdateRecipeRequestSchema,
  UseRecipeSnapshotRequestSchema,
} from '@/types/recipe'

type Params = { params: Promise<{ id: string }> }

// ─── GET /api/recipes/:id ─────────────────────────────────────────────────────

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const recipeDetail = await getSavedRecipeDetail(supabase, id, user.id)
  if (!recipeDetail) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(recipeDetail, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

// ─── PATCH /api/recipes/:id ───────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Notes-only update (no feedback_round in body)
  if ('notes' in body && !('feedback_round' in body)) {
    const parsed = UpdateNotesRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('recipes')
      .update({ notes: parsed.data.notes })
      .eq('id', id)
      .select('id, notes')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if ('live_snapshot_id' in body && !('current_recipe_json' in body)) {
    const parsed = UseRecipeSnapshotRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data: snapshot, error: snapshotError } = await supabase
      .from('recipe_snapshots')
      .select('id, snapshot_recipe_json')
      .eq('id', parsed.data.live_snapshot_id)
      .eq('recipe_id', id)
      .eq('user_id', user.id)
      .single()

    if (snapshotError || !snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }

    try {
      await mirrorRecipeLiveSnapshot({
        supabase,
        recipeId: id,
        liveSnapshotId: snapshot.id,
        currentRecipeJson: snapshot.snapshot_recipe_json,
      })

      const recipeDetail = await getSavedRecipeDetail(supabase, id, user.id)
      if (!recipeDetail) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      return NextResponse.json(recipeDetail)
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Failed to switch recipe snapshot',
      }, { status: 500 })
    }
  }

  // Recipe update (feedback-driven)
  const parsed = UpdateRecipeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id, user_id, live_snapshot_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (recipeError || !recipe) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const snapshot = await createRecipeSnapshot({
      supabase,
      recipeId: id,
      userId: user.id,
      snapshotKind: parsed.data.snapshot_kind,
      snapshotRecipeJson: parsed.data.current_recipe_json,
      changeSummary: parsed.data.change_summary,
      sourceSnapshotId: parsed.data.source_snapshot_id ?? recipe.live_snapshot_id ?? null,
    })

    await mirrorRecipeLiveSnapshot({
      supabase,
      recipeId: id,
      liveSnapshotId: snapshot.id,
      currentRecipeJson: parsed.data.current_recipe_json,
      feedbackHistory: parsed.data.feedback_history,
    })

    const recipeDetail = await getSavedRecipeDetail(supabase, id, user.id)
    if (!recipeDetail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(recipeDetail)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to save recipe snapshot',
    }, { status: 500 })
  }
}

// ─── DELETE /api/recipes/:id (soft delete) ────────────────────────────────────

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('recipes')
    .update({ archived: true })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
