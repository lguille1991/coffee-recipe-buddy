import { z } from 'zod'
import { BeanProfileSchema, BrewGoalSchema, MethodIdSchema, RecipeWithAdjustmentSchema } from '@/types/recipe'

export const CoffeeProfileScanSourceSchema = z.enum(['scan', 'manual', 'mixed'])

export const CoffeeProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  bean_profile_json: BeanProfileSchema,
  label: z.string().min(1).max(120),
  scan_source: CoffeeProfileScanSourceSchema.default('scan'),
  created_at: z.string(),
  updated_at: z.string(),
  last_used_at: z.string().nullable().optional(),
  archived_at: z.string().nullable().optional(),
})

export type CoffeeProfile = z.infer<typeof CoffeeProfileSchema>

export const CoffeeProfileImageSchema = z.object({
  id: z.string().uuid(),
  coffee_profile_id: z.string().uuid(),
  user_id: z.string().uuid(),
  storage_bucket: z.string(),
  storage_path: z.string(),
  mime_type: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size_bytes: z.number().int().positive(),
  sha256: z.string().nullable().optional(),
  is_primary: z.boolean().default(true),
  created_at: z.string(),
})

export type CoffeeProfileImage = z.infer<typeof CoffeeProfileImageSchema>

export const CreateCoffeeProfileRequestSchema = z.object({
  label: z.string().min(1).max(120),
  bean_profile_json: BeanProfileSchema,
  scan_source: CoffeeProfileScanSourceSchema.default('scan'),
})

export const UpdateCoffeeProfileRequestSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  bean_profile_json: BeanProfileSchema.optional(),
})

export const GenerateFromProfileRequestSchema = z.object({
  coffee_profile_id: z.string().uuid(),
  method: MethodIdSchema,
  goal: BrewGoalSchema,
  water_mode: z.enum(['absolute', 'delta']),
  water_grams: z.number().positive().optional(),
  water_delta_grams: z.number().int().min(-200).max(500).optional(),
  recipe_mode: z.enum(['standard', 'four_six']).default('standard'),
})
  .superRefine((value, ctx) => {
    if (value.water_mode === 'absolute' && typeof value.water_grams !== 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['water_grams'],
        message: 'water_grams is required for absolute mode',
      })
    }

    if (value.water_mode === 'delta' && typeof value.water_delta_grams !== 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['water_delta_grams'],
        message: 'water_delta_grams is required for delta mode',
      })
    }
  })

export const GenerationContextSchema = z.object({
  source: z.literal('profile'),
  goal: BrewGoalSchema,
  water_mode: z.enum(['absolute', 'delta']),
  water_grams: z.number().positive().optional(),
  water_delta_grams: z.number().int().optional(),
  method: MethodIdSchema,
})

export type GenerationContext = z.infer<typeof GenerationContextSchema>

export const GenerateFromProfileResponseSchema = z.object({
  recipe: RecipeWithAdjustmentSchema,
  recipeId: z.string().uuid(),
})
