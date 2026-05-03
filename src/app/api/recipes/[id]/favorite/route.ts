import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

const FavoriteRequestSchema = z.object({
  favorite: z.boolean(),
})

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = FavoriteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data: ownedRecipe } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!ownedRecipe) {
    const { data: membership } = await supabase
      .from('recipe_share_memberships')
      .select('id')
      .eq('recipe_id', id)
      .eq('recipient_id', user.id)
      .is('hidden_at', null)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }
  }

  if (parsed.data.favorite) {
    const { error } = await supabase
      .from('recipe_user_favorites')
      .upsert({ user_id: user.id, recipe_id: id }, { onConflict: 'user_id,recipe_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from('recipe_user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('recipe_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, favorite: parsed.data.favorite })
}
