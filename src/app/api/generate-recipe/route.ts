import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { DeterministicRecipeError } from '@/lib/deterministic-recipe-engine'
import { generateRecipe } from '@/lib/recipe-generation'
import { BeanProfileSchema, BrewGoalSchema, MethodIdSchema } from '@/types/recipe'

const GenerateRecipeRequestSchema = z.object({
  method: MethodIdSchema,
  bean: BeanProfileSchema,
  targetVolumeMl: z.number().int().positive().optional(),
  target_water_g: z.number().int().positive().optional(),
  recipe_mode: z.enum(['standard', 'four_six']).default('standard'),
  goal: BrewGoalSchema.default('balanced'),
}).superRefine((value, context) => {
  if (value.targetVolumeMl !== undefined && value.target_water_g !== undefined && value.targetVolumeMl !== value.target_water_g) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'targetVolumeMl and target_water_g must match when both are supplied.' })
  }
})

function evaluationDateUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof DeterministicRecipeError) {
    const status = error.code === 'CAPACITY_EXCEEDED' || error.code === 'UNSUPPORTED_MODE' ? 422 : 400
    return NextResponse.json({ error: error.message, code: error.code, bounds: error.bounds }, { status })
  }
  console.error('[generate-recipe]', error)
  return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = GenerateRecipeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 })
    }
    const { method, bean, recipe_mode, goal, targetVolumeMl, target_water_g } = parsed.data
    const recipe = generateRecipe({
      method,
      bean,
      targetWaterG: target_water_g ?? targetVolumeMl ?? 250,
      recipeMode: recipe_mode,
      goal,
      evaluationDate: evaluationDateUtc(),
    })
    return NextResponse.json(recipe)
  } catch (error) {
    return errorResponse(error)
  }
}
