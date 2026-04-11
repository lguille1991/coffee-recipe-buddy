'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, Bookmark } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'
import { buildRecipeFromManualDraft, validateManualRecipeDraft, type ManualRecipeDraft } from '@/lib/manual-recipe'
import {
  AdjustmentMetadata,
  GrinderId,
  RecipeDraftStep,
  Recipe,
  RecipeWithAdjustment,
  Symptom,
} from '@/types/recipe'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { RecipeEditGrindSettings } from '@/app/recipes/[id]/_components/RecipeDetailSections'
import { recomputeAccumulated } from '@/app/recipes/[id]/_lib/editing'
import {
  RecipeDetailsPanels,
  RecipeFeedbackSection,
  RecipeGrindSettingsCard,
  RecipeParametersSection,
  StaticRecipeStepsSection,
} from './_components/RecipeSessionSections'

const SortableStepList = dynamic(() => import('@/app/recipes/[id]/SortableStepList'), { ssr: false })

type FlowSource = 'manual' | 'generated'

function parseWholeNumberInput(value: string): number | '' {
  if (value === '') return ''
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? '' : Math.max(0, parsed)
}

function getRequiredInputClass(isMissing: boolean) {
  return [
    'ui-input bg-[var(--background)] font-semibold px-3',
    isMissing
      ? 'border-[var(--danger-border)] bg-[var(--danger-bg)]/45 focus:border-[var(--danger-border)] focus:ring-2 focus:ring-[var(--danger-border)]/45'
      : '',
  ].join(' ').trim()
}

export default function RecipeSessionClient() {
  const router = useRouter()
  const { user } = useAuth()
  const { profile, preferredGrinder } = useProfile()
  const tempUnit = profile?.temp_unit ?? 'C'
  const { setGuard } = useNavGuard()

  const [flowSource, setFlowSource] = useState<FlowSource | null>(null)
  const [recipe, setRecipe] = useState<RecipeWithAdjustment | null>(null)
  const [originalRecipe, setOriginalRecipe] = useState<Recipe | null>(null)
  const [manualDraft, setManualDraft] = useState<ManualRecipeDraft | null>(null)
  const [feedbackRound, setFeedbackRound] = useState(0)
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentMetadata[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [lastSavedRound, setLastSavedRound] = useState(-1)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const isManualMode = flowSource === 'manual'
  const hasUnsavedChanges = isManualMode
    ? manualDraft !== null
    : feedbackRound > lastSavedRound

  function navigateWithoutGuard(href: string) {
    setGuard(null)
    setPendingNavHref(null)
    setShowLeaveConfirm(false)
    router.push(href)
  }

  useEffect(() => {
    const storedFlowSource = recipeSessionStorage.getRecipeFlowSource()

    if (storedFlowSource === 'manual') {
      const storedManualDraft = recipeSessionStorage.getManualRecipeDraft()
      if (!storedManualDraft) {
        router.replace('/methods')
        return
      }

      setFlowSource('manual')
      setManualDraft(storedManualDraft)
      return
    }

    const storedRecipe = recipeSessionStorage.getRecipe()
    if (!storedRecipe) {
      router.replace('/')
      return
    }

    setFlowSource('generated')
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
  }, [router])

  useEffect(() => {
    if (isManualMode && manualDraft) {
      recipeSessionStorage.setManualRecipeDraft(manualDraft)
    }
  }, [isManualMode, manualDraft])

  useEffect(() => {
    if (hasUnsavedChanges) {
      setGuard(href => {
        setPendingNavHref(href)
        setShowLeaveConfirm(true)
        return true
      })
    } else {
      setGuard(null)
    }

    return () => setGuard(null)
  }, [hasUnsavedChanges, setGuard])

  const manualValidation = useMemo(() => {
    if (!isManualMode || !manualDraft) return { valid: false, error: null as string | null }
    return validateManualRecipeDraft(manualDraft, preferredGrinder, tempUnit)
  }, [isManualMode, manualDraft, preferredGrinder, tempUnit])

  const manualRequiredState = useMemo(() => {
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

  async function handleSave() {
    if (saving) return

    if (isManualMode) {
      if (!manualDraft) return

      setSaveError(null)
      setStepError(null)

      if (!manualValidation.valid) {
        const error = manualValidation.error ?? 'Recipe draft is incomplete.'
        setSaveError(error.includes('Step') ? null : error)
        setStepError(error.includes('Step') ? error : null)
        return
      }

      const builtRecipe = buildRecipeFromManualDraft(manualDraft, preferredGrinder, tempUnit)
      const payload = {
        bean_info: manualDraft.bean_info,
        method: manualDraft.method,
        original_recipe_json: builtRecipe,
        current_recipe_json: builtRecipe,
        feedback_history: [],
      }

      setSaving(true)

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
        recipeSessionStorage.clearManualRecipeDraft()
        navigateWithoutGuard(`/recipes/${data.id}`)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Save failed')
      } finally {
        setSaving(false)
      }

      return
    }

    if (!recipe || !originalRecipe) return

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

  const updateManualDraft = useCallback((updater: (draft: ManualRecipeDraft) => ManualRecipeDraft) => {
    setManualDraft(current => current ? updater(current) : current)
  }, [])

  const handleManualStepUpdate = useCallback((dndId: string, updates: Partial<RecipeDraftStep>) => {
    updateManualDraft(current => {
      const updatedSteps = current.edit_draft.steps.map(step => step._dndId === dndId ? { ...step, ...updates } : step)
      const nextSteps = 'water_poured_g' in updates ? recomputeAccumulated(updatedSteps) : updatedSteps
      const totalPoured = Math.round(nextSteps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10) / 10

      return {
        ...current,
        edit_draft: {
          ...current.edit_draft,
          steps: nextSteps,
          water_g: totalPoured,
          ratio_multiplier: current.edit_draft.coffee_g > 0 ? totalPoured / current.edit_draft.coffee_g : 0,
        },
      }
    })
  }, [updateManualDraft])

  const handleManualStepDelete = useCallback((dndId: string) => {
    updateManualDraft(current => {
      const filtered = current.edit_draft.steps.filter(step => step._dndId !== dndId)
      const nextSteps = recomputeAccumulated(filtered)
      const totalPoured = Math.round(nextSteps.reduce((sum, step) => sum + step.water_poured_g, 0) * 10) / 10

      return {
        ...current,
        edit_draft: {
          ...current.edit_draft,
          steps: nextSteps,
          water_g: totalPoured,
          ratio_multiplier: current.edit_draft.coffee_g > 0 ? totalPoured / current.edit_draft.coffee_g : 0,
        },
      }
    })
  }, [updateManualDraft])

  const handleManualStepAdd = useCallback(() => {
    updateManualDraft(current => ({
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
  }, [updateManualDraft])

  const handleManualStepReorder = useCallback((newSteps: RecipeDraftStep[]) => {
    updateManualDraft(current => ({
      ...current,
      edit_draft: {
        ...current.edit_draft,
        steps: recomputeAccumulated(newSteps),
      },
    }))
  }, [updateManualDraft])

  if (flowSource === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const bean = recipeSessionStorage.getConfirmedBean()
  const adjustment = recipe?.adjustment_applied
  const maxRoundsReached = feedbackRound >= 3

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
          <h2 className="ui-section-title">{isManualMode ? 'Build Recipe' : 'Your Recipe'}</h2>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || (isManualMode && !manualValidation.valid)}
          className="min-h-10 min-w-10 p-2 text-[var(--foreground)] disabled:opacity-50 relative flex items-center justify-center"
          aria-label="Save recipe"
          title={isManualMode && !manualValidation.valid ? (manualValidation.error ?? 'Complete the recipe before saving') : 'Save recipe'}
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Bookmark size={20} />
          )}
        </button>
      </div>

      {isManualMode && manualDraft ? (
        <div className="flex-1 px-4 sm:px-6 flex flex-col gap-4 pb-24 overflow-y-auto">
          <div>
            <h1 className="ui-page-title-hero">{manualDraft.display_name}</h1>
            <p className="ui-body-muted mt-0.5">
              {manualDraft.bean_info.bean_name || manualDraft.bean_info.origin || 'Your Coffee'}
              {manualDraft.bean_info.roast_level ? ` · ${manualDraft.bean_info.roast_level.charAt(0).toUpperCase() + manualDraft.bean_info.roast_level.slice(1)} Roast` : ''}
            </p>
            <p className="ui-body-muted mt-1.5 leading-relaxed">
              Add your own brew parameters and steps. This manual recipe will save once the fields are complete.
            </p>
            <p className="ui-meta ui-text-danger mt-2">
              All fields marked * are required before you can save.
            </p>
          </div>

          {saveError && (
            <div className="ui-alert-danger text-sm">
              {saveError}
            </div>
          )}

          <div>
            <h3 className="ui-overline mb-2">Parameters</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="ui-overline">Temp (°{tempUnit}) <span className="ui-text-danger">*</span></span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={tempUnit === 'F' ? 140 : 60}
                  max={tempUnit === 'F' ? 212 : 100}
                  step={1}
                  value={manualDraft.edit_draft.temperature_display}
                  onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                  onChange={event => updateManualDraft(current => ({
                    ...current,
                    edit_draft: { ...current.edit_draft, temperature_display: parseWholeNumberInput(event.target.value) },
                  }))}
                  className={getRequiredInputClass(manualRequiredState.temperatureMissing)}
                  placeholder={tempUnit === 'F' ? '199' : '93'}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="ui-overline">Brew Time <span className="ui-text-danger">*</span></span>
                <input
                  type="text"
                  placeholder="e.g. 3:30"
                  value={manualDraft.edit_draft.total_time}
                  onChange={event => updateManualDraft(current => ({
                    ...current,
                    edit_draft: { ...current.edit_draft, total_time: event.target.value },
                  }))}
                  className={getRequiredInputClass(manualRequiredState.totalTimeMissing)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="ui-overline">Coffee (g) <span className="ui-text-danger">*</span></span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.1}
                  value={manualDraft.edit_draft.coffee_g || ''}
                  onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                  onChange={event => updateManualDraft(current => {
                    const coffee = event.target.value === '' ? 0 : Math.max(0, parseFloat(event.target.value) || 0)
                    return {
                      ...current,
                      edit_draft: {
                        ...current.edit_draft,
                        coffee_g: coffee,
                        ratio_multiplier: coffee > 0 ? current.edit_draft.water_g / coffee : 0,
                      },
                    }
                  })}
                  className={getRequiredInputClass(manualRequiredState.coffeeMissing)}
                  placeholder="15"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="ui-overline">Water (g) <span className="ui-text-danger">*</span></span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.1}
                  value={manualDraft.edit_draft.water_g || ''}
                  onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                  onChange={event => updateManualDraft(current => {
                    const water = event.target.value === '' ? 0 : Math.max(0, parseFloat(event.target.value) || 0)
                    return {
                      ...current,
                      edit_draft: {
                        ...current.edit_draft,
                        water_g: water,
                        ratio_multiplier: current.edit_draft.coffee_g > 0 ? water / current.edit_draft.coffee_g : 0,
                      },
                    }
                  })}
                  className={getRequiredInputClass(manualRequiredState.waterMissing)}
                  placeholder="250"
                />
              </label>
            </div>
          </div>

          <RecipeEditGrindSettings
            editDraft={manualDraft.edit_draft}
            grindRange={null}
            highlightEmptyRequired={manualRequiredState.grindMissing}
            isGrindOutOfRange={false}
            onChange={value => updateManualDraft(current => ({
              ...current,
              edit_draft: { ...current.edit_draft, grind_preferred_value: value },
            }))}
            preferredGrinder={preferredGrinder}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="ui-overline">Brew Steps</h3>
              <span className="ui-meta">Time, water, and description are required for each step.</span>
            </div>
            <SortableStepList
              highlightEmptyRequired
              steps={manualDraft.edit_draft.steps}
              onAdd={handleManualStepAdd}
              onDelete={handleManualStepDelete}
              onReorder={handleManualStepReorder}
              onUpdate={handleManualStepUpdate}
              stepError={stepError}
            />
          </div>
        </div>
      ) : recipe ? (
        <div className="flex-1 px-4 sm:px-6 flex flex-col gap-4 pb-24 overflow-y-auto">
          <div>
            <h1 className="ui-page-title-hero">{recipe.display_name}</h1>
            <p className="ui-body-muted mt-0.5">
              {bean?.bean_name || 'Your Coffee'}
              {bean?.roast_level ? ` · ${bean.roast_level.charAt(0).toUpperCase() + bean.roast_level.slice(1)} Roast` : ''}
            </p>
            <p className="ui-body-muted mt-1.5 leading-relaxed">{recipe.objective}</p>
          </div>

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

          <StaticRecipeStepsSection
            adjustment={adjustment}
            recipe={recipe}
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
      ) : null}

      <ConfirmSheet
        open={showLeaveConfirm}
        title={isManualMode ? 'Leave manual recipe?' : 'Leave without saving?'}
        message={isManualMode ? 'Your manual recipe draft will stay in this session, but it will not be saved to your library.' : "Your recipe won't be added to your library."}
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
