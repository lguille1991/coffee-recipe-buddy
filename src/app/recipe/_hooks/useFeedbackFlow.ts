'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'
import type {
  AdjustmentMetadata,
  GrinderId,
  Recipe,
  RecipeWithAdjustment,
  SaveRecipeRequest,
  Symptom,
} from '@/types/recipe'

export interface UseFeedbackFlowOptions {
  preferredGrinder: GrinderId
  onNavigate: (href: string) => void
}

export interface UseFeedbackFlowReturn {
  // State
  recipe: RecipeWithAdjustment | null
  originalRecipe: Recipe | null
  feedbackRound: number
  adjustmentHistory: AdjustmentMetadata[]
  isAdjusting: boolean
  adjustError: string | null
  saving: boolean
  saveError: string | null
  lastSavedRound: number
  hasUnsavedChanges: boolean
  maxRoundsReached: boolean
  currentAdjustment: AdjustmentMetadata | undefined

  // UI State
  showFeedback: boolean
  selectedSymptom: Symptom | null

  // Actions
  handleAdjust: () => Promise<void>
  handleReset: () => void
  handleSaveFeedback: (user: { id: string } | null) => Promise<void>
  setShowFeedback: (show: boolean) => void
  setSelectedSymptom: (symptom: Symptom | null) => void
}

export function useFeedbackFlow(
  options: UseFeedbackFlowOptions
): UseFeedbackFlowReturn {
  const { preferredGrinder, onNavigate } = options

  // Core recipe state
  const [recipe, setRecipe] = useState<RecipeWithAdjustment | null>(null)
  const [originalRecipe, setOriginalRecipe] = useState<Recipe | null>(null)

  // Feedback/adjustment state
  const [feedbackRound, setFeedbackRound] = useState(0)
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentMetadata[]>([])
  const [lastSavedRound, setLastSavedRound] = useState(-1)

  // UI state
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null)

  // Loading/error states
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load from sessionStorage on mount
  useEffect(() => {
    const storedRecipe = recipeSessionStorage.getRecipe()
    if (!storedRecipe) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecipe(storedRecipe)

    const storedOriginalRecipe = recipeSessionStorage.getRecipeOriginal()
    if (storedOriginalRecipe) {
      setOriginalRecipe(storedOriginalRecipe)
    } else {
      recipeSessionStorage.setRecipeOriginal(storedRecipe)
      setOriginalRecipe(storedRecipe)
    }

    setFeedbackRound(recipeSessionStorage.getFeedbackRound())
    setAdjustmentHistory(recipeSessionStorage.getAdjustmentHistory<AdjustmentMetadata>())
  }, [])

  // Derived state
  const hasUnsavedChanges = useMemo(() => {
    return feedbackRound > lastSavedRound
  }, [feedbackRound, lastSavedRound])

  const maxRoundsReached = useMemo(() => {
    return feedbackRound >= 3
  }, [feedbackRound])

  const currentAdjustment = useMemo(() => {
    return recipe?.adjustment_applied
  }, [recipe])

  // Reset recipe to original
  const handleReset = useCallback(() => {
    if (!originalRecipe) return

    recipeSessionStorage.setRecipe(originalRecipe)
    recipeSessionStorage.clearFeedbackRound()
    recipeSessionStorage.clearAdjustmentHistory()
    recipeSessionStorage.clearManualEditHistory()

    setRecipe(originalRecipe)
    setFeedbackRound(0)
    setAdjustmentHistory([])
    setShowFeedback(false)
    setSelectedSymptom(null)
    setLastSavedRound(-1)
  }, [originalRecipe])

  // Call adjust API
  const handleAdjust = useCallback(async () => {
    if (!recipe || !selectedSymptom || isAdjusting) return

    setIsAdjusting(true)
    setAdjustError(null)

    const nextRound = feedbackRound + 1

    try {
      const response = await fetch('/api/adjust-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_recipe: recipe,
          symptom: selectedSymptom,
          round: nextRound,
          preferred_grinder: preferredGrinder,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Adjustment failed')
      }

      const updatedRecipe: RecipeWithAdjustment = await response.json()
      const newHistory = [...adjustmentHistory, updatedRecipe.adjustment_applied!].filter(Boolean)

      recipeSessionStorage.setRecipe(updatedRecipe)
      recipeSessionStorage.setFeedbackRound(nextRound)
      recipeSessionStorage.setAdjustmentHistory(newHistory)

      setRecipe(updatedRecipe)
      setFeedbackRound(nextRound)
      setAdjustmentHistory(newHistory)
      setShowFeedback(false)
      setSelectedSymptom(null)
    } catch (error) {
      setAdjustError(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsAdjusting(false)
    }
  }, [recipe, selectedSymptom, isAdjusting, feedbackRound, adjustmentHistory, preferredGrinder])

  // Save feedback/recipe to backend
  const handleSaveFeedback = useCallback(
    async (user: { id: string } | null) => {
      if (saving || !recipe || !originalRecipe) return

      const feedbackHistoryPayload = adjustmentHistory.map((adjustment, index) => ({
        type: 'feedback' as const,
        round: index + 1,
        symptom: adjustment.symptom,
        variable_changed: adjustment.variable_changed,
        previous_value: adjustment.previous_value,
        new_value: adjustment.new_value,
      }))

      setSaving(true)
      setSaveError(null)

      const bean = recipeSessionStorage.getConfirmedBean()
      if (!bean) {
        setSaveError('Bean details are missing. Please generate the recipe again.')
        setSaving(false)
        return
      }

      const payload: SaveRecipeRequest = {
        bean_info: bean,
        method: recipe.method,
        original_recipe_json: originalRecipe,
        current_recipe_json: recipe,
        feedback_history: feedbackHistoryPayload,
      }

      // If no user, store pending save and redirect to auth
      if (!user) {
        recipeSessionStorage.setPendingSaveRecipe(payload)
        onNavigate('/auth?returnTo=/recipe&pendingRecipe=true')
        setSaving(false)
        return
      }

      try {
        const response = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error ?? 'Save failed')
        }

        const data = await response.json()
        setLastSavedRound(feedbackRound)
        onNavigate(`/recipes/${data.id}`)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [saving, recipe, originalRecipe, adjustmentHistory, feedbackRound, onNavigate]
  )

  return {
    // State
    recipe,
    originalRecipe,
    feedbackRound,
    adjustmentHistory,
    isAdjusting,
    adjustError,
    saving,
    saveError,
    lastSavedRound,
    hasUnsavedChanges,
    maxRoundsReached,
    currentAdjustment,

    // UI State
    showFeedback,
    selectedSymptom,

    // Actions
    handleAdjust,
    handleReset,
    handleSaveFeedback,
    setShowFeedback,
    setSelectedSymptom,
  }
}
