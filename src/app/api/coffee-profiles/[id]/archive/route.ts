import { NextResponse } from 'next/server'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { count: linkedActiveRecipes, error: countError } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('coffee_profile_id', id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if ((linkedActiveRecipes ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot archive coffee profile while it is linked to existing recipes' },
      { status: 409 },
    )
  }

  const { data, error } = await supabase
    .from('coffee_profiles')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, archived_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
