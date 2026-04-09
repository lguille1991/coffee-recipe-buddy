import type {
  BeanProfile,
  MethodRecommendation,
  RecipeWithAdjustment,
  SaveRecipeRequest,
} from '@/types/recipe'

const STORAGE_KEYS = {
  adjustmentHistory: 'adjustment_history',
  confirmedBean: 'confirmedBean',
  extractionResult: 'extractionResult',
  feedbackRound: 'feedback_round',
  manualEditHistory: 'manual_edit_history',
  methodRecommendations: 'methodRecommendations',
  pendingSaveRecipe: 'pending_save_recipe',
  recipe: 'recipe',
  recipeOriginal: 'recipe_original',
  rebrewRecipeId: 'rebrew_recipe_id',
  selectedMethod: 'selectedMethod',
  targetVolumeMl: 'targetVolumeMl',
} as const

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

function getStorage() {
  if (typeof window === 'undefined') return null
  return window.sessionStorage
}

function readJson<T>(key: StorageKey): T | null {
  const storage = getStorage()
  if (!storage) return null

  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: StorageKey, value: unknown) {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(key, JSON.stringify(value))
}

function readString(key: StorageKey): string | null {
  const storage = getStorage()
  return storage?.getItem(key) ?? null
}

function writeString(key: StorageKey, value: string) {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(key, value)
}

function remove(key: StorageKey) {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(key)
}

export const recipeSessionStorage = {
  clearAdjustmentHistory() {
    remove(STORAGE_KEYS.adjustmentHistory)
  },
  clearExtractionResult() {
    remove(STORAGE_KEYS.extractionResult)
  },
  clearFeedbackRound() {
    remove(STORAGE_KEYS.feedbackRound)
  },
  clearManualEditHistory() {
    remove(STORAGE_KEYS.manualEditHistory)
  },
  clearPendingSaveRecipe() {
    remove(STORAGE_KEYS.pendingSaveRecipe)
  },
  clearRecipe() {
    remove(STORAGE_KEYS.recipe)
  },
  clearRecipeOriginal() {
    remove(STORAGE_KEYS.recipeOriginal)
  },
  clearRebrewRecipeId() {
    remove(STORAGE_KEYS.rebrewRecipeId)
  },
  clearTargetVolumeMl() {
    remove(STORAGE_KEYS.targetVolumeMl)
  },
  getAdjustmentHistory<T>() {
    return readJson<T[]>(STORAGE_KEYS.adjustmentHistory) ?? []
  },
  getConfirmedBean() {
    return readJson<BeanProfile>(STORAGE_KEYS.confirmedBean)
  },
  getExtractionResult<T>() {
    return readJson<T>(STORAGE_KEYS.extractionResult)
  },
  getFeedbackRound() {
    const raw = readString(STORAGE_KEYS.feedbackRound)
    if (!raw) return 0
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : 0
  },
  getManualEditHistory<T>() {
    return readJson<T[]>(STORAGE_KEYS.manualEditHistory) ?? []
  },
  getMethodRecommendations() {
    return readJson<MethodRecommendation[]>(STORAGE_KEYS.methodRecommendations) ?? []
  },
  getPendingSaveRecipe() {
    return readJson<SaveRecipeRequest>(STORAGE_KEYS.pendingSaveRecipe)
  },
  getRecipe() {
    return readJson<RecipeWithAdjustment>(STORAGE_KEYS.recipe)
  },
  getRecipeOriginal() {
    return readJson<RecipeWithAdjustment>(STORAGE_KEYS.recipeOriginal)
  },
  getRebrewRecipeId() {
    return readString(STORAGE_KEYS.rebrewRecipeId)
  },
  getSelectedMethod<T>() {
    return readJson<T>(STORAGE_KEYS.selectedMethod)
  },
  getTargetVolumeMl() {
    const raw = readString(STORAGE_KEYS.targetVolumeMl)
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  },
  setAdjustmentHistory<T>(value: T[]) {
    writeJson(STORAGE_KEYS.adjustmentHistory, value)
  },
  setConfirmedBean(value: BeanProfile) {
    writeJson(STORAGE_KEYS.confirmedBean, value)
  },
  setExtractionResult<T>(value: T) {
    writeJson(STORAGE_KEYS.extractionResult, value)
  },
  setFeedbackRound(value: number) {
    writeString(STORAGE_KEYS.feedbackRound, String(value))
  },
  setManualEditHistory<T>(value: T[]) {
    writeJson(STORAGE_KEYS.manualEditHistory, value)
  },
  setMethodRecommendations(value: MethodRecommendation[]) {
    writeJson(STORAGE_KEYS.methodRecommendations, value)
  },
  setPendingSaveRecipe(value: SaveRecipeRequest) {
    writeJson(STORAGE_KEYS.pendingSaveRecipe, value)
  },
  setRecipe(value: RecipeWithAdjustment) {
    writeJson(STORAGE_KEYS.recipe, value)
  },
  setRecipeOriginal(value: RecipeWithAdjustment) {
    writeJson(STORAGE_KEYS.recipeOriginal, value)
  },
  setRebrewRecipeId(value: string) {
    writeString(STORAGE_KEYS.rebrewRecipeId, value)
  },
  setSelectedMethod<T>(value: T) {
    writeJson(STORAGE_KEYS.selectedMethod, value)
  },
  setTargetVolumeMl(value: number) {
    writeString(STORAGE_KEYS.targetVolumeMl, String(value))
  },
}
