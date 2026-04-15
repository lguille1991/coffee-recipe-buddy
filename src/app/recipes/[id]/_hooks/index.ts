// Recipe hooks barrel export

// useRecipeEditing exports
export {
  useRecipeEditing,
  type UseRecipeEditingOptions,
  type UseRecipeEditingReturn,
} from './useRecipeEditing'

// Derived state/actions types for useRecipeEditing
export type EditingState = Pick<
  import('./useRecipeEditing').UseRecipeEditingReturn,
  | 'isEditing'
  | 'editDraft'
  | 'editError'
  | 'stepError'
  | 'isSaving'
  | 'showDiscardConfirm'
  | 'pendingNavHref'
  | 'advancedOpen'
  | 'hasUnsavedChanges'
  | 'liveGrindSettings'
>

export type EditingActions = Pick<
  import('./useRecipeEditing').UseRecipeEditingReturn,
  | 'enterEditMode'
  | 'exitEditMode'
  | 'saveEdit'
  | 'setEditDraft'
  | 'setAdvancedOpen'
  | 'handleStepUpdate'
  | 'handleStepDelete'
  | 'handleStepAdd'
  | 'handleStepReorder'
  | 'confirmDiscard'
  | 'cancelDiscard'
>

// useRecipeSharing exports
export {
  useRecipeSharing,
  type UseRecipeSharingOptions,
  type UseRecipeSharingReturn,
} from './useRecipeSharing'

// Derived state/actions types for useRecipeSharing
export type SharingState = Pick<
  import('./useRecipeSharing').UseRecipeSharingReturn,
  | 'shareToken'
  | 'shareUrl'
  | 'commentCount'
  | 'sharing'
  | 'revoking'
  | 'copied'
  | 'showShareSheet'
  | 'showRevokeConfirm'
  | 'actionError'
>

export type SharingActions = Pick<
  import('./useRecipeSharing').UseRecipeSharingReturn,
  | 'handleShare'
  | 'handleRevoke'
  | 'handleCopy'
  | 'setShowShareSheet'
  | 'setShowRevokeConfirm'
>

// useRecipeNotes exports
export {
  useRecipeNotes,
  type UseRecipeNotesOptions,
  type UseRecipeNotesReturn,
} from './useRecipeNotes'

// Derived state/actions types for useRecipeNotes
export type NotesState = Pick<
  import('./useRecipeNotes').UseRecipeNotesReturn,
  'notes' | 'notesSaving' | 'notesError'
>

export type NotesActions = Pick<
  import('./useRecipeNotes').UseRecipeNotesReturn,
  'handleNotesChange'
>

// useRecipeHistory exports
export {
  useRecipeHistory,
  type UseRecipeHistoryOptions,
  type UseRecipeHistoryReturn,
} from './useRecipeHistory'

// Derived state/actions types for useRecipeHistory
export type HistoryState = Pick<
  import('./useRecipeHistory').UseRecipeHistoryReturn,
  | 'showEditHistorySheet'
  | 'selectedSnapshotIndex'
  | 'selectedSnapshot'
  | 'isSavingSnapshotAsNew'
  | 'isUsingSnapshotVersion'
  | 'actionError'
>

export type HistoryActions = Pick<
  import('./useRecipeHistory').UseRecipeHistoryReturn,
  | 'setShowEditHistorySheet'
  | 'handleNavigateSnapshot'
  | 'handleSaveSnapshotAsNew'
  | 'handleUseSnapshotVersion'
>
