import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { RecipeSchema, SymptomSchema } from '@/types/recipe'
import { applyFeedbackAdjustment } from '@/lib/adjustment-engine'

const RequestSchema = z.object({
  current_recipe: RecipeSchema,
  symptom: SymptomSchema,
  round: z.number().int().min(1).max(3),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { current_recipe, symptom, round } = parsed.data

  if (round > 3) {
    return NextResponse.json(
      { error: 'Maximum 3 feedback rounds reached' },
      { status: 400 },
    )
  }

  try {
    const { recipe } = applyFeedbackAdjustment(current_recipe, symptom, round)
    return NextResponse.json(recipe)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Adjustment failed' },
      { status: 500 },
    )
  }
}
