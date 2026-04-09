import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { BeanProfile, Recipe, RecipeSchema } from '@/types/recipe'
import { validateRecipe, buildRetryPrompt } from '@/lib/recipe-validator'
import {
  parseKUltraRange,
  kUltraRangeToQAir,
  kUltraRangeToBaratza,
  kUltraRangeToTimemoreC2,
} from '@/lib/grinder-converter'
import { z } from 'zod'

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
})

const MAX_RETRIES = 2
const PRIMARY_MODEL = 'google/gemma-4-31b-it:free'
const FALLBACK_MODEL = 'google/gemini-2.0-flash-001'

const AutoAdjustRequestSchema = z.object({
  scale_factor: z.number().refine(v => [0.5, 0.75, 1.0, 1.25, 1.5, 2.0].includes(v), {
    message: 'scale_factor must be one of 0.5, 0.75, 1.0, 1.25, 1.5, 2.0',
  }),
  intent: z.string().max(500).default(''),
})

// Clicks offset to apply per scale factor: larger dose = deeper bed = coarser grind needed
const SCALE_GRIND_OFFSET: Record<number, number> = {
  0.5:  -2,
  0.75: -1,
  1.0:   0,
  1.25: +1,
  1.5:  +2,
  2.0:  +3,
}

function parseClickValue(s: string): number | null {
  const m = s.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function applyGrindOffset(recipe: Recipe, scaleFactor: number, method: string): Recipe['grind'] {
  const offset = SCALE_GRIND_OFFSET[scaleFactor] ?? 0
  if (offset === 0) return recipe.grind

  const currentClicks = parseClickValue(recipe.grind.k_ultra.starting_point)
  if (currentClicks === null) return recipe.grind

  const range = parseKUltraRange(recipe.range_logic.final_operating_range)
  const low = range?.low ?? currentClicks
  const high = range?.high ?? currentClicks

  const newClicks = Math.max(low, Math.min(high, currentClicks + offset))

  const qAir = kUltraRangeToQAir(low, high, newClicks)
  const baratza = kUltraRangeToBaratza(low, high, newClicks, method)
  const c2 = kUltraRangeToTimemoreC2(low, high, newClicks, method)

  return {
    k_ultra: { ...recipe.grind.k_ultra, starting_point: `${newClicks} clicks` },
    q_air: { ...recipe.grind.q_air, starting_point: qAir.starting_point },
    baratza_encore_esp: { ...recipe.grind.baratza_encore_esp, starting_point: baratza.starting_point, note: baratza.note },
    timemore_c2: { ...recipe.grind.timemore_c2, starting_point: c2.starting_point, note: c2.note },
  }
}

function recomputeAccumulated(steps: Recipe['steps']): Recipe['steps'] {
  let acc = 0
  return steps.map(s => {
    acc = Math.round((acc + s.water_poured_g) * 10) / 10
    return { ...s, water_accumulated_g: acc }
  })
}

type ModelRunResult =
  | { recipe: Recipe }
  | { errors: string[], failedAtModel: string, cause: 'api' | 'parse' | 'validation' }

async function runModelAdjustment(
  model: string,
  baseMessages: OpenAI.ChatCompletionMessageParam[],
  beanInfo: BeanProfile,
  method: string,
): Promise<ModelRunResult> {
  const messages = [...baseMessages]
  let lastErrors: string[] = []
  let attempt = 0

  while (attempt <= MAX_RETRIES) {
    let rawText = ''

    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        messages,
      })

      rawText = response.choices[0].message.content ?? ''
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown OpenRouter error'
      return {
        errors: [`OpenRouter request failed for ${model}: ${message}`],
        failedAtModel: model,
        cause: 'api',
      }
    }

    const jsonText = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      lastErrors = [`JSON parse error: ${rawText.slice(0, 200)}`]
      messages.push({ role: 'assistant', content: rawText })
      messages.push({ role: 'user', content: buildRetryPrompt(lastErrors) })
      attempt++
      continue
    }

    const validation = validateRecipe(parsed, beanInfo, method)
    if (validation.valid) {
      const schemaParsed = RecipeSchema.safeParse(parsed)
      if (schemaParsed.success) {
        return { recipe: schemaParsed.data }
      }

      lastErrors = schemaParsed.error.issues.map(issue => issue.message)
    } else {
      lastErrors = validation.errors
    }

    messages.push({ role: 'assistant', content: rawText })
    messages.push({ role: 'user', content: buildRetryPrompt(lastErrors) })
    attempt++
  }

  return {
    errors: lastErrors,
    failedAtModel: model,
    cause: 'validation',
  }
}

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = AutoAdjustRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { scale_factor, intent } = parsed.data

  if (scale_factor === 1.0 && intent.trim() === '') {
    return NextResponse.json({ error: 'Provide a scale factor other than 1× or describe what to adjust' }, { status: 400 })
  }

  // Fetch source recipe (verify ownership)
  const { data: sourceRow, error: fetchError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (fetchError || !sourceRow) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  const source = sourceRow.current_recipe_json as Recipe

  // Pre-scale deterministically
  const scaledBase: Recipe = {
    ...source,
    parameters: {
      ...source.parameters,
      coffee_g: Math.round(source.parameters.coffee_g * scale_factor * 10) / 10,
      water_g: Math.round(source.parameters.water_g * scale_factor * 10) / 10,
    },
    steps: recomputeAccumulated(
      source.steps.map(step => ({
        ...step,
        water_poured_g: Math.round(step.water_poured_g * scale_factor * 10) / 10,
      }))
    ),
  }

  const scaledRecipe: Recipe = {
    ...scaledBase,
    grind: applyGrindOffset(scaledBase, scale_factor, sourceRow.method),
  }

  // Pure scale with no intent → skip LLM
  if (intent.trim() === '') {
    return NextResponse.json({ recipe: scaledRecipe })
  }

  // Build LLM prompt
  const systemPrompt = `You are a coffee recipe expert. Adjust the following V60/pour-over/AeroPress recipe according to the user's intent. Return ONLY valid JSON matching this exact schema — no markdown, no explanation:

{
  "method": string,
  "display_name": string,
  "objective": string,
  "parameters": {
    "coffee_g": number,
    "water_g": number,
    "ratio": string (format "1:X.X"),
    "temperature_c": number (60–100),
    "filter": string,
    "total_time": string (format "m:ss")
  },
  "grind": {
    "k_ultra": { "range": string, "starting_point": string, "description": string },
    "q_air": { "range": string, "starting_point": string },
    "baratza_encore_esp": { "range": string, "starting_point": string },
    "timemore_c2": { "range": string, "starting_point": string }
  },
  "range_logic": {
    "base_range": string,
    "process_offset": string,
    "roast_offset": string,
    "freshness_offset": string,
    "density_offset": string,
    "final_operating_range": string,
    "compressed": boolean,
    "starting_point": string
  },
  "steps": [{ "step": number, "time": string, "action": string, "water_poured_g": number, "water_accumulated_g": number }],
  "quick_adjustments": {
    "too_acidic": string,
    "too_bitter": string,
    "flat_or_lifeless": string,
    "slow_drain": string,
    "fast_drain": string
  }
}

Keep parameters within their operating ranges. Ensure steps water_poured_g values sum to water_g. Ensure water_accumulated_g is a running total.`

  const userPrompt = `Current recipe:\n${JSON.stringify(scaledRecipe, null, 2)}\n\nUser's intent: ${intent.trim()}`

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const primaryResult = await runModelAdjustment(
    PRIMARY_MODEL,
    messages,
    sourceRow.bean_info,
    sourceRow.method,
  )

  if ('recipe' in primaryResult) {
    return NextResponse.json({ recipe: primaryResult.recipe })
  }

  console.warn(
    `[auto-adjust] primary model ${PRIMARY_MODEL} failed (${primaryResult.cause}); falling back to ${FALLBACK_MODEL}`,
  )

  const fallbackResult = await runModelAdjustment(
    FALLBACK_MODEL,
    messages,
    sourceRow.bean_info,
    sourceRow.method,
  )

  if ('recipe' in fallbackResult) {
    return NextResponse.json({ recipe: fallbackResult.recipe })
  }

  return NextResponse.json(
    { error: 'Auto-adjust failed after retries', validationErrors: fallbackResult.errors },
    { status: 422 },
  )
}
