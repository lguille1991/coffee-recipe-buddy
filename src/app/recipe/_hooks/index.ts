// Export useManualRecipe hook and types
export {
  useManualRecipe,
  type UseManualRecipeOptions,
  type UseManualRecipeReturn,
} from './useManualRecipe'

// Export useFeedbackFlow hook and types
export {
  useFeedbackFlow,
  type UseFeedbackFlowOptions,
  type UseFeedbackFlowReturn,
} from './useFeedbackFlow'

// Derived types for cleaner consumption
// These extract state and actions from the main return types
export type ManualRecipeState = Pick<
  import('./useManualRecipe').UseManualRecipeReturn,
  | 'manualDraft'
  | 'isSaving'
  | 'saveError'
  | 'stepError'
  | 'validation'
  | 'requiredState'
>

export type ManualRecipeActions = Pick<
  import('./useManualRecipe').UseManualRecipeReturn,
  | 'updateDraft'
  | 'handleStepUpdate'
  | 'handleStepDelete'
  | 'handleStepAdd'
  | 'handleStepReorder'
  | 'handleSaveManual'
>

export type FeedbackFlowState = Pick<
  import('./useFeedbackFlow').UseFeedbackFlowReturn,
  | 'recipe'
  | 'originalRecipe'
  | 'feedbackRound'
  | 'adjustmentHistory'
  | 'isAdjusting'
  | 'adjustError'
  | 'saving'
  | 'saveError'
  | 'lastSavedRound'
  | 'hasUnsavedChanges'
  | 'maxRoundsReached'
  | 'currentAdjustment'
  | 'showFeedback'
  | 'selectedSymptom'
>

export type FeedbackFlowActions = Pick<
  import('./useFeedbackFlow').UseFeedbackFlowReturn,
  | 'handleAdjust'
  | 'handleReset'
  | 'handleSaveFeedback'
  | 'setShowFeedback'
  | 'setSelectedSymptom'
>
