import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { buildRecipePrompt } from '@/lib/prompt-builder'
import { validateRecipe, buildRetryPrompt } from '@/lib/recipe-validator'
import { BeanProfileSchema, Recipe } from '@/types/recipe'
import { parseKUltraRange, kUltraRangeToQAir, kUltraRangeToBaratza, kUltraRangeToTimemoreC2 } from '@/lib/grinder-converter'

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
})

const MAX_RETRIES = 2

export async function POST(req: NextRequest) {
  try {
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

    const { system, user } = buildRecipePrompt(beanParsed.data, method, targetVolumeMl)

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]

    let lastErrors: string[] = []
    let attempt = 0

    while (attempt <= MAX_RETRIES) {
      const response = await client.chat.completions.create({
        model: 'google/gemini-2.0-flash-001',
        max_tokens: 4096,
        messages,
      })

      const rawText = response.choices[0].message.content ?? ''
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
        const startMatch = recipe.grind.k_ultra.starting_point.match(/(\d+)/)
        const startClicks = startMatch ? parseInt(startMatch[1], 10) : kuRange?.mid
        if (kuRange && startClicks !== undefined) {
          const qAir = kUltraRangeToQAir(kuRange.low, kuRange.high, startClicks)
          const baratza = kUltraRangeToBaratza(kuRange.low, kuRange.high, startClicks, method)
          const c2 = kUltraRangeToTimemoreC2(kuRange.low, kuRange.high, startClicks, method)
          recipe.grind.q_air = { ...recipe.grind.q_air, ...qAir }
          recipe.grind.baratza_encore_esp = { ...recipe.grind.baratza_encore_esp, ...baratza }
          recipe.grind.timemore_c2 = { ...recipe.grind.timemore_c2, ...c2 }
        }
        return NextResponse.json(recipe)
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
