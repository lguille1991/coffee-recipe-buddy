import type OpenAI from 'openai'
import { buildRecipePrompt } from '@/lib/prompt-builder'
import { applyFourSixRecipeMode } from '@/lib/skill-recipe-mode-engine'
import { applySkillBrewParameterSettings } from '@/lib/skill-brew-parameters-engine'
import { applySkillGrindSettings } from '@/lib/skill-grind-engine'
import { applySkillTemperatureSettings } from '@/lib/skill-temperature-engine'
import { buildRetryPrompt, validateRecipe } from '@/lib/recipe-validator'
import type { BeanProfile, Recipe } from '@/types/recipe'

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

export async function generateRecipeWithRetries({
  client,
  openRouterUser,
  method,
  bean,
  targetVolumeMl,
  recipeMode,
  strictParityMode,
}: {
  client: OpenAI
  openRouterUser: string
  method: string
  bean: BeanProfile
  targetVolumeMl?: number
  recipeMode?: 'standard' | 'four_six'
  strictParityMode?: boolean
}) {
  const { system, user: userPrompt } = buildRecipePrompt(bean, method, targetVolumeMl)

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

        throw new Error('MODEL_CREDIT_LIMIT')
      }

      throw error
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

    const validation = validateRecipe(parsed, bean, method)

    if (validation.valid) {
      const baseRecipe = {
        ...(parsed as Recipe),
        recipe_mode: recipeMode === 'four_six' ? 'four_six' : 'standard',
      } as Recipe

      const modeAdjusted = baseRecipe.recipe_mode === 'four_six'
        ? applyFourSixRecipeMode(baseRecipe, bean)
        : baseRecipe

      const brewAdjusted = modeAdjusted.recipe_mode === 'four_six'
        ? modeAdjusted
        : applySkillBrewParameterSettings(modeAdjusted, bean)
      const temperatureAdjusted = brewAdjusted.recipe_mode === 'four_six'
        ? brewAdjusted
        : applySkillTemperatureSettings(brewAdjusted, bean)
      const recipe = applySkillGrindSettings(temperatureAdjusted, bean, {
        strictParityMode: strictParityMode ?? false,
      })

      const deterministicValidation = validateRecipe(recipe, bean, method)
      if (!deterministicValidation.valid) {
        throw new Error(`DETERMINISTIC_VALIDATION_FAILED:${deterministicValidation.errors.join('; ')}`)
      }

      return recipe
    }

    lastErrors = validation.errors
    messages.push({ role: 'assistant', content: rawText })
    messages.push({ role: 'user', content: buildRetryPrompt(validation.errors) })
    attempt++
  }

  throw new Error(`GENERATION_FAILED:${lastErrors.join('; ')}`)
}
