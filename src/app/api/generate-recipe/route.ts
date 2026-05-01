import { NextRequest, NextResponse } from 'next/server'
import { generateRecipeWithRetries } from '@/lib/recipe-generation'
import { BeanProfileSchema } from '@/types/recipe'
import { createClient } from '@/lib/supabase/server'
import {
  attachGuestOpenRouterCookie,
  buildAuthenticatedOpenRouterUserId,
  createOpenRouterClient,
  getGuestOpenRouterUserId,
} from '@/lib/openrouter'

export async function POST(req: NextRequest) {
  try {
    const client = createOpenRouterClient(req)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const guestTracking = user ? null : getGuestOpenRouterUserId(req)
    const openRouterUser = user
      ? buildAuthenticatedOpenRouterUserId(user)
      : guestTracking!.userId

    const body = await req.json()
    const { method, bean, targetVolumeMl, recipe_mode } = body

    if (!method || !bean) {
      return NextResponse.json({ error: 'method and bean are required' }, { status: 400 })
    }

    const beanParsed = BeanProfileSchema.safeParse(bean)
    if (!beanParsed.success) {
      return NextResponse.json(
        { error: 'Invalid bean profile', issues: beanParsed.error.issues },
        { status: 400 },
      )
    }

    const strictParityMode = process.env.STRICT_GRINDER_TABLE_PARITY === '1'
    const recipe = await generateRecipeWithRetries({
      client,
      openRouterUser,
      method,
      bean: beanParsed.data,
      targetVolumeMl,
      recipeMode: recipe_mode === 'four_six' ? 'four_six' : 'standard',
      strictParityMode,
    })

    return attachGuestOpenRouterCookie(
      NextResponse.json(recipe),
      guestTracking?.newGuestId ?? null,
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'MODEL_CREDIT_LIMIT') {
      return NextResponse.json(
        { error: 'Recipe generation temporarily unavailable: model credit limit reached. Try again in a bit or reduce provider token usage.' },
        { status: 503 },
      )
    }

    if (err instanceof Error && err.message.startsWith('DETERMINISTIC_VALIDATION_FAILED:')) {
      const details = err.message.replace('DETERMINISTIC_VALIDATION_FAILED:', '').trim()
      return NextResponse.json(
        {
          error: 'Deterministic grind override failed validation',
          validationErrors: details ? details.split('; ').filter(Boolean) : [],
        },
        { status: 422 },
      )
    }

    if (err instanceof Error && err.message.startsWith('GENERATION_FAILED:')) {
      const details = err.message.replace('GENERATION_FAILED:', '').trim()
      return NextResponse.json(
        {
          error: 'Recipe generation failed after retries',
          validationErrors: details ? details.split('; ').filter(Boolean) : [],
        },
        { status: 422 },
      )
    }

    console.error('[generate-recipe]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
