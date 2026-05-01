import { NextRequest, NextResponse } from 'next/server'
import { assertSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { generateRecipeWithRetries } from '@/lib/recipe-generation'
import { saveRecipeWithSnapshot } from '@/lib/save-recipe'
import { createClient } from '@/lib/supabase/server'
import { buildAuthenticatedOpenRouterUserId, createOpenRouterClient } from '@/lib/openrouter'
import { GenerateFromProfileRequestSchema, GenerationContextSchema } from '@/types/coffee-profile'
import { BeanProfileSchema } from '@/types/recipe'

type UserProfileRow = {
  default_volume_ml: number
}

export async function POST(request: NextRequest) {
  if (!assertSavedCoffeeProfilesEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = GenerateFromProfileRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { coffee_profile_id, method, goal, water_mode, water_grams, water_delta_grams, recipe_mode } = parsed.data

    const [{ data: profile, error: profileError }, { data: userProfile }] = await Promise.all([
      supabase
        .from('coffee_profiles')
        .select('id, user_id, label, bean_profile_json, archived_at')
        .eq('id', coffee_profile_id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('profiles')
        .select('default_volume_ml')
        .eq('id', user.id)
        .single(),
    ])

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Coffee profile not found' }, { status: 404 })
    }

    if (profile.archived_at) {
      return NextResponse.json({ error: 'Archived coffee profiles cannot generate new recipes' }, { status: 409 })
    }

    const beanParsed = BeanProfileSchema.safeParse(profile.bean_profile_json)
    if (!beanParsed.success) {
      return NextResponse.json({ error: 'Invalid coffee profile bean data' }, { status: 422 })
    }

    const baseVolume = ((userProfile as UserProfileRow | null)?.default_volume_ml ?? 250)
    const targetVolumeMl = water_mode === 'absolute'
      ? water_grams
      : Math.max(50, baseVolume + (water_delta_grams ?? 0))

    const client = createOpenRouterClient(request)
    const openRouterUser = buildAuthenticatedOpenRouterUserId(user)
    const strictParityMode = process.env.STRICT_GRINDER_TABLE_PARITY === '1'

    const generatedRecipe = await generateRecipeWithRetries({
      client,
      openRouterUser,
      method,
      bean: beanParsed.data,
      targetVolumeMl,
      recipeMode: recipe_mode,
      strictParityMode,
    })

    const goalLine = `Target goal: ${goal}.`
    const goalAppliedRecipe = {
      ...generatedRecipe,
      objective: `${generatedRecipe.objective} ${goalLine}`.trim(),
    }

    const generationContext = GenerationContextSchema.parse({
      source: 'profile',
      goal,
      water_mode,
      water_grams,
      water_delta_grams,
      method,
    })

    const saved = await saveRecipeWithSnapshot(supabase, {
      userId: user.id,
      bean_info: beanParsed.data,
      method,
      original_recipe_json: goalAppliedRecipe,
      current_recipe_json: goalAppliedRecipe,
      feedback_history: [],
      coffee_profile_id: profile.id,
      coffee_profile_user_id: profile.user_id,
      generation_context: generationContext,
    })

    await supabase
      .from('coffee_profiles')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', profile.id)
      .eq('user_id', user.id)

    return NextResponse.json({ recipe: goalAppliedRecipe, recipeId: saved.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'MODEL_CREDIT_LIMIT') {
      return NextResponse.json(
        { error: 'Recipe generation temporarily unavailable: model credit limit reached. Try again in a bit or reduce provider token usage.' },
        { status: 503 },
      )
    }

    if (error instanceof Error && error.message.startsWith('DETERMINISTIC_VALIDATION_FAILED:')) {
      const details = error.message.replace('DETERMINISTIC_VALIDATION_FAILED:', '').trim()
      return NextResponse.json(
        {
          error: 'Deterministic grind override failed validation',
          validationErrors: details ? details.split('; ').filter(Boolean) : [],
        },
        { status: 422 },
      )
    }

    if (error instanceof Error && error.message.startsWith('GENERATION_FAILED:')) {
      const details = error.message.replace('GENERATION_FAILED:', '').trim()
      return NextResponse.json(
        {
          error: 'Recipe generation failed after retries',
          validationErrors: details ? details.split('; ').filter(Boolean) : [],
        },
        { status: 422 },
      )
    }

    console.error('[recipes/from-profile]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
