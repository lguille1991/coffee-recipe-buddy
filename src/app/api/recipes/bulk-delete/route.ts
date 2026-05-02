import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const BulkDeleteRecipesRequestSchema = z.object({
  recipe_ids: z.array(z.string().uuid()).min(1).max(2000),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = BulkDeleteRecipesRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const recipeIds = Array.from(new Set(parsed.data.recipe_ids))

  const { data, error } = await supabase
    .from('recipes')
    .update({ archived: true })
    .eq('user_id', user.id)
    .in('id', recipeIds)
    .eq('archived', false)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const archivedIds = ((data ?? []) as Array<{ id: string }>).map(row => row.id)

  return NextResponse.json({
    success: true,
    archived_ids: archivedIds,
    archived_count: archivedIds.length,
    requested_count: recipeIds.length,
  })
}
