import { NextRequest, NextResponse } from 'next/server'
import { DETERMINISTIC_ENGINE_VERSION, DeterministicRecipeError } from '@/lib/deterministic-recipe-engine'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { generateRecipe } from '@/lib/recipe-generation'
import { saveRecipeWithSnapshot } from '@/lib/save-recipe'
import { buildIdempotencyKey, runIdempotent } from '@/lib/request-idempotency'
import { createClient } from '@/lib/supabase/server'
import { GenerateFromProfileRequestSchema, GenerationContextSchema } from '@/types/coffee-profile'
import { BeanProfileSchema } from '@/types/recipe'

type UserProfileRow = { default_volume_ml: number }

function evaluationDateUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  if (!assertSavedCoffeeProfilesEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = GenerateFromProfileRequestSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 })
    const { coffee_profile_id, method, goal, water_mode, water_grams, water_delta_grams, recipe_mode } = parsed.data
    const [{ data: profile, error: profileError }, { data: userProfile }] = await Promise.all([
      supabase.from('coffee_profiles').select('id, user_id, label, bean_profile_json, archived_at, updated_at').eq('id', coffee_profile_id).eq('user_id', user.id).single(),
      supabase.from('profiles').select('default_volume_ml').eq('id', user.id).single(),
    ])
    if (profileError || !profile) return NextResponse.json({ error: 'Coffee profile not found' }, { status: 404 })
    if (profile.archived_at) return NextResponse.json({ error: 'Archived coffee profiles cannot generate new recipes' }, { status: 409 })

    const beanParsed = BeanProfileSchema.safeParse(profile.bean_profile_json)
    if (!beanParsed.success) return NextResponse.json({ error: 'Invalid coffee profile bean data', code: 'INVALID_INPUT' }, { status: 422 })
    const baseWaterG = (userProfile as UserProfileRow | null)?.default_volume_ml ?? 250
    const targetWaterG = water_mode === 'absolute' ? water_grams! : baseWaterG + (water_delta_grams ?? 0)
    const evaluationDate = evaluationDateUtc()
    const idempotencyKey = buildIdempotencyKey('recipes.from-profile', {
      user_id: user.id,
      coffee_profile_id: profile.id,
      profile_revision: profile.updated_at,
      normalized_bean: beanParsed.data,
      method,
      goal,
      target_water_g: targetWaterG,
      recipe_mode,
      engine_version: DETERMINISTIC_ENGINE_VERSION,
      evaluation_date: evaluationDate,
    })

    const { value, replayed } = await runIdempotent(idempotencyKey, async () => {
      const recipe = generateRecipe({ method, bean: beanParsed.data, targetWaterG, recipeMode: recipe_mode, goal, evaluationDate })
      const generationContext = GenerationContextSchema.parse({ source: 'profile', goal, water_mode, water_grams, water_delta_grams, method })
      const saved = await saveRecipeWithSnapshot(supabase, {
        userId: user.id,
        bean_info: beanParsed.data,
        method,
        original_recipe_json: recipe,
        current_recipe_json: recipe,
        feedback_history: [],
        coffee_profile_id: profile.id,
        coffee_profile_user_id: profile.user_id,
        generation_context: generationContext,
      })
      await supabase.from('coffee_profiles').update({ last_used_at: new Date().toISOString() }).eq('id', profile.id).eq('user_id', user.id)
      return { recipe, recipeId: saved.id }
    })
    return NextResponse.json({ recipe: value.recipe, recipeId: value.recipeId }, { status: replayed ? 200 : 201 })
  } catch (error) {
    if (error instanceof DeterministicRecipeError) {
      const status = error.code === 'CAPACITY_EXCEEDED' || error.code === 'UNSUPPORTED_MODE' ? 422 : 400
      return NextResponse.json({ error: error.message, code: error.code, bounds: error.bounds }, { status })
    }
    console.error('[recipes/from-profile]', error)
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
