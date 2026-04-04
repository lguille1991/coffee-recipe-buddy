import { z } from 'zod'

// ─── Bean Profile ────────────────────────────────────────────────────────────

export const BeanProfileSchema = z.object({
  bean_name: z.string().optional(),
  roaster: z.string().optional(),
  variety: z.string().optional(),
  process: z.enum(['washed', 'natural', 'honey', 'anaerobic', 'unknown']),
  origin: z.string().optional(),
  altitude_masl: z.number().optional(),
  roast_level: z.enum(['light', 'medium-light', 'medium', 'medium-dark', 'dark']),
  tasting_notes: z.array(z.string()).optional(),
  roast_date: z.string().optional(), // ISO date string YYYY-MM-DD
})

export type BeanProfile = z.infer<typeof BeanProfileSchema>

export const ExtractionResponseSchema = z.object({
  bean: BeanProfileSchema,
  confidence: z.record(z.string(), z.number()),
})

export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>

// ─── Method Recommendation ───────────────────────────────────────────────────

export const MethodIdSchema = z.enum([
  'v60',
  'origami',
  'orea_v4',
  'hario_switch',
  'kalita_wave',
  'chemex',
  'ceado_hoop',
  'pulsar',
  'aeropress',
])

export type MethodId = z.infer<typeof MethodIdSchema>

export const METHOD_DISPLAY_NAMES: Record<MethodId, string> = {
  v60: 'Hario V60',
  origami: 'Origami Air M',
  orea_v4: 'Orea V4',
  hario_switch: 'Hario Switch',
  kalita_wave: 'Kalita Wave',
  chemex: 'Chemex',
  ceado_hoop: 'Ceado Hoop',
  pulsar: 'NextLevel Pulsar',
  aeropress: 'AeroPress',
}

export const MethodRecommendationSchema = z.object({
  method: MethodIdSchema,
  displayName: z.string(),
  rank: z.number().int().min(1).max(3),
  score: z.number(),
  rationale: z.string(),
})

export type MethodRecommendation = z.infer<typeof MethodRecommendationSchema>

// ─── Recipe ──────────────────────────────────────────────────────────────────

export const RecipeStepSchema = z.object({
  step: z.number().int().positive(),
  time: z.string(),
  action: z.string(),
  water_poured_g: z.number().min(0),
  water_accumulated_g: z.number().min(0),
})

export type RecipeStep = z.infer<typeof RecipeStepSchema>

export const GrinderSettingSchema = z.object({
  range: z.string(),
  starting_point: z.string(),
  description: z.string().optional(),
  note: z.string().optional(),
})

export const RecipeSchema = z.object({
  method: z.string(),
  display_name: z.string(),
  objective: z.string(),
  parameters: z.object({
    coffee_g: z.number().positive(),
    water_g: z.number().positive(),
    ratio: z.string(),
    temperature_c: z.number().min(60).max(100),
    filter: z.string(),
    total_time: z.string(),
  }),
  grind: z.object({
    k_ultra: GrinderSettingSchema,
    q_air: GrinderSettingSchema,
    baratza_encore_esp: GrinderSettingSchema,
  }),
  range_logic: z.object({
    base_range: z.string(),
    process_offset: z.string(),
    roast_offset: z.string(),
    freshness_offset: z.string(),
    density_offset: z.string(),
    final_operating_range: z.string(),
    compressed: z.boolean(),
    starting_point: z.string(),
  }),
  steps: z.array(RecipeStepSchema).min(1),
  quick_adjustments: z.object({
    too_acidic: z.string(),
    too_bitter: z.string(),
    flat_or_lifeless: z.string(),
    slow_drain: z.string(),
    fast_drain: z.string(),
  }),
})

export type Recipe = z.infer<typeof RecipeSchema>

// ─── Feedback & Adjustment ───────────────────────────────────────────────────

export const SymptomSchema = z.enum([
  'too_acidic',
  'too_bitter',
  'flat_lifeless',
  'slow_drain',
  'fast_drain',
])

export type Symptom = z.infer<typeof SymptomSchema>

export const AdjustmentMetadataSchema = z.object({
  round: z.number().int().min(1).max(3),
  symptom: SymptomSchema,
  variable_changed: z.string(),
  previous_value: z.string(),
  new_value: z.string(),
  direction: z.string(),
  note: z.string(),
})

export type AdjustmentMetadata = z.infer<typeof AdjustmentMetadataSchema>

// ─── Recipe (with optional adjustment) ──────────────────────────────────────

export const RecipeWithAdjustmentSchema = RecipeSchema.extend({
  adjustment_applied: AdjustmentMetadataSchema.optional(),
})

export type RecipeWithAdjustment = z.infer<typeof RecipeWithAdjustmentSchema>

// ─── Validation Result ───────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
}
