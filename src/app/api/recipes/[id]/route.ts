import { NextResponse } from 'next/server'
import { SAVED_RECIPE_DETAIL_SELECT } from '@/lib/recipe-select'
import { createClient } from '@/lib/supabase/server'
import {
  SavedRecipe,
  UpdateRecipeRequestSchema,
  UpdateNotesRequestSchema,
} from '@/types/recipe'

type Params = { params: Promise<{ id: string }> }

// ─── GET /api/recipes/:id ─────────────────────────────────────────────────────

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: recipeRow, error } = await supabase
    .from('recipes')
    .select(SAVED_RECIPE_DETAIL_SELECT)
    .eq('id', id)
    .eq('archived', false)
    .single()

  if (error || !recipeRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(recipeRow as unknown as SavedRecipe, {
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

  // Recipe update (feedback-driven)
  const parsed = UpdateRecipeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recipes')
    .update({
      current_recipe_json: parsed.data.current_recipe_json,
      feedback_history: parsed.data.feedback_history,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
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
