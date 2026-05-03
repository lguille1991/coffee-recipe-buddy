'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Bookmark } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

import { useManualRecipe } from './_hooks/useManualRecipe'
import { useFeedbackFlow } from './_hooks/useFeedbackFlow'
import ManualRecipeForm from './_components/ManualRecipeForm'
import { FeedbackAdjustmentPanel } from './_components/FeedbackAdjustmentPanel'

type FlowSource = 'manual' | 'generated'

export default function RecipeSessionClient() {
  const router = useRouter()
  const { user } = useAuth()
  const { profile, preferredGrinder } = useProfile()
  const tempUnit = profile?.temp_unit ?? 'C'
  const { setGuard } = useNavGuard()

  // Track flow source to determine which mode we're in
  const [flowSource, setFlowSource] = useState<FlowSource | null>(null)

  // Navigation guard state
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)

  // Initialize manual recipe hook
  const {
    manualDraft,
    isSaving: isSavingManual,
    saveError: manualSaveError,
    stepError,
    validation,
    requiredState,
    updateDraft,
    handleStepUpdate,
    handleStepDelete,
    handleStepAdd,
    handleStepReorder,
    handleSaveManual,
  } = useManualRecipe({
    user,
    preferredGrinder,
    tempUnit,
    onNavigate: useCallback((href: string) => {
      setGuard(null)
      router.push(href)
    }, [router, setGuard]),
    onSaveSuccess: useCallback((recipeId: string) => {
      setGuard(null)
      router.push(`/recipes/${recipeId}`)
    }, [router, setGuard]),
  })

  // Initialize feedback flow hook
  const {
    recipe,
    feedbackRound,
    isAdjusting,
    adjustError,
    saving: isSavingFeedback,
    saveError: feedbackSaveError,
    hasUnsavedChanges: hasFeedbackUnsavedChanges,
    maxRoundsReached,
    currentAdjustment,
    showFeedback,
    selectedSymptom,
    handleAdjust,
    handleReset,
    handleSaveFeedback,
    setShowFeedback,
    setSelectedSymptom,
  } = useFeedbackFlow({
    preferredGrinder,
    onNavigate: useCallback((href: string) => {
      setGuard(null)
      router.push(href)
    }, [router, setGuard]),
  })

  const isManualMode = flowSource === 'manual'
  const hasUnsavedChanges = isManualMode
    ? manualDraft !== null
    : hasFeedbackUnsavedChanges

  // Load flow source from sessionStorage on mount
  useEffect(() => {
    const storedFlowSource = recipeSessionStorage.getRecipeFlowSource()

    if (storedFlowSource === 'manual') {
      const storedManualDraft = recipeSessionStorage.getManualRecipeDraft()
      if (!storedManualDraft) {
        router.replace('/methods')
        return
      }
      setFlowSource('manual')
      return
    }

    const storedRecipe = recipeSessionStorage.getRecipe()
    if (!storedRecipe) {
      router.replace('/')
      return
    }

    setFlowSource('generated')
  }, [router])

  // Set up navigation guard
  useEffect(() => {
    if (hasUnsavedChanges) {
      setGuard((href: string) => {
        setPendingNavHref(href)
        setShowLeaveConfirm(true)
        return true
      })
    } else {
      setGuard(null)
    }

    return () => setGuard(null)
  }, [hasUnsavedChanges, setGuard])

  // Handle save button click - delegates to appropriate hook
  const handleSave = useCallback(async () => {
    if (isManualMode) {
      await handleSaveManual()
    } else {
      await handleSaveFeedback(user)
    }
  }, [isManualMode, handleSaveManual, handleSaveFeedback, user])

  // Handle leave confirmation
  const handleConfirmLeave = useCallback(() => {
    setGuard(null)
    if (pendingNavHref) {
      router.push(pendingNavHref)
    } else {
      router.back()
    }
    setPendingNavHref(null)
    setShowLeaveConfirm(false)
  }, [pendingNavHref, router, setGuard])

  // Handle cancel leave
  const handleCancelLeave = useCallback(() => {
    setShowLeaveConfirm(false)
    setPendingNavHref(null)
  }, [])

  // Handle back button click
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true)
    } else {
      router.back()
    }
  }, [hasUnsavedChanges, router])

  // Loading state while determining flow source
  if (flowSource === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isSaving = isManualMode ? isSavingManual : isSavingFeedback
  const saveError = isManualMode ? manualSaveError : feedbackSaveError
  const isValid = isManualMode ? validation.valid : true

  return (
    <div className="ui-page-shell">
      <div className="ui-top-spacer" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="ui-icon-button -ml-2"
          >
            <ArrowLeft className="ui-icon-action" />
          </button>
          <h2 className="ui-section-title">
            {isManualMode ? 'Build Recipe' : 'Your Recipe'}
          </h2>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || (isManualMode && !isValid)}
          className="ui-icon-button text-[var(--foreground)] disabled:opacity-50 relative"
          aria-label="Save recipe"
          title={isManualMode && !isValid ? (validation.error ?? 'Complete the recipe before saving') : 'Save recipe'}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Bookmark size={20} />
          )}
        </button>
      </div>

      {/* Render appropriate content based on mode */}
      {isManualMode && manualDraft ? (
        <ManualRecipeForm
          manualDraft={manualDraft}
          tempUnit={tempUnit}
          preferredGrinder={preferredGrinder}
          saveError={saveError}
          stepError={stepError}
          requiredState={requiredState}
          updateDraft={updateDraft}
          onStepUpdate={handleStepUpdate}
          onStepDelete={handleStepDelete}
          onStepAdd={handleStepAdd}
          onStepReorder={handleStepReorder}
        />
      ) : recipe ? (
        <FeedbackAdjustmentPanel
          recipe={recipe}
          adjustment={currentAdjustment}
          feedbackRound={feedbackRound}
          showFeedback={showFeedback}
          selectedSymptom={selectedSymptom}
          adjustError={adjustError}
          adjusting={isAdjusting}
          maxRoundsReached={maxRoundsReached}
          preferredGrinder={preferredGrinder}
          onAdjust={handleAdjust}
          onOpenFeedback={() => setShowFeedback(true)}
          onCancelFeedback={() => {
            setShowFeedback(false)
            setSelectedSymptom(null)
          }}
          onSelectSymptom={setSelectedSymptom}
          onReset={() => setShowResetConfirm(true)}
          onSwitchMethod={() => router.push('/methods')}
        />
      ) : null}

      {/* Leave confirmation dialog */}
      <ConfirmSheet
        open={showLeaveConfirm}
        title={isManualMode ? 'Leave manual recipe?' : 'Leave without saving?'}
        message={isManualMode ? 'Your manual recipe draft will stay in this session, but it will not be saved to your library.' : "Your recipe won't be added to your library."}
        confirmLabel="Leave"
        destructive
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />

      {/* Reset confirmation dialog */}
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

      <div className="ui-bottom-spacer" />
    </div>
  )
}
