'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bookmark, Save, Droplets, Scale, Thermometer, Timer, CircleDot, Ratio, Play, Square } from 'lucide-react'
import { Recipe, RecipeWithAdjustment, Symptom, AdjustmentMetadata, GrinderId, GRINDER_DISPLAY_NAMES } from '@/types/recipe'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'

function normalizeClickSetting(value: string): string {
  return value.replace(/^clicks?\s+(\d+)$/i, '$1 clicks')
}

function parseTimeToSeconds(t: string): number {
  const lower = t.split('–')[0].trim()
  const [m, s] = lower.split(':').map(Number)
  return m * 60 + s
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ParamCard({
  icon,
  value,
  label,
  changed,
  annotation,
}: {
  icon: React.ReactNode
  value: string
  label: string
  changed?: boolean
  annotation?: string
}) {
  return (
    <div className={`rounded-xl p-3 flex flex-col items-start gap-1.5 relative ${
      changed ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-[var(--background)]'
    }`}>
      <div className="text-[var(--muted-foreground)]">{icon}</div>
      <p className="text-sm font-semibold text-[var(--foreground)]">{value}</p>
      <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">{label}</p>
      {changed && annotation && (
        <p className="text-[9px] text-amber-600 font-medium leading-tight">{annotation}</p>
      )}
    </div>
  )
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-[var(--card)] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-[var(--foreground)]">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6L8 10L12 6" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

const SYMPTOM_OPTIONS: { value: Symptom; emoji: string; label: string }[] = [
  { value: 'too_acidic', emoji: '☀️', label: 'Too acidic' },
  { value: 'too_bitter', emoji: '🔥', label: 'Too bitter' },
  { value: 'flat_lifeless', emoji: '💧', label: 'Flat / lifeless' },
  { value: 'slow_drain', emoji: '🐌', label: 'Slow drain' },
  { value: 'fast_drain', emoji: '💨', label: 'Fast drain' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecipePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { preferredGrinder } = useProfile()
  const { setGuard } = useNavGuard()

  const [recipe, setRecipe] = useState<RecipeWithAdjustment | null>(null)
  const [originalRecipe, setOriginalRecipe] = useState<Recipe | null>(null)
  const [feedbackRound, setFeedbackRound] = useState(0)
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentMetadata[]>([])

  // Save state
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Track the DB record for this session so adjustments can be PATCHed back
  const [rebrewId, setRebrewId] = useState<string | null>(null)
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null)
  const [lastSavedRound, setLastSavedRound] = useState(-1)

  // Confirmation modals
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)

  // Feedback UI state
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  // Grind settings UI state
  const [secondaryGrindersOpen, setSecondaryGrindersOpen] = useState(false)

  // Brew timer
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startTimer() {
    setTimerRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1)
    }, 1000)
  }

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    setTimerRunning(false)
    setElapsedSeconds(0)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  useEffect(() => {
    const raw = sessionStorage.getItem('recipe')
    if (!raw) { router.replace('/'); return }
    const parsed: RecipeWithAdjustment = JSON.parse(raw)
    stopTimer()
    setRecipe(parsed)

    // Store original recipe on first load (only if not already stored)
    const origRaw = sessionStorage.getItem('recipe_original')
    if (!origRaw) {
      sessionStorage.setItem('recipe_original', raw)
      setOriginalRecipe(parsed)
    } else {
      setOriginalRecipe(JSON.parse(origRaw))
    }

    // Restore round count + history
    const roundRaw = sessionStorage.getItem('feedback_round')
    if (roundRaw) setFeedbackRound(parseInt(roundRaw))

    const historyRaw = sessionStorage.getItem('adjustment_history')
    if (historyRaw) setAdjustmentHistory(JSON.parse(historyRaw))

    // Rebrew from a saved recipe — track the existing ID for PATCH updates
    const rebrewRaw = sessionStorage.getItem('rebrew_recipe_id')
    if (rebrewRaw) {
      setRebrewId(rebrewRaw)
      setLastSavedRound(0) // nothing new to save until an adjustment is made
    }
  }, [router])

  useEffect(() => {
    if (feedbackRound > lastSavedRound) {
      setGuard((href) => {
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
    const feedbackHistoryPayload = adjustmentHistory.map((a, i) => ({
      round: i + 1,
      symptom: a.symptom,
      variable_changed: a.variable_changed,
      previous_value: a.previous_value,
      new_value: a.new_value,
    }))

    setSaving(true)
    setSaveError(null)

    if (effectiveId) {
      // Update an existing saved recipe — merge manual edits preserved from initial brew load
      const manualEditsRaw = sessionStorage.getItem('manual_edit_history')
      const manualEdits = manualEditsRaw ? JSON.parse(manualEditsRaw) : []
      try {
        const res = await fetch(`/api/recipes/${effectiveId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_recipe_json: recipe,
            feedback_history: [...manualEdits, ...feedbackHistoryPayload],
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Update failed')
        }
        setSavedMessage('Recipe updated.')
        setLastSavedRound(feedbackRound)
        setTimeout(() => setSavedMessage(null), 2000)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Update failed')
      } finally {
        setSaving(false)
      }
      return
    }

    // First-time save: POST a new recipe
    const beanRawInner = typeof window !== 'undefined' ? sessionStorage.getItem('confirmedBean') : null
    const beanInner = beanRawInner ? JSON.parse(beanRawInner) : {}

    const payload = {
      bean_info: beanInner,
      method: recipe.method,
      original_recipe_json: originalRecipe,
      current_recipe_json: recipe,
      feedback_history: feedbackHistoryPayload,
    }

    if (!user) {
      // Guest: hold payload and redirect to auth
      sessionStorage.setItem('pending_save_recipe', JSON.stringify(payload))
      router.push(`/auth?returnTo=/recipe&pendingRecipe=true`)
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      const data = await res.json()
      setSavedRecipeId(data.id)
      setSavedMessage('Recipe saved to your library.')
      setLastSavedRound(feedbackRound)
      setTimeout(() => setSavedMessage(null), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!originalRecipe) return
    sessionStorage.setItem('recipe', JSON.stringify(originalRecipe))
    sessionStorage.removeItem('feedback_round')
    sessionStorage.removeItem('adjustment_history')
    sessionStorage.removeItem('manual_edit_history')
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
      const res = await fetch('/api/adjust-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_recipe: recipe, symptom: selectedSymptom, round: nextRound, preferred_grinder: preferredGrinder }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Adjustment failed')
      }

      const updated: RecipeWithAdjustment = await res.json()

      // Persist
      sessionStorage.setItem('recipe', JSON.stringify(updated))
      sessionStorage.setItem('feedback_round', String(nextRound))

      const newHistory = [...adjustmentHistory, updated.adjustment_applied!].filter(Boolean)
      sessionStorage.setItem('adjustment_history', JSON.stringify(newHistory))

      setRecipe(updated)
      setFeedbackRound(nextRound)
      setAdjustmentHistory(newHistory)
      setShowFeedback(false)
      setSelectedSymptom(null)
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Something went wrong')
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

  const beanRaw = typeof window !== 'undefined' ? sessionStorage.getItem('confirmedBean') : null
  const bean = JSON.parse(beanRaw || '{}')

  const adj = recipe.adjustment_applied
  const changedVar = adj?.variable_changed

  // Helpers to determine if a specific field was just changed
  function grindChanged() { return changedVar === 'grind' }
  function tempChanged() { return changedVar === 'temperature' }
  function ratioChanged() { return changedVar === 'ratio' }

  function annotation(field: string): string | undefined {
    if (!adj) return undefined
    if (field === 'grind' && grindChanged()) return `${adj.previous_value} → ${adj.new_value} (${adj.direction})`
    if (field === 'temp' && tempChanged()) return `${adj.previous_value} → ${adj.new_value} (${adj.direction})`
    if (field === 'ratio' && ratioChanged()) return `${adj.previous_value} → ${adj.new_value} (${adj.direction})`
    return undefined
  }

  const maxRoundsReached = feedbackRound >= 3
  const selectedMethodRaw = typeof window !== 'undefined' ? sessionStorage.getItem('selectedMethod') : null
  const selectedMethod = selectedMethodRaw ? JSON.parse(selectedMethodRaw) : null

  // Timer derived values
  const totalTimeSeconds = recipe ? parseTimeToSeconds(recipe.parameters.total_time) : 0
  const timerOverrun = elapsedSeconds > totalTimeSeconds && totalTimeSeconds > 0
  const activeStepIndex = timerRunning && recipe
    ? recipe.steps.reduce((active, step, i) => {
        return parseTimeToSeconds(step.time) <= elapsedSeconds ? i : active
      }, -1)
    : -1

  function getStepProgress(index: number): number {
    if (!recipe || activeStepIndex !== index) return 0
    const stepStart = parseTimeToSeconds(recipe.steps[index].time)
    const nextStart = index + 1 < recipe.steps.length
      ? parseTimeToSeconds(recipe.steps[index + 1].time)
      : totalTimeSeconds
    if (nextStart <= stepStart) return 1
    return Math.min(1, (elapsedSeconds - stepStart) / (nextStart - stepStart))
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (feedbackRound > lastSavedRound) {
                setShowLeaveConfirm(true)
              } else {
                router.back()
              }
            }}
            className="p-2 -ml-2"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">Your Recipe</h2>
        </div>
        {(saving || feedbackRound > lastSavedRound) && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-2 text-[var(--foreground)] disabled:opacity-50 relative"
            aria-label="Save recipe"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
            ) : rebrewId ?? savedRecipeId ? (
              <Save size={20} />
            ) : (
              <Bookmark size={20} />
            )}
          </button>
        )}
      </div>

      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-4 pb-24 overflow-y-auto">

        {/* Title */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)]">{recipe.display_name}</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {bean.bean_name || 'Your Coffee'}{bean.roast_level ? ` · ${bean.roast_level.charAt(0).toUpperCase() + bean.roast_level.slice(1)} Roast` : ''}
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1.5 leading-relaxed">{recipe.objective}</p>
        </div>

        {/* Save feedback */}
        {savedMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm font-medium text-green-800">
            {savedMessage}
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {/* Adjustment banner */}
        {adj && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-amber-700">Adjustment {feedbackRound} of 3</p>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-[10px] text-[var(--muted-foreground)] underline"
              >
                Reset to original
              </button>
            </div>
            <p className="text-sm text-amber-800">
              {adj.variable_changed === 'technique'
                ? adj.note
                : `${adj.variable_changed.charAt(0).toUpperCase() + adj.variable_changed.slice(1)}: ${adj.previous_value} → ${adj.new_value} (${adj.direction})`}
            </p>
            {adj.note && adj.variable_changed !== 'technique' && (
              <p className="text-[10px] text-amber-600 italic">{adj.note}</p>
            )}
          </div>
        )}

        {/* Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Parameters</h3>
          <div className="grid grid-cols-3 xl:grid-cols-6 gap-2">
            <ParamCard
              icon={<Droplets size={16} />}
              value={`${recipe.parameters.water_g}ml`}
              label="Water"
              changed={ratioChanged()}
              annotation={annotation('ratio')}
            />
            <ParamCard
              icon={<Scale size={16} />}
              value={`${recipe.parameters.coffee_g}g`}
              label="Coffee"
            />
            <ParamCard
              icon={<Thermometer size={16} />}
              value={`${recipe.parameters.temperature_c}°C`}
              label="Temp"
              changed={tempChanged()}
              annotation={annotation('temp')}
            />
            <ParamCard
              icon={<Timer size={16} />}
              value={recipe.parameters.total_time}
              label="Brew Time"
            />
            <ParamCard
              icon={<CircleDot size={16} />}
              value={normalizeClickSetting(recipe.grind[preferredGrinder].starting_point)}
              label="Grind"
              changed={grindChanged()}
              annotation={annotation('grind')}
            />
            <ParamCard
              icon={<Ratio size={16} />}
              value={recipe.parameters.ratio}
              label="Ratio"
              changed={ratioChanged()}
            />
          </div>
        </div>

        {/* Grinder Settings */}
        {(() => {
          const secondaryGrinders = (['k_ultra', 'q_air', 'baratza_encore_esp', 'timemore_c2'] as GrinderId[]).filter(g => g !== preferredGrinder)
          const primaryData = recipe.grind[preferredGrinder]
          return (
            <div className={`bg-[var(--card)] rounded-2xl p-4 ${grindChanged() ? 'ring-1 ring-amber-200' : ''}`}>
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Grind Settings</h3>

              {/* Primary grinder */}
              <div className={`rounded-xl p-3 mb-3 text-[var(--background)] ${grindChanged() ? 'bg-amber-700' : 'bg-[var(--foreground)]'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium opacity-70">{GRINDER_DISPLAY_NAMES[preferredGrinder]}</span>
                  <span className="text-[10px] opacity-50 bg-[var(--background)]/10 px-2 py-0.5 rounded-full">Primary</span>
                </div>
                <p className="text-lg font-bold">{normalizeClickSetting(primaryData.starting_point)}</p>
                <p className="text-sm opacity-60 mt-0.5">Range: {primaryData.range}</p>
                {grindChanged() && adj && (
                  <p className="text-sm opacity-80 mt-1 font-medium">{adj.previous_value} → {adj.new_value}</p>
                )}
                {primaryData.description && (
                  <p className="text-sm opacity-50 mt-1 italic">{primaryData.description}</p>
                )}
                {primaryData.note && (
                  <p className="text-sm opacity-50 mt-1 italic">{primaryData.note}</p>
                )}
              </div>

              {/* Secondary grinders toggle */}
              <button
                onClick={() => setSecondaryGrindersOpen(o => !o)}
                className="flex items-center justify-between w-full py-2 text-left mt-2"
              >
                <span className="text-xs font-medium text-[var(--muted-foreground)]">See more grinders</span>
                <svg
                  width="14" height="14" viewBox="0 0 14 14" fill="none"
                  className={`transition-transform text-[var(--muted-foreground)] ${secondaryGrindersOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Secondary grinders */}
              {secondaryGrindersOpen && (
                <div className="mt-2">
                  {secondaryGrinders.map((grinder, i) => {
                    const data = recipe.grind[grinder]
                    const isLast = i === secondaryGrinders.length - 1
                    return (
                      <div key={grinder} className={`flex items-start justify-between py-2.5 gap-3 ${isLast ? '' : 'border-b border-[var(--border)]'}`}>
                        <div>
                          <p className="text-xs font-medium text-[var(--muted-foreground)]">{GRINDER_DISPLAY_NAMES[grinder]}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">Range: {data.range}</p>
                          {data.note && (
                            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 italic">{data.note}</p>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-[var(--foreground)] shrink-0">{normalizeClickSetting(data.starting_point)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {/* Brew Steps */}
        <div>
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Brew Steps</h3>
            <div className="flex items-center gap-2">
              {(timerRunning || elapsedSeconds > 0) && (
                <span className={`text-sm font-mono font-semibold tabular-nums ${timerOverrun ? 'text-red-500' : 'text-[var(--foreground)]'}`}>
                  {formatElapsed(elapsedSeconds)}
                </span>
              )}
              <button
                onClick={timerRunning ? stopTimer : startTimer}
                className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center active:opacity-70"
                aria-label={timerRunning ? 'Stop timer' : 'Start timer'}
              >
                {timerRunning
                  ? <Square size={12} fill="currentColor" />
                  : <Play size={12} fill="currentColor" className="translate-x-px" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:gap-3">
            {recipe.steps.map((step, index) => {
              const isActive = activeStepIndex === index
              const isPast = activeStepIndex > index
              const progress = getStepProgress(index)
              return (
                <div
                  key={step.step}
                  className={`relative overflow-hidden rounded-2xl p-4 md:p-6 flex gap-3 transition-all duration-300 ${
                    ratioChanged() ? 'bg-amber-50' : 'bg-[var(--card)]'
                  } ${isActive ? 'ring-2 ring-[var(--foreground)] scale-[1.01]' : ''} ${isPast ? 'opacity-50' : ''}`}
                >
                  {/* Progress fill */}
                  {isActive && (
                    <div
                      className="absolute inset-0 bg-[var(--foreground)]/[0.06] pointer-events-none transition-[width] duration-1000 ease-linear rounded-2xl"
                      style={{ width: `${progress * 100}%` }}
                    />
                  )}
                  <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-xs font-bold shrink-0 relative">
                    {step.step}
                  </div>
                  <div className="flex-1 relative">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{step.time}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">+{step.water_poured_g}g → <span className="font-bold">{step.water_accumulated_g}g</span></p>
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{step.action}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Adjustments */}
        <Collapsible title="Quick Adjustments">
          <div className="flex flex-col gap-2.5">
            {Object.entries(recipe.quick_adjustments).map(([key, value]) => (
              <div key={key}>
                <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="text-sm text-[var(--foreground)] leading-relaxed">{value}</p>
              </div>
            ))}
          </div>
        </Collapsible>

        {/* Range Logic */}
        <Collapsible title="How was this calculated?">
          <div className="flex flex-col gap-2">
            {[
              ['Base Range', recipe.range_logic.base_range],
              ['Process Offset', recipe.range_logic.process_offset],
              ['Roast Offset', recipe.range_logic.roast_offset],
              ['Freshness Offset', recipe.range_logic.freshness_offset],
              ['Density Offset', recipe.range_logic.density_offset],
              ['Final Range', recipe.range_logic.final_operating_range],
              ['Starting Point', recipe.range_logic.starting_point],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <p className="text-[10px] text-[var(--muted-foreground)] shrink-0">{label}</p>
                <p className="text-[10px] text-[var(--foreground)] text-right">{value}</p>
              </div>
            ))}
            {recipe.range_logic.compressed && (
              <p className="text-[10px] text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg mt-1">
                Range was compressed to stay within the 10-click accumulation cap.
              </p>
            )}
          </div>
        </Collapsible>

        {/* ─── Feedback section ──────────────────────────────────────────────── */}

        {maxRoundsReached ? (
          /* Method switch nudge after 3 rounds */
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">This bean might work better with a different method</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-relaxed">
                You&apos;ve reached the 3-round adjustment limit. Sometimes the bean profile is better served by a different brewing approach.
              </p>
            </div>
            <button
              onClick={() => {
                // Navigate back to methods with the same bean data already in sessionStorage
                router.push('/methods')
              }}
              className="w-full flex items-center justify-center gap-2 bg-[var(--foreground)] text-[var(--background)] text-base font-semibold rounded-[12px] py-3 active:opacity-80"
            >
              Try a Different Method
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7H11M7.5 3.5L11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-[var(--muted-foreground)] underline text-center"
            >
              Reset recipe to original
            </button>
          </div>
        ) : !showFeedback ? (
          /* Feedback trigger */
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full flex items-center justify-center gap-2 bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] text-base font-medium rounded-[14px] py-3.5 active:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C11.87 15 15 11.87 15 8C15 4.13 11.87 1 8 1Z" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              How did it taste?
            </button>
            {feedbackRound > 0 && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-xs text-[var(--muted-foreground)] underline text-center"
              >
                Reset to original
              </button>
            )}
          </div>
        ) : (
          /* Symptom selector */
          <div className="bg-[var(--card)] rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--foreground)]">What was off?</p>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Round {feedbackRound + 1} of 3
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {SYMPTOM_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedSymptom(opt.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    selectedSymptom === opt.value
                      ? 'bg-[var(--foreground)] text-[var(--background)]'
                      : 'bg-[var(--background)] text-[var(--foreground)]'
                  }`}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>

            {adjustError && (
              <p className="text-sm text-red-500">{adjustError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowFeedback(false); setSelectedSymptom(null); setAdjustError(null) }}
                className="flex-1 py-3 rounded-[12px] text-base font-medium text-[var(--muted-foreground)] bg-[var(--background)] active:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                disabled={!selectedSymptom || adjusting}
                className="flex-1 py-3 rounded-[12px] text-base font-semibold text-[var(--background)] bg-[var(--foreground)] disabled:opacity-40 active:opacity-80 flex items-center justify-center gap-2"
              >
                {adjusting ? (
                  <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Adjust'
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Case A: leave without saving */}
      <ConfirmSheet
        open={showLeaveConfirm}
        title="Leave without saving?"
        message="Your recipe won't be added to your library."
        confirmLabel="Leave"
        destructive
        onConfirm={() => {
          if (pendingNavHref) {
            router.push(pendingNavHref)
          } else {
            router.back()
          }
          setPendingNavHref(null)
        }}
        onCancel={() => { setShowLeaveConfirm(false); setPendingNavHref(null) }}
      />

      {/* Case B: reset to original */}
      <ConfirmSheet
        open={showResetConfirm}
        title="Reset to original recipe?"
        message="This will discard all adjustments made in this session."
        confirmLabel="Reset"
        destructive
        onConfirm={() => { handleReset(); setShowResetConfirm(false) }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
