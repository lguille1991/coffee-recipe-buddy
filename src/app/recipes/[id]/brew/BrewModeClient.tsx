'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'
import {
  BrewRecipeStepsSection,
  RecipeGrindSettingsCard,
  RecipeParametersSection,
} from '@/app/recipe/_components/RecipeSessionSections'
import { useWakeLockTimer } from '@/app/recipe/_hooks/useWakeLockTimer'
import { useProfile } from '@/hooks/useProfile'
import type { SavedRecipe } from '@/types/recipe'
import { shouldGuardBrewExit } from './brew-session'

type BrewModeClientProps = {
  id: string
  recipe: SavedRecipe
}

export default function BrewModeClient({ id, recipe }: BrewModeClientProps) {
  const router = useRouter()
  const { preferredGrinder } = useProfile()
  const { setGuard } = useNavGuard()
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const pendingHistoryDeltaRef = useRef<number | null>(null)
  const exitBypassRef = useRef(false)
  const confirmingBrowserExitRef = useRef(false)
  const historyTrapEnabledRef = useRef(false)

  const brewRecipe = recipe.current_recipe_json
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
    brewRecipe.parameters.total_time,
    brewRecipe.steps.map(step => step.time),
  )

  const exitGuardActive = shouldGuardBrewExit(timerRunning, elapsedSeconds)

  useEffect(() => {
    if (!exitGuardActive || exitBypassRef.current) {
      setGuard(null)
      return
    }

    setGuard(href => {
      setPendingNavHref(href)
      pendingHistoryDeltaRef.current = null
      setShowExitConfirm(true)
      return true
    })

    return () => setGuard(null)
  }, [exitGuardActive, setGuard])

  useEffect(() => {
    if (!exitGuardActive || exitBypassRef.current) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [exitGuardActive])

  useEffect(() => {
    if (!exitGuardActive || exitBypassRef.current || historyTrapEnabledRef.current) return

    window.history.pushState({ brewGuard: true }, '', window.location.href)
    historyTrapEnabledRef.current = true
  }, [exitGuardActive])

  useEffect(() => {
    if (!exitGuardActive || exitBypassRef.current) return

    const handlePopState = () => {
      if (confirmingBrowserExitRef.current || exitBypassRef.current) return
      window.history.go(1)
      pendingHistoryDeltaRef.current = -2
      setPendingNavHref(null)
      setShowExitConfirm(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [exitGuardActive])

  function handleTimerToggle() {
    if (timerRunning) {
      stopTimer()
      return
    }

    startTimer()
  }

  function handleBack() {
    if (exitGuardActive) {
      setPendingNavHref(`/recipes/${id}`)
      pendingHistoryDeltaRef.current = null
      setShowExitConfirm(true)
      return
    }

    router.push(`/recipes/${id}`)
  }

  function handleOpenRecipeDetails() {
    if (exitGuardActive) {
      setPendingNavHref(`/recipes/${id}`)
      pendingHistoryDeltaRef.current = null
      setShowExitConfirm(true)
      return
    }

    router.push(`/recipes/${id}`)
  }

  function handleConfirmExit() {
    exitBypassRef.current = true
    setGuard(null)
    setShowExitConfirm(false)
    resetTimer()

    if (pendingNavHref) {
      const href = pendingNavHref
      setPendingNavHref(null)
      pendingHistoryDeltaRef.current = null
      router.push(href)
      return
    }

    const historyDelta = pendingHistoryDeltaRef.current
    pendingHistoryDeltaRef.current = null

    if (historyDelta !== null) {
      confirmingBrowserExitRef.current = true
      window.history.go(historyDelta)
      return
    }

    router.back()
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      <div className="flex items-center justify-between px-4 sm:px-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="min-h-10 min-w-10 p-2 -ml-2 flex items-center justify-center"
            aria-label="Go back"
          >
            <svg className="ui-icon-action" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p className="ui-section-title">Brew Mode</p>
            <p className="ui-body-muted">{recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Saved recipe'}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-4 pb-52 overflow-y-auto">
        <div>
          <h1 className="ui-page-title-hero">{brewRecipe.display_name}</h1>
          <p className="ui-body-muted mt-1.5 leading-relaxed">{brewRecipe.objective}</p>
        </div>

        <RecipeParametersSection
          preferredGrinder={preferredGrinder}
          recipe={brewRecipe}
        />

        <RecipeGrindSettingsCard
          preferredGrinder={preferredGrinder}
          recipe={brewRecipe}
        />

        <BrewRecipeStepsSection
          activeStepIndex={activeStepIndex}
          elapsedSeconds={elapsedSeconds}
          getStepProgress={getStepProgress}
          onToggleTimer={handleTimerToggle}
          recipe={brewRecipe}
          timerOverrun={timerOverrun}
          timerRunning={timerRunning}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-56">
        <div className="w-full px-4 sm:px-6 md:max-w-2xl md:mx-auto lg:max-w-3xl xl:max-w-5xl xl:px-8 pb-20 lg:pb-6 pt-3 bg-[var(--background)]/95 backdrop-blur-sm border-t border-[var(--border)]">
          <button
            onClick={handleOpenRecipeDetails}
            className="w-full ui-button-secondary"
          >
            Back to recipe details
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={showExitConfirm}
        title="Leave brew mode?"
        message="Leaving brew mode will stop and reset the timer for this session."
        confirmLabel="Leave Brew Mode"
        destructive
        onConfirm={handleConfirmExit}
        onCancel={() => {
          setShowExitConfirm(false)
          setPendingNavHref(null)
          pendingHistoryDeltaRef.current = null
        }}
      />
    </div>
  )
}
