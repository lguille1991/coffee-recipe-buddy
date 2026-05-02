import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id, archived, coffee_profile_id, coffee_profile_user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle<{
      id: string
      archived: boolean
      coffee_profile_id: string | null
      coffee_profile_user_id: string | null
    }>()

  if (recipeError) {
    return NextResponse.json({ error: recipeError.message }, { status: 500 })
  }

  if (!recipe || !recipe.archived) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (recipe.coffee_profile_id) {
    const { data: profile, error: profileError } = await supabase
      .from('coffee_profiles')
      .select('archived_at')
      .eq('id', recipe.coffee_profile_id)
      .eq('user_id', recipe.coffee_profile_user_id ?? user.id)
      .maybeSingle<{ archived_at: string | null }>()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (profile?.archived_at) {
      return NextResponse.json(
        { error: 'Restore the linked coffee profile before restoring this recipe' },
        { status: 409 },
      )
    }
  }

  const { data: restored, error: restoreError } = await supabase
    .from('recipes')
    .update({ archived: false })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('archived', true)
    .select('id, archived')
    .single<{ id: string; archived: boolean }>()

  if (restoreError) {
    return NextResponse.json({ error: restoreError.message }, { status: 500 })
  }

  if (!restored) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, recipe: restored })
}
