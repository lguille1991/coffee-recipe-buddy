export type OpenRouterModelFeature =
  | 'recipe_generation'
  | 'bean_extraction'
  | 'auto_adjust'

const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash'

const FEATURE_ENV_KEYS: Record<OpenRouterModelFeature, string> = {
  recipe_generation: 'OPENROUTER_MODEL_RECIPE_GENERATION',
  bean_extraction: 'OPENROUTER_MODEL_BEAN_EXTRACTION',
  auto_adjust: 'OPENROUTER_MODEL_AUTO_ADJUST',
}

function readEnvValue(key: string): string | null {
  const value = process.env[key]?.trim()
  return value ? value : null
}

export function getOpenRouterModel(feature: OpenRouterModelFeature): string {
  return (
    readEnvValue(FEATURE_ENV_KEYS[feature]) ??
    readEnvValue('OPENROUTER_MODEL') ??
    DEFAULT_OPENROUTER_MODEL
  )
}
