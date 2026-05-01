import type {
  BeanProfile,
  MethodRecommendation,
  RecipeWithAdjustment,
  SaveRecipeRequest,
} from '@/types/recipe'
import type { ManualRecipeDraft } from '@/lib/manual-recipe'

const STORAGE_KEYS = {
  adjustmentHistory: 'adjustment_history',
  confirmedBean: 'confirmedBean',
  extractionResult: 'extractionResult',
  feedbackRound: 'feedback_round',
  manualRecipeDraft: 'manual_recipe_draft',
  manualEditHistory: 'manual_edit_history',
  methodRecommendations: 'methodRecommendations',
  pendingSaveRecipe: 'pending_save_recipe',
  recipe: 'recipe',
  recipeFlowSource: 'recipe_flow_source',
  recipeOriginal: 'recipe_original',
  scannedBagImageDataUrl: 'scanned_bag_image_data_url',
  restoreMethodSelection: 'restore_method_selection',
  selectedMethod: 'selectedMethod',
  targetVolumeMl: 'targetVolumeMl',
} as const

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const LOCAL_STORAGE_PREFIX = 'recipe_recovery:'
const LOCAL_STORAGE_TTL_MS = 1000 * 60 * 60 * 24

type LocalStorageEnvelope<T> = {
  savedAt: number
  value: T
}

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function getLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getLocalStorageKey(key: StorageKey) {
  return `${LOCAL_STORAGE_PREFIX}${key}`
}

function readPersistentValue<T>(key: StorageKey): T | null {
  const storage = getLocalStorage()
  if (!storage) return null

  const raw = storage.getItem(getLocalStorageKey(key))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as LocalStorageEnvelope<T>
    if (typeof parsed?.savedAt !== 'number') {
      storage.removeItem(getLocalStorageKey(key))
      return null
    }

    if (Date.now() - parsed.savedAt > LOCAL_STORAGE_TTL_MS) {
      storage.removeItem(getLocalStorageKey(key))
      return null
    }

    return parsed.value
  } catch {
    storage.removeItem(getLocalStorageKey(key))
    return null
  }
}

function writePersistentValue(key: StorageKey, value: unknown) {
  const storage = getLocalStorage()
  if (!storage) return

  const payload: LocalStorageEnvelope<unknown> = {
    savedAt: Date.now(),
    value,
  }

  storage.setItem(getLocalStorageKey(key), JSON.stringify(payload))
}

function removePersistentValue(key: StorageKey) {
  const storage = getLocalStorage()
  if (!storage) return
  storage.removeItem(getLocalStorageKey(key))
}

function readJson<T>(key: StorageKey): T | null {
  const sessionStorage = getSessionStorage()
  const sessionRaw = sessionStorage?.getItem(key)

  if (sessionRaw) {
    try {
      return JSON.parse(sessionRaw) as T
    } catch {
      sessionStorage?.removeItem(key)
    }
  }

  const persisted = readPersistentValue<T>(key)
  if (persisted !== null) {
    sessionStorage?.setItem(key, JSON.stringify(persisted))
  }

  return persisted
}

function writeJson(key: StorageKey, value: unknown) {
  const serialized = JSON.stringify(value)
  getSessionStorage()?.setItem(key, serialized)
  writePersistentValue(key, value)
}

function readString(key: StorageKey): string | null {
  const sessionStorage = getSessionStorage()
  const sessionValue = sessionStorage?.getItem(key)
  if (sessionValue !== null && sessionValue !== undefined) return sessionValue

  const persisted = readPersistentValue<string>(key)
  if (persisted !== null) {
    sessionStorage?.setItem(key, persisted)
  }

  return persisted
}

function writeString(key: StorageKey, value: string) {
  getSessionStorage()?.setItem(key, value)
  writePersistentValue(key, value)
}

function remove(key: StorageKey) {
  getSessionStorage()?.removeItem(key)
  removePersistentValue(key)
}

export const recipeSessionStorage = {
  clearAdjustmentHistory() {
    remove(STORAGE_KEYS.adjustmentHistory)
  },
  clearConfirmedBean() {
    remove(STORAGE_KEYS.confirmedBean)
  },
  clearExtractionResult() {
    remove(STORAGE_KEYS.extractionResult)
  },
  clearFeedbackRound() {
    remove(STORAGE_KEYS.feedbackRound)
  },
  clearManualRecipeDraft() {
    remove(STORAGE_KEYS.manualRecipeDraft)
  },
  clearManualEditHistory() {
    remove(STORAGE_KEYS.manualEditHistory)
  },
  clearMethodRecommendations() {
    remove(STORAGE_KEYS.methodRecommendations)
  },
  clearPendingSaveRecipe() {
    remove(STORAGE_KEYS.pendingSaveRecipe)
  },
  clearRecipe() {
    remove(STORAGE_KEYS.recipe)
  },
  clearRecipeFlowSource() {
    remove(STORAGE_KEYS.recipeFlowSource)
  },
  clearRecipeOriginal() {
    remove(STORAGE_KEYS.recipeOriginal)
  },
  clearScannedBagImageDataUrl() {
    remove(STORAGE_KEYS.scannedBagImageDataUrl)
  },
  clearRestoreMethodSelection() {
    remove(STORAGE_KEYS.restoreMethodSelection)
  },
  clearSelectedMethod() {
    remove(STORAGE_KEYS.selectedMethod)
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
  getManualRecipeDraft() {
    return readJson<ManualRecipeDraft>(STORAGE_KEYS.manualRecipeDraft)
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
  getRecipeFlowSource() {
    const source = readString(STORAGE_KEYS.recipeFlowSource)
    return source === 'manual' || source === 'generated' ? source : null
  },
  getRecipeOriginal() {
    return readJson<RecipeWithAdjustment>(STORAGE_KEYS.recipeOriginal)
  },
  getScannedBagImageDataUrl() {
    return readString(STORAGE_KEYS.scannedBagImageDataUrl)
  },
  shouldRestoreMethodSelection() {
    return readString(STORAGE_KEYS.restoreMethodSelection) === 'true'
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
  setManualRecipeDraft(value: ManualRecipeDraft) {
    writeJson(STORAGE_KEYS.manualRecipeDraft, value)
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
  setRecipeFlowSource(value: 'manual' | 'generated') {
    writeString(STORAGE_KEYS.recipeFlowSource, value)
  },
  setRecipeOriginal(value: RecipeWithAdjustment) {
    writeJson(STORAGE_KEYS.recipeOriginal, value)
  },
  setScannedBagImageDataUrl(value: string) {
    writeString(STORAGE_KEYS.scannedBagImageDataUrl, value)
  },
  setRestoreMethodSelection(value: boolean) {
    if (value) {
      writeString(STORAGE_KEYS.restoreMethodSelection, 'true')
      return
    }
    remove(STORAGE_KEYS.restoreMethodSelection)
  },
  setSelectedMethod<T>(value: T) {
    writeJson(STORAGE_KEYS.selectedMethod, value)
  },
  setTargetVolumeMl(value: number) {
    writeString(STORAGE_KEYS.targetVolumeMl, String(value))
  },
}
