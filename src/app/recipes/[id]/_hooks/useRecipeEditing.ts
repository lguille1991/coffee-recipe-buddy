'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavGuard } from '@/components/NavGuardContext'
import { buildDerivedGrindSettings } from '@/lib/grind-settings'
import {
  grinderValueToKUltraClicks,
  parseGrinderValueForEdit,
  parseKUltraRange,
} from '@/lib/grinder-converter'
import type {
  GrinderId,
  ManualEditRound,
  RecipeDraftStep,
  RecipeWithAdjustment,
  SavedRecipeDetail,
} from '@/types/recipe'
import { isPreferredGrinderValueInvalid } from '../_components/RecipeDetailSections'
import {
  buildLiveGrindSettings,
  createEditDraft,
  hasEditDraftChanges,
  isManualEditRound,
  recomputeAccumulated,
  type AnyFeedbackRound,
  type EditDraft,
  validateSteps,
} from '../_lib/editing'

export type UseRecipeEditingOptions = {
  id: string
  recipe: SavedRecipeDetail
  tempUnit: 'C' | 'F'
  preferredGrinder: GrinderId
  onRecipeUpdate: (updatedRecipe: SavedRecipeDetail) => void
}

export type UseRecipeEditingReturn = {
  // State
  isEditing: boolean
  editDraft: EditDraft | null
  editError: string | null
  stepError: string | null
  isSaving: boolean
  showDiscardConfirm: boolean
  pendingNavHref: string | null
  advancedOpen: boolean
  hasUnsavedChanges: boolean
  liveGrindSettings: ReturnType<typeof buildLiveGrindSettings> | null

  // Actions
  enterEditMode: () => void
  exitEditMode: () => void
  saveEdit: () => Promise<SavedRecipeDetail | null>
  setEditDraft: React.Dispatch<React.SetStateAction<EditDraft | null>>
  setAdvancedOpen: (value: React.SetStateAction<boolean>) => void
  setShowDiscardConfirm: (value: boolean) => void
  handleStepUpdate: (dndId: string, updates: Partial<RecipeDraftStep>) => void
  handleStepDelete: (dndId: string) => void
  handleStepAdd: () => void
  handleStepReorder: (newSteps: EditDraft['steps']) => void
  confirmDiscard: () => void
  cancelDiscard: () => void
}

export function useRecipeEditing({
  id,
  recipe,
  tempUnit,
  preferredGrinder,
  onRecipeUpdate,
}: UseRecipeEditingOptions): UseRecipeEditingReturn {
  const router = useRouter()
  const { setGuard } = useNavGuard()

  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const currentRecipe = recipe.current_recipe_json
  const allHistory = useMemo(
    () => (recipe.feedback_history ?? []) as AnyFeedbackRound[],
    [recipe.feedback_history],
  )

  const liveGrindSettings = useMemo(() => {
    if (!isEditing || !editDraft) return null
    return buildLiveGrindSettings(recipe, preferredGrinder, editDraft)
  }, [editDraft, isEditing, preferredGrinder, recipe])

  const hasUnsavedChanges = useMemo(() => {
    if (!isEditing || !editDraft) return false
    return hasEditDraftChanges(recipe, editDraft, tempUnit, preferredGrinder)
  }, [editDraft, isEditing, preferredGrinder, recipe, tempUnit])

  // Navigation guard for unsaved changes
  useEffect(() => {
    if (isEditing && hasUnsavedChanges) {
      setGuard(href => {
        setPendingNavHref(href)
        setShowDiscardConfirm(true)
        return true
      })
    } else {
      setGuard(null)
    }

    return () => setGuard(null)
  }, [hasUnsavedChanges, isEditing, setGuard])

  const enterEditMode = useCallback(() => {
    setEditDraft(createEditDraft(recipe, tempUnit, preferredGrinder))
    setEditError(null)
    setStepError(null)
    setAdvancedOpen(false)
    setIsEditing(true)
  }, [recipe, tempUnit, preferredGrinder])

  const exitEditMode = useCallback(() => {
    setIsEditing(false)
    setEditDraft(null)
    setEditError(null)
    setStepError(null)
    setAdvancedOpen(false)
  }, [])

  const saveEdit = useCallback(async (): Promise<SavedRecipeDetail | null> => {
    if (!editDraft) return null

    setEditError(null)
    setStepError(null)

    // Validate temperature
    if (editDraft.temperature_display === '') {
      setEditError('Temperature is required.')
      return null
    }

    // Validate grind setting
    if (editDraft.grind_preferred_value === '') {
      setEditError('Grind setting is required.')
      return null
    }

    // Validate brew time format
    if (!/^\d+:[0-5]\d(\s*[–-]\s*\d+:[0-5]\d)?$/.test(editDraft.total_time)) {
      setEditError('Brew time must be in m:ss format (e.g. 3:30) or a range (e.g. 3:30 – 4:00)')
      return null
    }

    // Validate steps
    const stepsValidationError = validateSteps(editDraft.steps, editDraft.water_g)
    if (stepsValidationError) {
      setStepError(stepsValidationError)
      return null
    }

    // Convert temperature to Celsius if needed
    const newTempC = tempUnit === 'F'
      ? Math.round((editDraft.temperature_display - 32) * 5 / 9)
      : editDraft.temperature_display

    // Validate notation-based grinder settings
    if (isPreferredGrinderValueInvalid(preferredGrinder, editDraft.grind_preferred_value)) {
      setEditError(
        preferredGrinder === 'k_ultra'
          ? 'K-Ultra grind must use rotations.number.tick format, for example 0.8.2.'
          : 'Q-Air grind must use R.C.M format, for example 2.5.0.',
      )
      return null
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

    // Build changes list
    const changes: ManualEditRound['changes'] = []
    if (editDraft.coffee_g !== currentRecipe.parameters.coffee_g) {
      changes.push({
        field: 'coffee_g',
        previous_value: String(currentRecipe.parameters.coffee_g),
        new_value: String(editDraft.coffee_g),
      })
    }
    if (editDraft.water_g !== oldWaterG) {
      changes.push({
        field: 'water_g',
        previous_value: String(oldWaterG),
        new_value: String(editDraft.water_g),
      })
    }
    if (newTempC !== currentRecipe.parameters.temperature_c) {
      changes.push({
        field: 'temperature_c',
        previous_value: String(currentRecipe.parameters.temperature_c),
        new_value: String(newTempC),
      })
    }
    if (editDraft.total_time !== currentRecipe.parameters.total_time) {
      changes.push({
        field: 'total_time',
        previous_value: currentRecipe.parameters.total_time,
        new_value: editDraft.total_time,
      })
    }

    const oldGrindValue = parseGrinderValueForEdit(
      preferredGrinder,
      currentRecipe.grind[preferredGrinder].starting_point,
    )
    if (editDraft.grind_preferred_value !== oldGrindValue) {
      changes.push({
        field: 'grind',
        previous_value: `${oldGrindValue}`,
        new_value: `${editDraft.grind_preferred_value}`,
      })
    }

    const sanitizedSteps = newSteps.map(step => ({
      step: step.step,
      time: step.time,
      action: step.action,
      water_poured_g: step.water_poured_g,
      water_accumulated_g: step.water_accumulated_g,
    }))

    if (JSON.stringify(sanitizedSteps) !== JSON.stringify(currentRecipe.steps)) {
      changes.push({
        field: 'steps',
        previous_value: `${currentRecipe.steps.length} steps`,
        new_value: `${newSteps.length} steps`,
      })
    }

    // No changes - just exit edit mode
    if (changes.length === 0) {
      exitEditMode()
      return null
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
    setIsSaving(true)
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

      const saved: SavedRecipeDetail = await response.json()
      onRecipeUpdate(saved)
      exitEditMode()
      return saved
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to save. Please try again.')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [
    editDraft,
    tempUnit,
    preferredGrinder,
    currentRecipe,
    allHistory,
    recipe.live_snapshot_id,
    id,
    onRecipeUpdate,
    exitEditMode,
  ])

  const handleStepUpdate = useCallback((dndId: string, updates: Partial<RecipeDraftStep>) => {
    setEditDraft(draft => {
      if (!draft) return draft
      const updatedSteps = draft.steps.map(step =>
        step._dndId === dndId ? { ...step, ...updates } : step,
      )

      if ('water_poured_g' in updates) {
        const newSteps = recomputeAccumulated(updatedSteps)
        const totalPoured = Math.round(
          newSteps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10,
        ) / 10

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
      const totalPoured = Math.round(
        newSteps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10,
      ) / 10

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

  const handleStepReorder = useCallback((newSteps: EditDraft['steps']) => {
    setEditDraft(draft =>
      draft ? { ...draft, steps: recomputeAccumulated(newSteps) } : draft,
    )
  }, [])

  const confirmDiscard = useCallback(() => {
    exitEditMode()
    setShowDiscardConfirm(false)
    if (pendingNavHref) {
      router.push(pendingNavHref)
      setPendingNavHref(null)
    }
  }, [exitEditMode, pendingNavHref, router])

  const cancelDiscard = useCallback(() => {
    setShowDiscardConfirm(false)
    setPendingNavHref(null)
  }, [])

  return {
    // State
    isEditing,
    editDraft,
    editError,
    stepError,
    isSaving,
    showDiscardConfirm,
    pendingNavHref,
    advancedOpen,
    hasUnsavedChanges,
    liveGrindSettings,

    // Actions
    enterEditMode,
    exitEditMode,
    saveEdit,
    setEditDraft,
    setAdvancedOpen,
    setShowDiscardConfirm,
    handleStepUpdate,
    handleStepDelete,
    handleStepAdd,
    handleStepReorder,
    confirmDiscard,
    cancelDiscard,
  }
}
