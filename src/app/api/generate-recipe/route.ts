import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { buildRecipePrompt } from '@/lib/prompt-builder'
import { validateRecipe, buildRetryPrompt } from '@/lib/recipe-validator'
import { BeanProfileSchema, Recipe } from '@/types/recipe'
import { grinderValueToKUltraClicks, parseKUltraRange, kUltraRangeToQAir, kUltraRangeToBaratza, kUltraRangeToTimemoreC2 } from '@/lib/grinder-converter'
import { createClient } from '@/lib/supabase/server'
import {
  attachGuestOpenRouterCookie,
  buildAuthenticatedOpenRouterUserId,
  createOpenRouterClient,
  getGuestOpenRouterUserId,
} from '@/lib/openrouter'

const MAX_RETRIES = 2
const DEFAULT_MAX_TOKENS = 3000
const MIN_MAX_TOKENS = 512

function extractAffordableTokenLimit(error: unknown): number | null {
  const message = error instanceof Error ? error.message : ''
  const match = message.match(/afford (\d+)/i)
  if (!match) return null

  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

function isCreditLimitError(error: unknown): boolean {
  return error instanceof Error && /requires more credits|fewer max_tokens/i.test(error.message)
}

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
    const { method, bean, targetVolumeMl } = body

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

    const { system, user: userPrompt } = buildRecipePrompt(beanParsed.data, method, targetVolumeMl)

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ]

    let lastErrors: string[] = []
    let attempt = 0
    let maxTokens = DEFAULT_MAX_TOKENS

    while (attempt <= MAX_RETRIES) {
      let rawText = ''

      try {
        const response = await client.chat.completions.create({
          model: 'google/gemini-2.0-flash-001',
          max_tokens: maxTokens,
          user: openRouterUser,
          messages,
        })

        rawText = response.choices[0].message.content ?? ''
      } catch (error) {
        if (isCreditLimitError(error)) {
          const affordableLimit = extractAffordableTokenLimit(error)
          if (affordableLimit && affordableLimit < maxTokens) {
            maxTokens = Math.max(MIN_MAX_TOKENS, affordableLimit - 128)
            continue
          }

          return NextResponse.json(
            { error: 'Recipe generation temporarily unavailable: model credit limit reached. Try again in a bit or reduce provider token usage.' },
            { status: 503 },
          )
        }

        throw error
      }

      const jsonText = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

      let parsed: unknown
      try {
        parsed = JSON.parse(jsonText)
      } catch {
        lastErrors = [`JSON parse error: ${rawText.slice(0, 200)}`]
        // Inject retry instruction
        messages.push({ role: 'assistant', content: rawText })
        messages.push({
          role: 'user',
          content: buildRetryPrompt(lastErrors),
        })
        attempt++
        continue
      }

      const validation = validateRecipe(parsed, beanParsed.data, method)

      if (validation.valid) {
        const recipe = parsed as Recipe
        const kuRange = parseKUltraRange(recipe.grind.k_ultra.range)
        const startClicks = recipe.grind.k_ultra.starting_point
          ? grinderValueToKUltraClicks('k_ultra', recipe.grind.k_ultra.starting_point)
          : kuRange?.mid
        if (kuRange && startClicks !== undefined) {
          const qAir = kUltraRangeToQAir(kuRange.low, kuRange.high, startClicks)
          const baratza = kUltraRangeToBaratza(kuRange.low, kuRange.high, startClicks, method)
          const c2 = kUltraRangeToTimemoreC2(kuRange.low, kuRange.high, startClicks, method)
          recipe.grind.q_air = { ...recipe.grind.q_air, ...qAir }
          recipe.grind.baratza_encore_esp = { ...recipe.grind.baratza_encore_esp, ...baratza }
          recipe.grind.timemore_c2 = { ...recipe.grind.timemore_c2, ...c2 }
        }
        return attachGuestOpenRouterCookie(
          NextResponse.json(recipe),
          guestTracking?.newGuestId ?? null,
        )
      }

      lastErrors = validation.errors
      messages.push({ role: 'assistant', content: rawText })
      messages.push({
        role: 'user',
        content: buildRetryPrompt(validation.errors),
      })
      attempt++
    }

    return NextResponse.json(
      { error: 'Recipe generation failed after retries', validationErrors: lastErrors },
      { status: 422 },
    )
  } catch (err) {
    console.error('[generate-recipe]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
