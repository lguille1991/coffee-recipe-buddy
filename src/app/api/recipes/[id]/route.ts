import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdateRecipeRequestSchema } from '@/types/recipe'

type Params = { params: Promise<{ id: string }> }

// ─── GET /api/recipes/:id ─────────────────────────────────────────────────────

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .eq('archived', false)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// ─── PATCH /api/recipes/:id ───────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpdateRecipeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  // Fetch existing record (RLS ensures ownership)
  const { data: existing, error: fetchError } = await supabase
    .from('recipes')
    .select('feedback_history')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updatedHistory = [
    ...(existing.feedback_history ?? []),
    parsed.data.feedback_round,
  ]

  const { data, error } = await supabase
    .from('recipes')
    .update({
      current_recipe_json: parsed.data.current_recipe_json,
      feedback_history: updatedHistory,
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
