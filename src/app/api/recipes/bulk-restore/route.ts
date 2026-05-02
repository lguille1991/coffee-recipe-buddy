import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const BulkRestoreRecipesRequestSchema = z.object({
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
  const parsed = BulkRestoreRecipesRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const recipeIds = Array.from(new Set(parsed.data.recipe_ids))

  const { data: recipeRows, error: recipeError } = await supabase
    .from('recipes')
    .select('id, coffee_profile_id, coffee_profile_user_id')
    .eq('user_id', user.id)
    .in('id', recipeIds)
    .eq('archived', true)

  if (recipeError) {
    return NextResponse.json({ error: recipeError.message }, { status: 500 })
  }

  const rows = (recipeRows ?? []) as Array<{
    id: string
    coffee_profile_id: string | null
    coffee_profile_user_id: string | null
  }>
  const linkedProfileIds = Array.from(new Set(rows.map(row => row.coffee_profile_id).filter((id): id is string => Boolean(id))))

  if (linkedProfileIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('coffee_profiles')
      .select('id, archived_at')
      .eq('user_id', user.id)
      .in('id', linkedProfileIds)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const archivedProfileIds = new Set(
      ((profiles ?? []) as Array<{ id: string; archived_at: string | null }>)
        .filter(profile => profile.archived_at != null)
        .map(profile => profile.id),
    )

    const blockedRecipeIds = rows
      .filter(row => row.coffee_profile_id && archivedProfileIds.has(row.coffee_profile_id))
      .map(row => row.id)

    if (blockedRecipeIds.length > 0) {
      return NextResponse.json(
        {
          error: 'Some recipes cannot be restored because their linked coffee profiles are archived',
          blocked_recipe_ids: blockedRecipeIds,
        },
        { status: 409 },
      )
    }
  }

  const { data, error } = await supabase
    .from('recipes')
    .update({ archived: false })
    .eq('user_id', user.id)
    .in('id', recipeIds)
    .eq('archived', true)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const restoredIds = ((data ?? []) as Array<{ id: string }>).map(row => row.id)

  return NextResponse.json({
    success: true,
    restored_ids: restoredIds,
    restored_count: restoredIds.length,
    requested_count: recipeIds.length,
  })
}
