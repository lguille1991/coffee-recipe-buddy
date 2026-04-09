'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Bookmark, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'
import {
  AdjustmentMetadata,
  GrinderId,
  Recipe,
  RecipeWithAdjustment,
  Symptom,
} from '@/types/recipe'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import {
  RecipeDetailsPanels,
  RecipeFeedbackSection,
  RecipeGrindSettingsCard,
  RecipeParametersSection,
  RecipeStepsSection,
} from './_components/RecipeSessionSections'
import { useWakeLockTimer } from './_hooks/useWakeLockTimer'

export default function RecipeSessionClient() {
  const router = useRouter()
  const { user } = useAuth()
  const { preferredGrinder } = useProfile()
  const { setGuard } = useNavGuard()

  const [recipe, setRecipe] = useState<RecipeWithAdjustment | null>(null)
  const [originalRecipe, setOriginalRecipe] = useState<Recipe | null>(null)
  const [feedbackRound, setFeedbackRound] = useState(0)
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentMetadata[]>([])
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [rebrewId, setRebrewId] = useState<string | null>(null)
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null)
  const [lastSavedRound, setLastSavedRound] = useState(-1)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const {
    activeStepIndex,
    elapsedSeconds,
    getStepProgress,
    resetTimer,
    startTimer,
    stopTimer,
    timerOverrun,
    timerRunning,
  } = useWakeLockTimer(
    recipe?.parameters.total_time ?? '0:00',
    recipe?.steps.map(step => step.time) ?? [],
  )

  function navigateWithoutGuard(href: string) {
    setGuard(null)
    setPendingNavHref(null)
    setShowLeaveConfirm(false)
    router.push(href)
  }

  useEffect(() => {
    const storedRecipe = recipeSessionStorage.getRecipe()
    if (!storedRecipe) {
      router.replace('/')
      return
    }

    resetTimer()
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

    const storedRebrewId = recipeSessionStorage.getRebrewRecipeId()
    if (storedRebrewId) {
      setRebrewId(storedRebrewId)
      setLastSavedRound(0)
    }
  }, [resetTimer, router])

  useEffect(() => {
    if (feedbackRound > lastSavedRound) {
      setGuard(href => {
        setPendingNavHref(href)
        setShowLeaveConfirm(true)
        return true
      })
    } else {
      setGuard(null)
    }

    return () => setGuard(null)
  }, [feedbackRound, lastSavedRound, setGuard])

  async function handleSave() {
    if (!recipe || !originalRecipe || saving) return

    const effectiveId = rebrewId ?? savedRecipeId
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

    if (effectiveId) {
      const manualEdits = recipeSessionStorage.getManualEditHistory<object>()

      try {
        const response = await fetch(`/api/recipes/${effectiveId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_recipe_json: recipe,
            feedback_history: [...manualEdits, ...feedbackHistoryPayload],
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error ?? 'Update failed')
        }

        setSavedMessage('Recipe updated.')
        setLastSavedRound(feedbackRound)
        setTimeout(() => setSavedMessage(null), 2000)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Update failed')
      } finally {
        setSaving(false)
      }

      return
    }

    const bean = recipeSessionStorage.getConfirmedBean()
    if (!bean) {
      setSaveError('Bean details are missing. Please generate the recipe again.')
      setSaving(false)
      return
    }
    const payload = {
      bean_info: bean,
      method: recipe.method,
      original_recipe_json: originalRecipe,
      current_recipe_json: recipe,
      feedback_history: feedbackHistoryPayload,
    }

    if (!user) {
      recipeSessionStorage.setPendingSaveRecipe(payload)
      navigateWithoutGuard('/auth?returnTo=/recipe&pendingRecipe=true')
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
      setSavedRecipeId(data.id)
      setLastSavedRound(feedbackRound)
      navigateWithoutGuard(`/recipes/${data.id}`)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
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
    resetTimer()
  }

  async function handleAdjust() {
    if (!recipe || !selectedSymptom || adjusting) return
    setAdjusting(true)
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
      setAdjusting(false)
    }
  }

  if (!recipe) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const bean = recipeSessionStorage.getConfirmedBean()
  const adjustment = recipe.adjustment_applied
  const maxRoundsReached = feedbackRound >= 3
  const hasUnsavedChanges = feedbackRound > lastSavedRound
  const saveIcon = rebrewId ?? savedRecipeId ? <Save size={20} /> : <Bookmark size={20} />

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      <div className="flex items-center justify-between px-4 sm:px-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                setShowLeaveConfirm(true)
              } else {
                router.back()
              }
            }}
            className="min-h-10 min-w-10 p-2 -ml-2 flex items-center justify-center"
          >
            <ArrowLeft className="ui-icon-action" />
          </button>
          <h2 className="ui-section-title">Your Recipe</h2>
        </div>

        {(saving || hasUnsavedChanges) && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="min-h-10 min-w-10 p-2 text-[var(--foreground)] disabled:opacity-50 relative flex items-center justify-center"
            aria-label="Save recipe"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
            ) : (
              saveIcon
            )}
          </button>
        )}
      </div>

      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-4 pb-24 overflow-y-auto">
        <div>
          <h1 className="ui-page-title-hero">{recipe.display_name}</h1>
          <p className="ui-body-muted mt-0.5">
            {bean?.bean_name || 'Your Coffee'}
            {bean?.roast_level ? ` · ${bean.roast_level.charAt(0).toUpperCase() + bean.roast_level.slice(1)} Roast` : ''}
          </p>
          <p className="ui-body-muted mt-1.5 leading-relaxed">{recipe.objective}</p>
        </div>

        {savedMessage && (
          <div className="ui-alert-success text-sm font-medium">
            {savedMessage}
          </div>
        )}

        {saveError && (
          <div className="ui-alert-danger text-sm">
            {saveError}
          </div>
        )}

        {adjustment && (
          <div className="ui-alert-warning flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="ui-card-title ui-text-warning">Adjustment {feedbackRound} of 3</p>
              <button onClick={() => setShowResetConfirm(true)} className="ui-meta underline">
                Reset to original
              </button>
            </div>
            <p className="ui-body-muted ui-text-warning">
              {adjustment.variable_changed === 'technique'
                ? adjustment.note
                : `${adjustment.variable_changed.charAt(0).toUpperCase() + adjustment.variable_changed.slice(1)}: ${adjustment.previous_value} → ${adjustment.new_value} (${adjustment.direction})`}
            </p>
            {adjustment.note && adjustment.variable_changed !== 'technique' && (
              <p className="ui-meta ui-text-warning italic">{adjustment.note}</p>
            )}
          </div>
        )}

        <RecipeParametersSection
          adjustment={adjustment}
          preferredGrinder={preferredGrinder}
          recipe={recipe}
        />

        <RecipeGrindSettingsCard
          adjustment={adjustment}
          preferredGrinder={preferredGrinder as GrinderId}
          recipe={recipe}
        />

        <RecipeStepsSection
          activeStepIndex={activeStepIndex}
          adjustment={adjustment}
          elapsedSeconds={elapsedSeconds}
          getStepProgress={getStepProgress}
          onToggleTimer={timerRunning ? stopTimer : startTimer}
          recipe={recipe}
          timerOverrun={timerOverrun}
          timerRunning={timerRunning}
        />

        <RecipeDetailsPanels recipe={recipe} />

        <RecipeFeedbackSection
          adjustError={adjustError}
          adjusting={adjusting}
          feedbackRound={feedbackRound}
          maxRoundsReached={maxRoundsReached}
          onAdjust={handleAdjust}
          onCancelFeedback={() => {
            setShowFeedback(false)
            setSelectedSymptom(null)
            setAdjustError(null)
          }}
          onOpenFeedback={() => setShowFeedback(true)}
          onReset={() => setShowResetConfirm(true)}
          onSelectSymptom={setSelectedSymptom}
          onSwitchMethod={() => router.push('/methods')}
          selectedSymptom={selectedSymptom}
          showFeedback={showFeedback}
        />
      </div>

      <ConfirmSheet
        open={showLeaveConfirm}
        title="Leave without saving?"
        message="Your recipe won't be added to your library."
        confirmLabel="Leave"
        destructive
        onConfirm={() => {
          if (pendingNavHref) {
            navigateWithoutGuard(pendingNavHref)
          } else {
            setGuard(null)
            router.back()
          }
          setPendingNavHref(null)
        }}
        onCancel={() => {
          setShowLeaveConfirm(false)
          setPendingNavHref(null)
        }}
      />

      <ConfirmSheet
        open={showResetConfirm}
        title="Reset to original recipe?"
        message="This will discard all adjustments made in this session."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          handleReset()
          setShowResetConfirm(false)
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
