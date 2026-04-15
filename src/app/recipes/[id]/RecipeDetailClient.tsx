'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmSheet from '@/components/ConfirmSheet'
import { expectOk, runClientMutation } from '@/lib/client-mutation'
import { recalculateFreshness, type FreshnessAdjustment } from '@/lib/freshness-recalculator'
import { useProfile } from '@/hooks/useProfile'
import { isManualRecipeCreated } from '@/lib/recipe-origin'
import type { SavedRecipeDetail } from '@/types/recipe'
import {
  EditHistorySheet as RecipeEditHistorySheet,
  ManualCreatorSheet,
  RecipeTitleBlock,
  RecipeViewGrindSettings,
  RecipeViewParameters,
  RecipeViewSteps,
  ShareSheet,
} from './_components/RecipeDetailSections'
import RecipeEditForm from './_components/RecipeEditForm'
import {
  useRecipeEditing,
  useRecipeSharing,
  useRecipeNotes,
  useRecipeHistory,
} from './_hooks'
import { isFeedbackRound, isManualEditRound, type AnyFeedbackRound } from './_lib/editing'

type RecipeDetailClientProps = {
  id: string
  initialRecipe: SavedRecipeDetail
  initialShareToken: string | null
  initialShareUrl: string
  initialCommentCount: number | null
}

export default function RecipeDetailClient({
  id,
  initialRecipe,
  initialShareToken,
  initialShareUrl,
  initialCommentCount,
}: RecipeDetailClientProps) {
  const router = useRouter()
  const { profile, preferredGrinder } = useProfile()
  const tempUnit = profile?.temp_unit ?? 'C'

  // Core recipe state
  const [recipe, setRecipe] = useState<SavedRecipeDetail>(initialRecipe)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Freshness state (kept inline)
  const [freshnessAdj, setFreshnessAdj] = useState<FreshnessAdjustment | null>(null)
  const [freshnessIgnored, setFreshnessIgnored] = useState(false)

  // Secondary grinders accordion state
  const [secondaryGrindersOpen, setSecondaryGrindersOpen] = useState(false)
  const [showManualCreatorSheet, setShowManualCreatorSheet] = useState(false)

  // Derived data
  const currentRecipe = recipe.current_recipe_json
  const snapshots = recipe.snapshots
  const allHistory = (recipe.feedback_history ?? []) as AnyFeedbackRound[]
  const manualEditRounds = allHistory.filter(isManualEditRound)
  const feedbackRounds = allHistory.filter(isFeedbackRound)
  const hasManualEdits = manualEditRounds.length > 0
  const hasFeedbackAdjustments = feedbackRounds.length > 0
  const isManualCreated = isManualRecipeCreated(currentRecipe)

  const liveSnapshotIndex = useMemo(() => {
    if (!recipe.live_snapshot_id) return Math.max(snapshots.length - 1, 0)
    const index = snapshots.findIndex(snapshot => snapshot.id === recipe.live_snapshot_id)
    return index >= 0 ? index : Math.max(snapshots.length - 1, 0)
  }, [recipe.live_snapshot_id, snapshots])

  const versionN = useMemo(() => {
    const selectedSnapshot = snapshots[liveSnapshotIndex]
    return selectedSnapshot?.snapshot_index ?? snapshots.length
  }, [snapshots, liveSnapshotIndex])

  // Freshness effect
  useEffect(() => {
    const adjustment = recalculateFreshness(
      recipe.current_recipe_json,
      recipe.bean_info.roast_date ?? undefined,
    )
    if (adjustment.adjusted) {
      setFreshnessAdj(adjustment)
    } else {
      setFreshnessAdj(null)
    }
  }, [recipe.bean_info.roast_date, recipe.current_recipe_json])

  // Hooks
  const editing = useRecipeEditing({
    id,
    recipe,
    tempUnit,
    preferredGrinder,
    onRecipeUpdate: (updatedRecipe) => {
      setRecipe(updatedRecipe)
      notes.handleNotesChange(updatedRecipe.notes ?? '')
    },
  })

  const sharing = useRecipeSharing({
    recipeId: id,
    initialShareToken,
    initialShareUrl,
    initialCommentCount,
  })

  const notes = useRecipeNotes({
    recipeId: id,
    initialNotes: initialRecipe.notes ?? null,
  })

  const history = useRecipeHistory({
    recipeId: id,
    recipe,
    onRecipeUpdate: (updatedRecipe) => {
      setRecipe(updatedRecipe)
      notes.handleNotesChange(updatedRecipe.notes ?? '')
    },
  })

  // Handlers
  async function handleDelete() {
    setDeleting(true)
    setActionError(null)
    await runClientMutation({
      execute: async () => {
        const response = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
        return expectOk(response, 'Failed to delete recipe')
      },
      onSuccess: () => router.replace('/recipes'),
      onError: setActionError,
      onSettled: () => setDeleting(false),
      errorMessage: 'Failed to delete recipe. Please try again.',
    })
  }

  function handleOpenBrewMode() {
    router.push(`/recipes/${id}/brew`)
  }

  // Determine active grind for display
  const activeGrind = (editing.isEditing && editing.liveGrindSettings)
    ? editing.liveGrindSettings
    : currentRecipe.grind

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      <div className="flex items-center justify-between px-4 sm:px-6 pb-4 ui-animate-enter">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (editing.isEditing) {
                if (editing.hasUnsavedChanges) {
                  editing.setShowDiscardConfirm(true)
                } else {
                  editing.exitEditMode()
                }
              } else {
                router.back()
              }
            }}
            className="ui-icon-button -ml-2"
            aria-label="Go back"
          >
            <svg className="ui-icon-action" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="ui-section-title">{editing.isEditing ? 'Edit Recipe' : 'Saved Recipe'}</p>
        </div>

        {!editing.isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={sharing.shareToken ? () => sharing.setShowShareSheet(true) : sharing.handleShare}
              disabled={sharing.sharing}
              className="ui-icon-button text-[var(--muted-foreground)] disabled:opacity-40"
              aria-label="Share recipe"
            >
              {sharing.sharing ? (
                <div className="w-[18px] h-[18px] border-2 border-[var(--muted-foreground)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="ui-icon-action" viewBox="0 0 18 18" fill="none">
                  <path d="M13 12.5C12.4 12.5 11.87 12.74 11.47 13.12L6.62 10.3C6.67 10.1 6.7 9.9 6.7 9.68C6.7 9.46 6.67 9.26 6.62 9.06L11.42 6.27C11.83 6.68 12.39 6.94 13 6.94C14.24 6.94 15.25 5.93 15.25 4.69C15.25 3.45 14.24 2.44 13 2.44C11.76 2.44 10.75 3.45 10.75 4.69C10.75 4.91 10.78 5.11 10.83 5.31L6.03 8.1C5.62 7.69 5.06 7.44 4.45 7.44C3.21 7.44 2.2 8.45 2.2 9.69C2.2 10.93 3.21 11.94 4.45 11.94C5.06 11.94 5.62 11.68 6.03 11.27L10.88 14.1C10.83 14.29 10.8 14.49 10.8 14.69C10.8 15.9 11.79 16.88 13 16.88C14.21 16.88 15.2 15.9 15.2 14.69C15.2 13.48 14.21 12.5 13 12.5Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="ui-icon-button ui-text-danger"
              aria-label="Delete recipe"
            >
              <svg className="ui-icon-action" viewBox="0 0 18 18" fill="none">
                <path d="M3 5H15M6 5V3.5C6 3.22 6.22 3 6.5 3H11.5C11.78 3 12 3.22 12 3.5V5M7 8.5V13M11 8.5V13M4.5 5L5.5 15H12.5L13.5 5H4.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)+17rem)] lg:pb-52 overflow-y-auto ui-animate-enter-soft">
        <RecipeTitleBlock
          commentCount={sharing.commentCount}
          hasFeedbackAdjustments={hasFeedbackAdjustments}
          isManualCreated={isManualCreated}
          hasManualEdits={hasManualEdits}
          isEditing={editing.isEditing}
          onOpenManualCreator={() => setShowManualCreatorSheet(true)}
          onOpenEditHistory={() => history.setShowEditHistorySheet(true)}
          onOpenParentRecipe={() => router.push(`/recipes/${recipe.parent_recipe_id}`)}
          onOpenShare={() => sharing.setShowShareSheet(true)}
          recipe={recipe}
          shareToken={sharing.shareToken}
          versionN={versionN}
        />

        {freshnessAdj && !freshnessIgnored && !editing.isEditing && (
          <div className="ui-alert-warning flex flex-col gap-2">
            <p className="ui-card-title ui-text-warning">Freshness updated</p>
            <p className="ui-body-muted ui-text-warning">
              This coffee is now {freshnessAdj.daysPostRoast} days post-roast ({freshnessAdj.freshnessLabel}).
              Recipe adjusted for freshness.
            </p>
            {freshnessAdj.changedFields.map(field => (
              <p key={field.field} className="ui-meta ui-text-warning">
                {field.field}: {field.previous} → {field.next}
              </p>
            ))}
            <button onClick={() => setFreshnessIgnored(true)} className="ui-focus-ring ui-pressable rounded-md ui-meta ui-text-warning underline self-start">
              Keep original recipe
            </button>
          </div>
        )}

        {editing.editError && (
          <div className="ui-alert-danger text-sm">
            {editing.editError}
          </div>
        )}

        {(actionError || sharing.actionError || history.actionError) && !editing.isEditing && (
          <div className="ui-alert-danger text-sm">
            {actionError || sharing.actionError || history.actionError}
          </div>
        )}

        {editing.isEditing && editing.editDraft ? (
          <RecipeEditForm
            editDraft={editing.editDraft}
            tempUnit={tempUnit}
            preferredGrinder={preferredGrinder}
            editError={editing.editError}
            stepError={editing.stepError}
            advancedOpen={editing.advancedOpen}
            setAdvancedOpen={editing.setAdvancedOpen}
            setEditDraft={editing.setEditDraft}
            liveGrindSettings={editing.liveGrindSettings}
            currentRecipe={currentRecipe}
            onStepUpdate={editing.handleStepUpdate}
            onStepDelete={editing.handleStepDelete}
            onStepAdd={editing.handleStepAdd}
            onStepReorder={editing.handleStepReorder}
            secondaryGrindersOpen={secondaryGrindersOpen}
            setSecondaryGrindersOpen={setSecondaryGrindersOpen}
          />
        ) : (
          <>
            <RecipeViewParameters preferredGrinder={preferredGrinder} recipe={currentRecipe} tempUnit={tempUnit} />
            <RecipeViewGrindSettings
              activeGrind={activeGrind}
              preferredGrinder={preferredGrinder}
              secondaryGrindersOpen={secondaryGrindersOpen}
              setSecondaryGrindersOpen={setSecondaryGrindersOpen}
            />
            <div>
              <h2 className="ui-overline mb-2">Brew Steps</h2>
              <RecipeViewSteps recipe={currentRecipe} />
            </div>

            {feedbackRounds.length > 0 && (
              <div>
                <h2 className="ui-overline mb-2">Adjustment History</h2>
                <div className="flex flex-col gap-2">
                  {feedbackRounds.map((feedback, index) => (
                    <div key={index} className="bg-[var(--card)] rounded-xl px-4 py-3 ui-body-muted">
                      <span className="font-medium text-[var(--foreground)]">Round {feedback.round}</span>
                      {' · '}
                      {feedback.variable_changed}: {feedback.previous_value} → {feedback.new_value}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="ui-overline">Notes</h2>
                {notes.notesSaving && <span className="ui-meta">Saving…</span>}
              </div>
              <textarea
                value={notes.notes}
                onChange={event => notes.handleNotesChange(event.target.value)}
                maxLength={1000}
                placeholder="Add notes about this brew…"
                rows={3}
                className="ui-textarea"
              />
              {notes.notesError && (
                <p className="ui-meta ui-text-danger mt-2">{notes.notesError}</p>
              )}
              <p className="ui-meta text-right mt-1">{notes.notes.length}/1000</p>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-56">
        <div className="ui-sticky-footer w-full px-4 sm:px-6 md:max-w-2xl md:mx-auto lg:max-w-3xl xl:max-w-5xl xl:px-8 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-6 pt-3">
          {editing.isEditing ? (
            <div className="flex flex-col gap-2">
              <button onClick={editing.saveEdit} disabled={editing.isSaving} className="w-full ui-button-primary font-semibold">
                {editing.isSaving ? (
                  <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                ) : 'Save'}
              </button>
              <button
                onClick={() => {
                  if (editing.hasUnsavedChanges) {
                    editing.setShowDiscardConfirm(true)
                    return
                  }
                  editing.exitEditMode()
                }}
                disabled={editing.isSaving}
                className="w-full ui-button-secondary text-[var(--muted-foreground)]"
              >
                Discard
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button onClick={handleOpenBrewMode} className="w-full ui-button-primary font-semibold">
                <svg className="ui-icon-inline" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3H13L11.5 10H4.5L3 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.5 10C4.5 12 5.5 13 8 13C10.5 13 11.5 12 11.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M11 3C12.1 3 13 4.1 13 5.5C13 6.9 12.1 8 11 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Brew
              </button>
              <button onClick={editing.enterEditMode} className="w-full ui-button-secondary">
                <svg className="ui-icon-inline" viewBox="0 0 16 16" fill="none">
                  <path d="M2 14L5.5 13L13.5 5C14.05 4.45 14.05 3.55 13.5 3L13 2.5C12.45 1.95 11.55 1.95 11 2.5L3 10.5L2 14Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10.5 3L13 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Edit Recipe
              </button>
              <button
                onClick={() => router.push(`/recipes/${id}/auto-adjust`)}
                className="w-full ui-button-secondary"
              >
                <svg className="ui-icon-inline" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L9.5 6H14L10.5 8.5L12 12.5L8 10L4 12.5L5.5 8.5L2 6H6.5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Auto Adjust
              </button>
            </div>
          )}
        </div>
      </div>

      <ShareSheet
        copied={sharing.copied}
        onClose={() => sharing.setShowShareSheet(false)}
        onCopy={sharing.handleCopy}
        onRevoke={() => sharing.setShowRevokeConfirm(true)}
        open={sharing.showShareSheet}
        shareToken={sharing.shareToken}
        shareUrl={sharing.shareUrl}
      />

      <RecipeEditHistorySheet
        activeSnapshotId={recipe.live_snapshot_id}
        isSaveAsNewPending={history.isSavingSnapshotAsNew}
        isUseVersionPending={history.isUsingSnapshotVersion}
        onClose={() => history.setShowEditHistorySheet(false)}
        onNavigate={history.handleNavigateSnapshot}
        onSaveAsNew={history.handleSaveSnapshotAsNew}
        onUseThisVersion={history.handleUseSnapshotVersion}
        open={history.showEditHistorySheet}
        selectedSnapshot={history.selectedSnapshot}
        selectedSnapshotIndex={history.selectedSnapshotIndex}
        snapshots={snapshots}
      />

      <ManualCreatorSheet
        creatorName={recipe.creator_display_name ?? profile?.display_name ?? 'you'}
        onClose={() => setShowManualCreatorSheet(false)}
        open={showManualCreatorSheet}
      />

      {showDeleteConfirm && (
        <div className="ui-sheet-overlay items-end pb-[env(safe-area-inset-bottom)] sm:items-center sm:pb-0 lg:pl-56">
          <div className="ui-sheet-panel rounded-t-3xl px-6 pt-6 pb-10 sm:rounded-3xl max-w-sm">
            <h3 className="ui-sheet-title mb-1">Delete this recipe?</h3>
            <p className="ui-sheet-body mb-6">This action cannot be undone.</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDelete} disabled={deleting} className="w-full ui-button-danger-solid font-semibold">
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : 'Delete Recipe'}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="w-full ui-button-secondary bg-[var(--background)] border-transparent">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={sharing.showRevokeConfirm}
        title="Revoke share link?"
        message="Anyone with the current link will lose access. This cannot be undone."
        confirmLabel="Revoke Link"
        destructive
        loading={sharing.revoking}
        onConfirm={sharing.handleRevoke}
        onCancel={() => sharing.setShowRevokeConfirm(false)}
      />

      <ConfirmSheet
        open={editing.showDiscardConfirm}
        title="Discard changes?"
        message="Your edits to this recipe won't be saved."
        confirmLabel="Discard"
        destructive
        onConfirm={editing.confirmDiscard}
        onCancel={editing.cancelDiscard}
      />
    </div>
  )
}
