'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'
import { expectOk, runClientMutation } from '@/lib/client-mutation'
import { computeGrindScalingDelta } from '@/lib/grind-scaling-engine'
import { recalculateFreshness, type FreshnessAdjustment } from '@/lib/freshness-recalculator'
import { buildDerivedGrindSettings } from '@/lib/grind-settings'
import {
  grinderValueToKUltraClicks,
  kUltraClicksToGrinderValue,
  parseGrinderValueForEdit,
  parseKUltraRange,
} from '@/lib/grinder-converter'
import { useProfile } from '@/hooks/useProfile'
import { isManualRecipeCreated } from '@/lib/recipe-origin'
import type {
  ManualEditRound,
  RecipeDraftStep,
  RecipeWithAdjustment,
  SavedRecipeDetail,
} from '@/types/recipe'
import {
  EditHistorySheet as RecipeEditHistorySheet,
  ManualCreatorSheet,
  RecipeEditGrindSettings,
  RecipeTitleBlock,
  RecipeViewGrindSettings,
  RecipeViewParameters,
  RecipeViewSteps,
  ShareSheet,
  getGrindRangeForEdit,
  isQAirValueInvalid,
} from './_components/RecipeDetailSections'
import {
  buildLiveGrindSettings,
  createEditDraft,
  hasEditDraftChanges,
  isFeedbackRound,
  isManualEditRound,
  recomputeAccumulated,
  scaleStepsToWater,
  type AnyFeedbackRound,
  type EditDraft,
  validateSteps,
} from './_lib/editing'
const SortableStepList = dynamic(() => import('./SortableStepList'), { ssr: false })

type RecipeDetailClientProps = {
  id: string
  initialRecipe: SavedRecipeDetail
  initialShareToken: string | null
  initialShareUrl: string
  initialCommentCount: number | null
}

function parseWholeNumberInput(value: string): number | '' {
  if (value === '') return ''
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? '' : Math.max(0, parsed)
}

export default function RecipeDetailClient({
  id,
  initialRecipe,
  initialShareToken,
  initialShareUrl,
  initialCommentCount,
}: RecipeDetailClientProps) {
  const router = useRouter()
  const { setGuard } = useNavGuard()
  const { profile, preferredGrinder } = useProfile()
  const tempUnit = profile?.temp_unit ?? 'C'

  const [recipe, setRecipe] = useState<SavedRecipeDetail>(initialRecipe)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [freshnessAdj, setFreshnessAdj] = useState<FreshnessAdjustment | null>(null)
  const [freshnessIgnored, setFreshnessIgnored] = useState(false)
  const [notes, setNotes] = useState(initialRecipe.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken)
  const [shareUrl, setShareUrl] = useState(initialShareUrl)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [commentCount, setCommentCount] = useState<number | null>(initialCommentCount)
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  const [showEditHistorySheet, setShowEditHistorySheet] = useState(false)
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState(0)
  const [isSavingSnapshotAsNew, setIsSavingSnapshotAsNew] = useState(false)
  const [isUsingSnapshotVersion, setIsUsingSnapshotVersion] = useState(false)
  const [showManualCreatorSheet, setShowManualCreatorSheet] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [secondaryGrindersOpen, setSecondaryGrindersOpen] = useState(false)

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

  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) {
        clearTimeout(notesDebounceRef.current)
      }
    }
  }, [])

  const currentRecipe = recipe.current_recipe_json
  const snapshots = recipe.snapshots
  const liveSnapshotIndex = useMemo(() => {
    if (!recipe.live_snapshot_id) return Math.max(snapshots.length - 1, 0)
    const index = snapshots.findIndex(snapshot => snapshot.id === recipe.live_snapshot_id)
    return index >= 0 ? index : Math.max(snapshots.length - 1, 0)
  }, [recipe.live_snapshot_id, snapshots])
  const selectedSnapshot = snapshots[selectedSnapshotIndex] ?? null
  const isManualCreated = isManualRecipeCreated(currentRecipe)
  const allHistory = (recipe.feedback_history ?? []) as AnyFeedbackRound[]
  const manualEditRounds = allHistory.filter(isManualEditRound)
  const feedbackRounds = allHistory.filter(isFeedbackRound)
  const hasManualEdits = manualEditRounds.length > 0
  const hasFeedbackAdjustments = feedbackRounds.length > 0
  const versionN = selectedSnapshot?.snapshot_index ?? snapshots.length

  const liveGrindSettings = useMemo(() => {
    if (!isEditing || !editDraft) return null
    return buildLiveGrindSettings(recipe, preferredGrinder, editDraft)
  }, [editDraft, isEditing, preferredGrinder, recipe])

  const hasUnsavedEditChanges = useMemo(() => {
    if (!isEditing || !editDraft) return false
    return hasEditDraftChanges(recipe, editDraft, tempUnit, preferredGrinder)
  }, [editDraft, isEditing, preferredGrinder, recipe, tempUnit])

  useEffect(() => {
    if (isEditing && hasUnsavedEditChanges) {
      setGuard(href => {
        setPendingNavHref(href)
        setShowDiscardConfirm(true)
        return true
      })
    } else {
      setGuard(null)
    }

    return () => setGuard(null)
  }, [hasUnsavedEditChanges, isEditing, setGuard])

  useEffect(() => {
    if (showEditHistorySheet) {
      setSelectedSnapshotIndex(liveSnapshotIndex)
    }
  }, [liveSnapshotIndex, showEditHistorySheet])

  function enterEditMode() {
    setEditDraft(createEditDraft(recipe, tempUnit, preferredGrinder))
    setEditError(null)
    setStepError(null)
    setAdvancedOpen(false)
    setIsEditing(true)
  }

  function exitEditMode() {
    setIsEditing(false)
    setEditDraft(null)
    setEditError(null)
    setStepError(null)
    setAdvancedOpen(false)
  }

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

  async function handleSaveEdit() {
    if (!editDraft) return

    setEditError(null)
    setStepError(null)

    if (editDraft.temperature_display === '') {
      setEditError('Temperature is required.')
      return
    }

    if (editDraft.grind_preferred_value === '') {
      setEditError('Grind setting is required.')
      return
    }

    if (!/^\d+:[0-5]\d(\s*[–-]\s*\d+:[0-5]\d)?$/.test(editDraft.total_time)) {
      setEditError('Brew time must be in m:ss format (e.g. 3:30) or a range (e.g. 3:30 – 4:00)')
      return
    }

    const stepsValidationError = validateSteps(editDraft.steps, editDraft.water_g)
    if (stepsValidationError) {
      setStepError(stepsValidationError)
      return
    }

    const newTempC = tempUnit === 'F'
      ? Math.round((editDraft.temperature_display - 32) * 5 / 9)
      : editDraft.temperature_display

    if (isQAirValueInvalid(preferredGrinder, editDraft.grind_preferred_value)) {
      setEditError('Q-Air grind must use R.C.M format, for example 2.5.0.')
      return
    }

    const newKUltraClicks = grinderValueToKUltraClicks(preferredGrinder, editDraft.grind_preferred_value)
    const oldWaterG = currentRecipe.parameters.water_g
    const newSteps = recomputeAccumulated(editDraft.steps)
    const newRatio = `1:${(editDraft.water_g / editDraft.coffee_g).toFixed(1)}`
    const range = parseKUltraRange(currentRecipe.range_logic.final_operating_range)
    const grindLow = range?.low ?? newKUltraClicks
    const grindHigh = range?.high ?? newKUltraClicks
    const newGrind = buildDerivedGrindSettings(
      currentRecipe,
      grindLow,
      grindHigh,
      newKUltraClicks,
    )

    const changes: ManualEditRound['changes'] = []
    if (editDraft.coffee_g !== currentRecipe.parameters.coffee_g) {
      changes.push({ field: 'coffee_g', previous_value: String(currentRecipe.parameters.coffee_g), new_value: String(editDraft.coffee_g) })
    }
    if (editDraft.water_g !== oldWaterG) {
      changes.push({ field: 'water_g', previous_value: String(oldWaterG), new_value: String(editDraft.water_g) })
    }
    if (newTempC !== currentRecipe.parameters.temperature_c) {
      changes.push({ field: 'temperature_c', previous_value: String(currentRecipe.parameters.temperature_c), new_value: String(newTempC) })
    }
    if (editDraft.total_time !== currentRecipe.parameters.total_time) {
      changes.push({ field: 'total_time', previous_value: currentRecipe.parameters.total_time, new_value: editDraft.total_time })
    }

    const oldGrindValue = parseGrinderValueForEdit(preferredGrinder, currentRecipe.grind[preferredGrinder].starting_point)
    if (editDraft.grind_preferred_value !== oldGrindValue) {
      changes.push({ field: 'grind', previous_value: `${oldGrindValue}`, new_value: `${editDraft.grind_preferred_value}` })
    }

    const sanitizedSteps = newSteps.map(step => ({
      step: step.step,
      time: step.time,
      action: step.action,
      water_poured_g: step.water_poured_g,
      water_accumulated_g: step.water_accumulated_g,
    }))
    if (JSON.stringify(sanitizedSteps) !== JSON.stringify(currentRecipe.steps)) {
      changes.push({ field: 'steps', previous_value: `${currentRecipe.steps.length} steps`, new_value: `${newSteps.length} steps` })
    }

    if (changes.length === 0) {
      exitEditMode()
      return
    }

    const existingManualEdits = allHistory.filter(isManualEditRound)
    const newEditRound: ManualEditRound = {
      type: 'manual_edit',
      version: existingManualEdits.length + 1,
      edited_at: new Date().toISOString(),
      changes,
    }

    const cleanedSteps = sanitizedSteps
      .map(step => ({ ...step, step: 0 }))
      .map((step, index) => ({ ...step, step: index + 1 }))

    const updatedRecipeJson: RecipeWithAdjustment = {
      ...currentRecipe,
      parameters: {
        ...currentRecipe.parameters,
        coffee_g: editDraft.coffee_g,
        water_g: editDraft.water_g,
        temperature_c: newTempC,
        total_time: editDraft.total_time,
        ratio: newRatio,
      },
      grind: newGrind,
      steps: cleanedSteps,
    }

    const updatedHistory = [...allHistory, newEditRound]
    setIsSavingEdit(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_kind: 'manual_edit',
          change_summary: changes,
          current_recipe_json: updatedRecipeJson,
          feedback_history: updatedHistory,
          source_snapshot_id: recipe.live_snapshot_id ?? null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save. Please try again.')
      }

      const saved = await response.json()
      setRecipe(saved)
      setNotes(saved.notes ?? '')
      exitEditMode()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to save. Please try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleShare() {
    setSharing(true)
    setActionError(null)
    await runClientMutation({
      execute: async () => {
        const response = await fetch(`/api/recipes/${id}/share`, { method: 'POST' })
        await expectOk(response, 'Failed to create share link')
        return response.json()
      },
      onSuccess: (data: { shareToken: string; url: string }) => {
        setShareToken(data.shareToken)
        setShareUrl(data.url)
        setCommentCount(0)
        setShowShareSheet(true)
      },
      onError: setActionError,
      onSettled: () => setSharing(false),
      errorMessage: 'Failed to create share link. Please try again.',
    })
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesError(null)
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)

    notesDebounceRef.current = setTimeout(async () => {
      setNotesSaving(true)
      await runClientMutation({
        execute: async () => {
          const response = await fetch(`/api/recipes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: value || null }),
          })
          return expectOk(response, 'Failed to save notes')
        },
        onError: setNotesError,
        onSettled: () => setNotesSaving(false),
        errorMessage: 'Failed to save notes. Please try again.',
      })
    }, 500)
  }

  async function handleRevoke() {
    setRevoking(true)
    setActionError(null)
    await runClientMutation({
      execute: async () => {
        const response = await fetch(`/api/recipes/${id}/share`, { method: 'DELETE' })
        return expectOk(response, 'Failed to revoke share link')
      },
      onSuccess: () => {
        setShareToken(null)
        setShareUrl('')
        setCommentCount(null)
        setShowShareSheet(false)
        setShowRevokeConfirm(false)
      },
      onError: setActionError,
      onSettled: () => setRevoking(false),
      errorMessage: 'Failed to revoke share link. Please try again.',
    })
  }

  async function handleSaveSnapshotAsNew() {
    if (!selectedSnapshot) return

    setIsSavingSnapshotAsNew(true)
    setActionError(null)
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: selectedSnapshot.snapshot_recipe_json.method,
          bean_info: recipe.bean_info,
          original_recipe_json: selectedSnapshot.snapshot_recipe_json,
          current_recipe_json: selectedSnapshot.snapshot_recipe_json,
          feedback_history: [],
          parent_recipe_id: id,
          scale_factor: recipe.scale_factor ?? null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save snapshot')
      }

      router.push(`/recipes/${data.id}`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to save snapshot')
    } finally {
      setIsSavingSnapshotAsNew(false)
    }
  }

  async function handleUseSnapshotVersion() {
    if (!selectedSnapshot || selectedSnapshot.id === recipe.live_snapshot_id) return

    setIsUsingSnapshotVersion(true)
    setActionError(null)
    try {
      const response = await fetch(`/api/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          live_snapshot_id: selectedSnapshot.id,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to switch recipe version')
      }

      setRecipe(data)
      setNotes(data.notes ?? '')
      setShowEditHistorySheet(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to switch recipe version')
    } finally {
      setIsUsingSnapshotVersion(false)
    }
  }

  const handleStepUpdate = useCallback((dndId: string, updates: Partial<RecipeDraftStep>) => {
    setEditDraft(draft => {
      if (!draft) return draft
      const updatedSteps = draft.steps.map(step => step._dndId === dndId ? { ...step, ...updates } : step)
      if ('water_poured_g' in updates) {
        const newSteps = recomputeAccumulated(updatedSteps)
        const totalPoured = Math.round(newSteps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10) / 10
        return {
          ...draft,
          steps: newSteps,
          water_g: totalPoured,
          ratio_multiplier: draft.coffee_g > 0 ? totalPoured / draft.coffee_g : draft.ratio_multiplier,
        }
      }
      return { ...draft, steps: updatedSteps }
    })
  }, [])

  const handleStepDelete = useCallback((dndId: string) => {
    setEditDraft(draft => {
      if (!draft) return draft
      const newSteps = recomputeAccumulated(draft.steps.filter(step => step._dndId !== dndId))
      const totalPoured = Math.round(newSteps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10) / 10
      return {
        ...draft,
        steps: newSteps,
        water_g: totalPoured,
        ratio_multiplier: draft.coffee_g > 0 ? totalPoured / draft.coffee_g : draft.ratio_multiplier,
      }
    })
  }, [])

  const handleStepAdd = useCallback(() => {
    setEditDraft(draft => {
      if (!draft) return draft
      return {
        ...draft,
        steps: [
          ...draft.steps,
          {
            step: draft.steps.length + 1,
            time: '0:00',
            action: '',
            water_poured_g: 0,
            water_accumulated_g: 0,
            _dndId: `new-${Date.now()}`,
          },
        ],
      }
    })
  }, [])

  const handleReorder = useCallback((newSteps: EditDraft['steps']) => {
    setEditDraft(draft => draft ? { ...draft, steps: recomputeAccumulated(newSteps) } : draft)
  }, [])

  const grindRange = editDraft
    ? getGrindRangeForEdit(preferredGrinder, currentRecipe.range_logic.final_operating_range)
    : null
  const kUltraRange = parseKUltraRange(currentRecipe.range_logic.final_operating_range)
  const isGrindOutOfRange = editDraft && kUltraRange
    ? (() => {
        if (editDraft.grind_preferred_value === '') return false
        if (isQAirValueInvalid(preferredGrinder, editDraft.grind_preferred_value)) return false
        const currentClicks = grinderValueToKUltraClicks(preferredGrinder, editDraft.grind_preferred_value)
        return currentClicks < kUltraRange.low || currentClicks > kUltraRange.high
      })()
    : false
  const activeGrind = (isEditing && liveGrindSettings) ? liveGrindSettings : currentRecipe.grind

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      <div className="flex items-center justify-between px-4 sm:px-6 pb-4 ui-animate-enter">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isEditing) {
                if (hasUnsavedEditChanges) {
                  setShowDiscardConfirm(true)
                } else {
                  exitEditMode()
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
          <p className="ui-section-title">{isEditing ? 'Edit Recipe' : 'Saved Recipe'}</p>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={shareToken ? () => setShowShareSheet(true) : handleShare}
              disabled={sharing}
              className="ui-icon-button text-[var(--muted-foreground)] disabled:opacity-40"
              aria-label="Share recipe"
            >
              {sharing ? (
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
          commentCount={commentCount}
          hasFeedbackAdjustments={hasFeedbackAdjustments}
          isManualCreated={isManualCreated}
          hasManualEdits={hasManualEdits}
          isEditing={isEditing}
          onOpenManualCreator={() => setShowManualCreatorSheet(true)}
          onOpenEditHistory={() => setShowEditHistorySheet(true)}
          onOpenParentRecipe={() => router.push(`/recipes/${recipe.parent_recipe_id}`)}
          onOpenShare={() => setShowShareSheet(true)}
          recipe={recipe}
          shareToken={shareToken}
          versionN={versionN}
        />

        {freshnessAdj && !freshnessIgnored && !isEditing && (
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

        {editError && (
          <div className="ui-alert-danger text-sm">
            {editError}
          </div>
        )}

        {actionError && !isEditing && (
          <div className="ui-alert-danger text-sm">
            {actionError}
          </div>
        )}

        {isEditing && editDraft ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="ui-overline mb-2">Parameters</h2>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="ui-overline">Temp (°{tempUnit})</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={tempUnit === 'F' ? 140 : 60}
                      max={tempUnit === 'F' ? 212 : 100}
                      step={1}
                      value={editDraft.temperature_display}
                      onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                      onChange={event => setEditDraft(draft => draft ? { ...draft, temperature_display: parseWholeNumberInput(event.target.value) } : draft)}
                      className="ui-input bg-[var(--background)] font-semibold px-3"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="ui-overline">Brew Time</span>
                    <input
                      type="text"
                      placeholder="e.g. 3:30"
                      value={editDraft.total_time}
                      onChange={event => setEditDraft(draft => draft ? { ...draft, total_time: event.target.value } : draft)}
                      className="ui-input bg-[var(--background)] font-semibold px-3"
                    />
                  </label>
                </div>

                <button onClick={() => setAdvancedOpen(value => !value)} className="ui-focus-ring ui-pressable flex items-center justify-between w-full rounded-xl py-2 text-left">
                  <span className="ui-overline normal-case tracking-normal font-medium">Advanced (dose &amp; ratio)</span>
                  <svg className={`size-3.5 transition-transform text-[var(--muted-foreground)] ${advancedOpen ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none">
                    <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {advancedOpen && (
                  <div className="bg-[var(--card)] rounded-2xl p-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="ui-overline">Coffee (g)</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={1}
                          step={0.1}
                          value={editDraft.coffee_g}
                          onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                          onChange={event => setEditDraft(draft => draft ? { ...draft, coffee_g: Math.max(0, parseFloat(event.target.value) || draft.coffee_g) } : draft)}
                          onBlur={() => {
                            const savedParams = recipe.current_recipe_json.parameters
                            const baseDose = savedParams.coffee_g
                            const baseRatio = savedParams.water_g / savedParams.coffee_g
                            const savedGrindValue = parseGrinderValueForEdit(preferredGrinder, recipe.current_recipe_json.grind[preferredGrinder].starting_point)

                            setEditDraft(draft => {
                              if (!draft) return draft
                              const newCoffee = draft.coffee_g
                              if (newCoffee <= 0) return draft
                              const newWater = Math.round(newCoffee * draft.ratio_multiplier * 10) / 10
                              const newSteps = scaleStepsToWater(draft.steps, draft.water_g, newWater)
                              const { deltaKUltraClicks } = computeGrindScalingDelta(baseDose, newCoffee, baseRatio, draft.ratio_multiplier)
                              let newGrindValue = draft.grind_preferred_value
                              if (deltaKUltraClicks !== 0) {
                                const baseKUltra = grinderValueToKUltraClicks(preferredGrinder, savedGrindValue)
                                const newKUltra = Math.max(40, Math.min(120, baseKUltra + deltaKUltraClicks))
                                newGrindValue = kUltraClicksToGrinderValue(preferredGrinder, newKUltra)
                              }
                              return { ...draft, coffee_g: newCoffee, water_g: newWater, steps: newSteps, grind_preferred_value: newGrindValue, scaledFromDose: true }
                            })
                          }}
                          className="ui-input bg-[var(--background)] font-semibold px-3"
                        />
                      </label>
                      <div className="flex flex-col gap-1">
                        <span className="ui-overline">Water (g)</span>
                        <div className="rounded-xl px-3 py-2.5 bg-[var(--background)] border border-[var(--border)]">
                          <p className="ui-card-title">{editDraft.water_g}</p>
                        </div>
                      </div>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="ui-overline">Ratio</span>
                      <div className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 bg-[var(--background)] border border-[var(--border)] focus-within:ring-1 focus-within:ring-[var(--foreground)]/20">
                        <span className="ui-card-title">1:</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={1}
                          max={50}
                          step={0.1}
                          value={parseFloat(editDraft.ratio_multiplier.toFixed(1))}
                          onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                          onChange={event => setEditDraft(draft => draft ? { ...draft, ratio_multiplier: Math.max(0, parseFloat(event.target.value) || draft.ratio_multiplier) } : draft)}
                          onBlur={() => {
                            const savedParams = recipe.current_recipe_json.parameters
                            const baseDose = savedParams.coffee_g
                            const baseRatio = savedParams.water_g / savedParams.coffee_g
                            const savedGrindValue = parseGrinderValueForEdit(preferredGrinder, recipe.current_recipe_json.grind[preferredGrinder].starting_point)

                            setEditDraft(draft => {
                              if (!draft) return draft
                              const newRatio = draft.ratio_multiplier
                              if (newRatio <= 0) return draft
                              const newWater = Math.round(draft.coffee_g * newRatio * 10) / 10
                              const newSteps = scaleStepsToWater(draft.steps, draft.water_g, newWater)
                              const { deltaKUltraClicks } = computeGrindScalingDelta(baseDose, draft.coffee_g, baseRatio, newRatio)
                              let newGrindValue = draft.grind_preferred_value
                              if (deltaKUltraClicks !== 0) {
                                const baseKUltra = grinderValueToKUltraClicks(preferredGrinder, savedGrindValue)
                                const newKUltra = Math.max(40, Math.min(120, baseKUltra + deltaKUltraClicks))
                                newGrindValue = kUltraClicksToGrinderValue(preferredGrinder, newKUltra)
                              }
                              return { ...draft, ratio_multiplier: newRatio, water_g: newWater, steps: newSteps, grind_preferred_value: newGrindValue, scaledFromRatio: true }
                            })
                          }}
                          className="flex-1 min-w-0 bg-transparent text-base font-semibold text-[var(--foreground)] focus:outline-none"
                        />
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[var(--card)] rounded-2xl p-4">
              <h2 className="ui-overline mb-3">Grind Settings</h2>
              <RecipeEditGrindSettings
                editDraft={editDraft}
                grindRange={grindRange}
                isGrindOutOfRange={isGrindOutOfRange}
                onChange={value => setEditDraft(draft => {
                  if (!draft) return draft
                  if (preferredGrinder === 'q_air') {
                    return { ...draft, grind_preferred_value: value }
                  }
                  return { ...draft, grind_preferred_value: parseWholeNumberInput(value) }
                })}
                preferredGrinder={preferredGrinder}
              />
              <RecipeViewGrindSettings
                activeGrind={activeGrind}
                preferredGrinder={preferredGrinder}
                secondaryGrindersOpen={secondaryGrindersOpen}
                setSecondaryGrindersOpen={setSecondaryGrindersOpen}
              />
            </div>

            <div>
              <h2 className="ui-overline mb-2">Brew Steps</h2>
              <SortableStepList
                steps={editDraft.steps}
                onUpdate={handleStepUpdate}
                onDelete={handleStepDelete}
                onAdd={handleStepAdd}
                onReorder={handleReorder}
                stepError={stepError}
              />
            </div>
          </div>
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
                {notesSaving && <span className="ui-meta">Saving…</span>}
              </div>
              <textarea
                value={notes}
                onChange={event => handleNotesChange(event.target.value)}
                maxLength={1000}
                placeholder="Add notes about this brew…"
                rows={3}
                className="ui-textarea"
              />
              {notesError && (
                <p className="ui-meta ui-text-danger mt-2">{notesError}</p>
              )}
              <p className="ui-meta text-right mt-1">{notes.length}/1000</p>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-56">
        <div className="ui-sticky-footer w-full px-4 sm:px-6 md:max-w-2xl md:mx-auto lg:max-w-3xl xl:max-w-5xl xl:px-8 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-6 pt-3">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <button onClick={handleSaveEdit} disabled={isSavingEdit} className="w-full ui-button-primary font-semibold">
                {isSavingEdit ? (
                  <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                ) : 'Save'}
              </button>
              <button
                onClick={() => {
                  if (hasUnsavedEditChanges) {
                    setShowDiscardConfirm(true)
                    return
                  }
                  exitEditMode()
                }}
                disabled={isSavingEdit}
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
              <button onClick={enterEditMode} className="w-full ui-button-secondary">
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
        copied={copied}
        onClose={() => setShowShareSheet(false)}
        onCopy={handleCopy}
        onRevoke={() => setShowRevokeConfirm(true)}
        open={showShareSheet}
        shareToken={shareToken}
        shareUrl={shareUrl}
      />

      <RecipeEditHistorySheet
        activeSnapshotId={recipe.live_snapshot_id}
        isSaveAsNewPending={isSavingSnapshotAsNew}
        isUseVersionPending={isUsingSnapshotVersion}
        onClose={() => setShowEditHistorySheet(false)}
        onNavigate={direction => {
          setSelectedSnapshotIndex(currentIndex => {
            if (direction === 'prev') return Math.max(0, currentIndex - 1)
            return Math.min(snapshots.length - 1, currentIndex + 1)
          })
        }}
        onSaveAsNew={handleSaveSnapshotAsNew}
        onUseThisVersion={handleUseSnapshotVersion}
        open={showEditHistorySheet}
        selectedSnapshot={selectedSnapshot}
        selectedSnapshotIndex={selectedSnapshotIndex}
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
        open={showRevokeConfirm}
        title="Revoke share link?"
        message="Anyone with the current link will lose access. This cannot be undone."
        confirmLabel="Revoke Link"
        destructive
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setShowRevokeConfirm(false)}
      />

      <ConfirmSheet
        open={showDiscardConfirm}
        title="Discard changes?"
        message="Your edits to this recipe won't be saved."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          exitEditMode()
          setShowDiscardConfirm(false)
          if (pendingNavHref) {
            router.push(pendingNavHref)
            setPendingNavHref(null)
          }
        }}
        onCancel={() => {
          setShowDiscardConfirm(false)
          setPendingNavHref(null)
        }}
      />
    </div>
  )
}
