import { z } from 'zod'

// ─── Bean Profile ────────────────────────────────────────────────────────────

export const BeanProfileSchema = z.object({
  bean_name: z.string().nullable().optional(),
  roaster: z.string().nullable().optional(),
  variety: z.string().nullable().optional(),
  finca: z.string().nullable().optional(),
  producer: z.string().nullable().optional(),
  process: z.enum(['washed', 'natural', 'honey', 'anaerobic', 'unknown']),
  origin: z.string().nullable().optional(),
  altitude_masl: z.number().nullable().optional(),
  roast_level: z.enum(['light', 'medium-light', 'medium', 'medium-dark', 'dark']).catch('medium'),
  tasting_notes: z.array(z.string()).nullable().optional(),
  roast_date: z.string().nullable().optional(), // ISO date string YYYY-MM-DD
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

export const BrewGoalSchema = z.enum([
  'clarity',
  'balanced',
  'sweetness',
  'body',
  'forgiving',
])

export type BrewGoal = z.infer<typeof BrewGoalSchema>

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
  reasonBadges: z.array(z.string()).default([]),
  confidence: z.enum(['high', 'medium', 'low']).default('high'),
  confidenceNote: z.string().optional(),
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
export type RecipeDraftStep = RecipeStep & { _dndId: string }

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
    timemore_c2: GrinderSettingSchema,
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

// ─── Phase 3: Persistence types ──────────────────────────────────────────────

export const FeedbackRoundSchema = z.object({
  type: z.literal('feedback').default('feedback'),
  round: z.number().int().min(1).max(3),
  symptom: SymptomSchema,
  variable_changed: z.string(),
  previous_value: z.string(),
  new_value: z.string(),
})

export type FeedbackRound = z.infer<typeof FeedbackRoundSchema>

export const RecipeChangeSchema = z.object({
  field: z.string(),
  previous_value: z.string(),
  new_value: z.string(),
})

export type RecipeChange = z.infer<typeof RecipeChangeSchema>

export const ManualEditRoundSchema = z.object({
  type: z.enum(['manual_edit', 'auto_adjust']),
  version: z.number().int().positive(),
  edited_at: z.string(),
  changes: z.array(RecipeChangeSchema),
})

export type ManualEditRound = z.infer<typeof ManualEditRoundSchema>

export const AnyFeedbackRoundSchema = z.union([FeedbackRoundSchema, ManualEditRoundSchema])
export type AnyFeedbackRound = z.infer<typeof AnyFeedbackRoundSchema>

export const GrinderIdSchema = z.enum(['k_ultra', 'q_air', 'baratza_encore_esp', 'timemore_c2'])
export type GrinderId = z.infer<typeof GrinderIdSchema>

export const GRINDER_DISPLAY_NAMES: Record<GrinderId, string> = {
  k_ultra: '1Zpresso K-Ultra',
  q_air: '1Zpresso Q-Air',
  baratza_encore_esp: 'Baratza Encore ESP',
  timemore_c2: 'Timemore C2',
}

export const UserProfileSchema = z.object({
  display_name: z.string().nullable().optional(),
  default_volume_ml: z.number().int().positive().default(250),
  temp_unit: z.enum(['C', 'F']).default('C'),
  preferred_grinder: GrinderIdSchema.default('k_ultra'),
})

export type UserProfile = z.infer<typeof UserProfileSchema>

export const RecipeSnapshotKindSchema = z.enum([
  'initial',
  'manual_edit',
  'auto_adjust',
  'clone',
])

export type RecipeSnapshotKind = z.infer<typeof RecipeSnapshotKindSchema>

export const RecipeSnapshotSchema = z.object({
  id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  user_id: z.string().uuid(),
  snapshot_index: z.number().int().positive(),
  snapshot_kind: RecipeSnapshotKindSchema,
  snapshot_recipe_json: RecipeWithAdjustmentSchema,
  change_summary: z.array(RecipeChangeSchema).default([]),
  created_at: z.string(),
  source_snapshot_id: z.string().uuid().nullable().optional(),
})

export type RecipeSnapshot = z.infer<typeof RecipeSnapshotSchema>

export const SavedRecipeSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  schema_version: z.number().int().default(1),
  bean_info: BeanProfileSchema,
  method: z.string(),
  original_recipe_json: RecipeSchema,
  current_recipe_json: RecipeWithAdjustmentSchema,
  feedback_history: z.array(AnyFeedbackRoundSchema).default([]),
  image_url: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  creator_display_name: z.string().nullable().optional(),
  created_at: z.string(),
  archived: z.boolean().default(false),
  live_snapshot_id: z.string().uuid().nullable().optional(),
  parent_recipe_id: z.string().uuid().nullable().optional(),
  scale_factor: z.number().nullable().optional(),
})

export type SavedRecipe = z.infer<typeof SavedRecipeSchema>

export const SavedRecipeDetailSchema = SavedRecipeSchema.extend({
  snapshots: z.array(RecipeSnapshotSchema).default([]),
})

export type SavedRecipeDetail = z.infer<typeof SavedRecipeDetailSchema>

// ─── API request/response schemas ────────────────────────────────────────────

export const SaveRecipeRequestSchema = z.object({
  bean_info: BeanProfileSchema,
  method: z.string().min(1),
  original_recipe_json: RecipeSchema,
  current_recipe_json: RecipeWithAdjustmentSchema,
  feedback_history: z.array(AnyFeedbackRoundSchema).default([]),
  image_data_url: z.string().optional(), // base64 data URL — uploaded server-side
  parent_recipe_id: z.string().uuid().nullable().optional(),
  scale_factor: z.number().nullable().optional(),
})

export type SaveRecipeRequest = z.infer<typeof SaveRecipeRequestSchema>

export const RecipeListItemSchema = z.object({
  id: z.string().uuid(),
  method: z.string(),
  bean_info: BeanProfileSchema,
  image_url: z.string().nullable().optional(),
  created_at: z.string(),
  schema_version: z.number().int(),
  is_manual_created: z.boolean().default(false),
  has_manual_edits: z.boolean().default(false),
  has_feedback_adjustments: z.boolean().default(false),
  is_scaled: z.boolean().default(false),
})

export type RecipeListItem = z.infer<typeof RecipeListItemSchema>

export const UpdateRecipeRequestSchema = z.object({
  snapshot_kind: RecipeSnapshotKindSchema,
  change_summary: z.array(RecipeChangeSchema).default([]),
  current_recipe_json: RecipeWithAdjustmentSchema,
  feedback_history: z.array(AnyFeedbackRoundSchema),
  source_snapshot_id: z.string().uuid().nullable().optional(),
})

export type UpdateRecipeRequest = z.infer<typeof UpdateRecipeRequestSchema>

export const UpdateNotesRequestSchema = z.object({
  notes: z.string().max(1000).nullable(),
})

export type UpdateNotesRequest = z.infer<typeof UpdateNotesRequestSchema>

export const UseRecipeSnapshotRequestSchema = z.object({
  live_snapshot_id: z.string().uuid(),
})

export type UseRecipeSnapshotRequest = z.infer<typeof UseRecipeSnapshotRequestSchema>

export const UpdateProfileRequestSchema = z.object({
  display_name: z.string().nullable().optional(),
  default_volume_ml: z.number().int().positive().optional(),
  temp_unit: z.enum(['C', 'F']).optional(),
  preferred_grinder: GrinderIdSchema.optional(),
})

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>

// ─── Comments ─────────────────────────────────────────────────────────────────

export const RecipeCommentSchema = z.object({
  id: z.string().uuid(),
  share_token: z.string(),
  author_id: z.string().uuid(),
  body: z.string().max(500),
  created_at: z.string(),
  author_display_name: z.string().nullable().optional(),
})

export type RecipeComment = z.infer<typeof RecipeCommentSchema>

export const CreateCommentRequestSchema = z.object({
  body: z.string().min(1).max(500),
})

export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>

// ─── Sharing ──────────────────────────────────────────────────────────────────

export const ShareSnapshotSchema = z.object({
  bean_info: BeanProfileSchema,
  current_recipe_json: RecipeWithAdjustmentSchema,
  image_url: z.string().nullable().optional(),
  owner_display_name: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export type ShareSnapshot = z.infer<typeof ShareSnapshotSchema>

export const ShareResponseSchema = z.object({
  shareToken: z.string(),
  url: z.string(),
})

export type ShareResponse = z.infer<typeof ShareResponseSchema>

export const PublicShareResponseSchema = z.object({
  shareToken: z.string(),
  title: z.string().nullable().optional(),
  createdAt: z.string(),
  snapshot: ShareSnapshotSchema,
})

export type PublicShareResponse = z.infer<typeof PublicShareResponseSchema>
