'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  buildRecipeFromManualDraft,
  validateManualRecipeDraft,
  type ManualRecipeDraft,
} from '@/lib/manual-recipe'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'
import { recomputeAccumulated } from '@/app/recipes/[id]/_lib/editing'
import { runClientMutation } from '@/lib/client-mutation'
import type { GrinderId, RecipeDraftStep, SaveRecipeRequest } from '@/types/recipe'

export type UseManualRecipeOptions = {
  user: User | null
  preferredGrinder: GrinderId
  tempUnit: 'C' | 'F'
  onNavigate: (href: string) => void
  onSaveSuccess: (recipeId: string) => void
}

export type UseManualRecipeReturn = {
  // State
  manualDraft: ManualRecipeDraft | null
  isSaving: boolean
  saveError: string | null
  stepError: string | null
  validation: { valid: boolean; error: string | null }
  requiredState: {
    temperatureMissing: boolean
    totalTimeMissing: boolean
    coffeeMissing: boolean
    waterMissing: boolean
    grindMissing: boolean
  }
  // Actions
  updateDraft: (updater: (draft: ManualRecipeDraft) => ManualRecipeDraft) => void
  handleStepUpdate: (dndId: string, updates: Partial<RecipeDraftStep>) => void
  handleStepDelete: (dndId: string) => void
  handleStepAdd: () => void
  handleStepReorder: (newSteps: RecipeDraftStep[]) => void
  handleSaveManual: () => Promise<void>
}

export function useManualRecipe(options: UseManualRecipeOptions): UseManualRecipeReturn {
  const { user, preferredGrinder, tempUnit, onNavigate, onSaveSuccess } = options

  const [manualDraft, setManualDraft] = useState<ManualRecipeDraft | null>(() => recipeSessionStorage.getManualRecipeDraft())
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)

  
  // Save draft to sessionStorage when it changes
  useEffect(() => {
    if (manualDraft) {
      recipeSessionStorage.setManualRecipeDraft(manualDraft)
    }
  }, [manualDraft])

  // Validation
  const validation = useMemo(() => {
    if (!manualDraft) return { valid: false, error: null as string | null }
    return validateManualRecipeDraft(manualDraft, preferredGrinder, tempUnit)
  }, [manualDraft, preferredGrinder, tempUnit])

  // Required field state for UI highlighting
  const requiredState = useMemo(() => {
    if (!manualDraft) {
      return {
        temperatureMissing: false,
        totalTimeMissing: false,
        coffeeMissing: false,
        waterMissing: false,
        grindMissing: false,
      }
    }

    return {
      temperatureMissing: manualDraft.edit_draft.temperature_display === '',
      totalTimeMissing: manualDraft.edit_draft.total_time.trim() === '',
      coffeeMissing: manualDraft.edit_draft.coffee_g <= 0,
      waterMissing: manualDraft.edit_draft.water_g <= 0,
      grindMissing: manualDraft.edit_draft.grind_preferred_value === '',
    }
  }, [manualDraft])

  // Update draft helper
  const updateDraft = useCallback((updater: (draft: ManualRecipeDraft) => ManualRecipeDraft) => {
    setManualDraft(current => (current ? updater(current) : current))
  }, [])

  // Step management: update a step
  const handleStepUpdate = useCallback(
    (dndId: string, updates: Partial<RecipeDraftStep>) => {
      updateDraft(current => {
        const updatedSteps = current.edit_draft.steps.map(step =>
          step._dndId === dndId ? { ...step, ...updates } : step,
        )
        const nextSteps = 'water_poured_g' in updates ? recomputeAccumulated(updatedSteps) : updatedSteps
        const totalPoured = Math.round(nextSteps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10) / 10

        return {
          ...current,
          edit_draft: {
            ...current.edit_draft,
            steps: nextSteps,
            water_g: totalPoured,
            ratio_multiplier:
              current.edit_draft.coffee_g > 0 ? totalPoured / current.edit_draft.coffee_g : 0,
          },
        }
      })
    },
    [updateDraft],
  )

  // Step management: delete a step
  const handleStepDelete = useCallback(
    (dndId: string) => {
      updateDraft(current => {
        const filtered = current.edit_draft.steps.filter(step => step._dndId !== dndId)
        const nextSteps = recomputeAccumulated(filtered)
        const totalPoured = Math.round(nextSteps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10) / 10

        return {
          ...current,
          edit_draft: {
            ...current.edit_draft,
            steps: nextSteps,
            water_g: totalPoured,
            ratio_multiplier:
              current.edit_draft.coffee_g > 0 ? totalPoured / current.edit_draft.coffee_g : 0,
          },
        }
      })
    },
    [updateDraft],
  )

  // Step management: add a new step
  const handleStepAdd = useCallback(() => {
    updateDraft(current => ({
      ...current,
      edit_draft: {
        ...current.edit_draft,
        steps: [
          ...current.edit_draft.steps,
          {
            step: current.edit_draft.steps.length + 1,
            time: '',
            action: '',
            water_poured_g: 0,
            water_accumulated_g: current.edit_draft.water_g,
            _dndId: `new-${Date.now()}`,
          },
        ],
      },
    }))
  }, [updateDraft])

  // Step management: reorder steps
  const handleStepReorder = useCallback(
    (newSteps: RecipeDraftStep[]) => {
      updateDraft(current => ({
        ...current,
        edit_draft: {
          ...current.edit_draft,
          steps: recomputeAccumulated(newSteps),
        },
      }))
    },
    [updateDraft],
  )

  // Save the manual recipe
  const handleSaveManual = useCallback(async () => {
    if (isSaving || !manualDraft) return

    setSaveError(null)
    setStepError(null)

    // Validate before saving
    if (!validation.valid) {
      const error = validation.error ?? 'Recipe draft is incomplete.'
      setSaveError(error.includes('Step') ? null : error)
      setStepError(error.includes('Step') ? error : null)
      return
    }

    const builtRecipe = buildRecipeFromManualDraft(manualDraft, preferredGrinder, tempUnit)
    const payload: SaveRecipeRequest = {
      bean_info: manualDraft.bean_info,
      method: manualDraft.method,
      original_recipe_json: builtRecipe,
      current_recipe_json: builtRecipe,
      feedback_history: [],
    }

    // If no user, store pending save and redirect to auth
    if (!user) {
      recipeSessionStorage.setPendingSaveRecipe(payload)
      onNavigate('/auth?returnTo=/recipe&pendingRecipe=true')
      return
    }

    // Execute save via mutation
    await runClientMutation({
      execute: async () => {
        setIsSaving(true)
        const response = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error ?? 'Save failed')
        }

        return response.json() as Promise<{ id: string }>
      },
      onSuccess: data => {
        recipeSessionStorage.clearManualRecipeDraft()
        onSaveSuccess(data.id)
      },
      onError: message => {
        setSaveError(message)
      },
      onSettled: () => {
        setIsSaving(false)
      },
      errorMessage: 'Failed to save recipe. Please try again.',
    })
  }, [isSaving, manualDraft, validation, preferredGrinder, tempUnit, user, onNavigate, onSaveSuccess])

  return {
    // State
    manualDraft,
    isSaving,
    saveError,
    stepError,
    validation,
    requiredState,
    // Actions
    updateDraft,
    handleStepUpdate,
    handleStepDelete,
    handleStepAdd,
    handleStepReorder,
    handleSaveManual,
  }
}
