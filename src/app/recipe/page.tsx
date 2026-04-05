'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Recipe, RecipeWithAdjustment, Symptom, AdjustmentMetadata } from '@/types/recipe'
import { useAuth } from '@/hooks/useAuth'

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
      changed ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-[#F5F4F2]'
    }`}>
      <div className="text-[#6B6B6B]">{icon}</div>
      <p className="text-sm font-semibold text-[#333333]">{value}</p>
      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{label}</p>
      {changed && annotation && (
        <p className="text-[9px] text-amber-600 font-medium leading-tight">{annotation}</p>
      )}
    </div>
  )
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-[#333333]">{title}</span>
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

  const [recipe, setRecipe] = useState<RecipeWithAdjustment | null>(null)
  const [originalRecipe, setOriginalRecipe] = useState<Recipe | null>(null)
  const [feedbackRound, setFeedbackRound] = useState(0)
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentMetadata[]>([])

  // Save state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Feedback UI state
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('recipe')
    if (!raw) { router.replace('/'); return }
    const parsed: RecipeWithAdjustment = JSON.parse(raw)
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
  }, [router])

  async function handleSave() {
    if (!recipe || !originalRecipe || saving || saved) return

    const beanRawInner = typeof window !== 'undefined' ? sessionStorage.getItem('confirmedBean') : null
    const beanInner = beanRawInner ? JSON.parse(beanRawInner) : {}

    const payload = {
      bean_info: beanInner,
      method: recipe.method,
      original_recipe_json: originalRecipe,
      current_recipe_json: recipe,
      feedback_history: adjustmentHistory.map((a, i) => ({
        round: i + 1,
        symptom: a.symptom,
        variable_changed: a.variable_changed,
        previous_value: a.previous_value,
        new_value: a.new_value,
      })),
    }

    if (!user) {
      // Guest: hold payload and redirect to auth
      sessionStorage.setItem('pending_save_recipe', JSON.stringify(payload))
      router.push(`/auth?returnTo=/recipe&pendingRecipe=true`)
      return
    }

    setSaving(true)
    setSaveError(null)
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
      setSaved(true)
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
    setRecipe(originalRecipe)
    setFeedbackRound(0)
    setAdjustmentHistory([])
    setShowFeedback(false)
    setSelectedSymptom(null)
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
        body: JSON.stringify({ current_recipe: recipe, symptom: selectedSymptom, round: nextRound }),
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
        <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold">Your Recipe</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="p-2 text-[#333333] disabled:opacity-50 relative"
          aria-label="Save recipe"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 2H15C15.55 2 16 2.45 16 3V18L10 15L4 18V3C4 2.45 4.45 2 5 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill={saved ? 'currentColor' : 'none'}
              />
            </svg>
          )}
        </button>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-4 pb-24 overflow-y-auto">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#333333]">{recipe.display_name}</h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5">
            {bean.bean_name || 'Your Coffee'}{bean.roast_level ? ` · ${bean.roast_level.charAt(0).toUpperCase() + bean.roast_level.slice(1)} Roast` : ''}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">{recipe.objective}</p>
        </div>

        {/* Save feedback */}
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-xs font-medium text-green-800">
            Recipe saved to your library.
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
            {saveError}
          </div>
        )}

        {/* Adjustment banner */}
        {adj && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-700">Adjustment {feedbackRound} of 3</p>
              <button
                onClick={handleReset}
                className="text-[10px] text-[#6B6B6B] underline"
              >
                Reset to original
              </button>
            </div>
            <p className="text-xs text-amber-800">
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
          <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-2">Parameters</h3>
          <div className="grid grid-cols-3 gap-2">
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2C5.79 2 4 3.79 4 6C4 8.21 5.79 10 8 10H12V14H4V12H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={`${recipe.parameters.water_g}ml`}
              label="Water"
              changed={ratioChanged()}
              annotation={annotation('ratio')}
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="11" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M8 2V5M6 8H4M12 8H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={`${recipe.parameters.coffee_g}g`}
              label="Coffee"
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V6M8 6C6.34 6 5 7.34 5 9C5 10.66 6.34 12 8 12C9.66 12 11 10.66 11 9C11 7.34 9.66 6 8 6Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={`${recipe.parameters.temperature_c}°C`}
              label="Temp"
              changed={tempChanged()}
              annotation={annotation('temp')}
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8 5V8L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={recipe.parameters.total_time}
              label="Brew Time"
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 12L8 4L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 9H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={recipe.grind.k_ultra.starting_point}
              label="Grind"
              changed={grindChanged()}
              annotation={annotation('grind')}
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M8 3V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={recipe.parameters.ratio}
              label="Ratio"
              changed={ratioChanged()}
            />
          </div>
        </div>

        {/* Grinder Settings */}
        <div className={`bg-white rounded-2xl p-4 ${grindChanged() ? 'ring-1 ring-amber-200' : ''}`}>
          <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">Grind Settings</h3>

          {/* K-Ultra primary */}
          <div className={`rounded-xl p-3 mb-3 text-white ${grindChanged() ? 'bg-amber-700' : 'bg-[#333333]'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white/70">1Zpresso K-Ultra</span>
              <span className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full">Primary</span>
            </div>
            <p className="text-lg font-bold">{recipe.grind.k_ultra.starting_point}</p>
            <p className="text-xs text-white/60 mt-0.5">Range: {recipe.grind.k_ultra.range}</p>
            {grindChanged() && adj && (
              <p className="text-xs text-white/80 mt-1 font-medium">{adj.previous_value} → {adj.new_value}</p>
            )}
            {recipe.grind.k_ultra.description && (
              <p className="text-xs text-white/50 mt-1 italic">{recipe.grind.k_ultra.description}</p>
            )}
          </div>

          {/* Q-Air */}
          <div className="flex items-center justify-between py-2.5 border-b border-[#F0EDE9]">
            <div>
              <p className="text-xs font-medium text-[#6B6B6B]">1Zpresso Q-Air</p>
              <p className="text-xs text-[#9CA3AF]">Range: {recipe.grind.q_air.range}</p>
            </div>
            <p className="text-sm font-semibold text-[#333333]">{recipe.grind.q_air.starting_point}</p>
          </div>

          {/* Baratza */}
          <div className="flex items-start justify-between py-2.5 gap-3">
            <div>
              <p className="text-xs font-medium text-[#6B6B6B]">Baratza Encore ESP</p>
              <p className="text-xs text-[#9CA3AF]">Range: {recipe.grind.baratza_encore_esp.range}</p>
              {recipe.grind.baratza_encore_esp.note && (
                <p className="text-[10px] text-[#9CA3AF] mt-0.5 italic">{recipe.grind.baratza_encore_esp.note}</p>
              )}
            </div>
            <p className="text-sm font-semibold text-[#333333] shrink-0">{recipe.grind.baratza_encore_esp.starting_point}</p>
          </div>
        </div>

        {/* Brew Steps */}
        <div>
          <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-2">Brew Steps</h3>
          <div className="flex flex-col gap-2">
            {recipe.steps.map(step => (
              <div key={step.step} className={`rounded-2xl p-4 flex gap-3 ${ratioChanged() ? 'bg-amber-50' : 'bg-white'}`}>
                <div className="w-7 h-7 rounded-full bg-[#333333] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {step.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-[#333333]">{step.time}</p>
                    <p className="text-[10px] text-[#9CA3AF]">+{step.water_poured_g}g → {step.water_accumulated_g}g</p>
                  </div>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">{step.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Adjustments */}
        <Collapsible title="Quick Adjustments">
          <div className="flex flex-col gap-2.5">
            {Object.entries(recipe.quick_adjustments).map(([key, value]) => (
              <div key={key}>
                <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-0.5">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-[#333333] leading-relaxed">{value}</p>
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
                <p className="text-[10px] text-[#9CA3AF] shrink-0">{label}</p>
                <p className="text-[10px] text-[#333333] text-right">{value}</p>
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
          <div className="bg-white border border-[#E1E2E5] rounded-2xl p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-[#333333]">This bean might work better with a different method</p>
              <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                You&apos;ve reached the 3-round adjustment limit. Sometimes the bean profile is better served by a different brewing approach.
              </p>
            </div>
            <button
              onClick={() => {
                // Navigate back to methods with the same bean data already in sessionStorage
                router.push('/methods')
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#333333] text-white text-sm font-semibold rounded-[12px] py-3 active:opacity-80"
            >
              Try a Different Method
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7H11M7.5 3.5L11 7L7.5 10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={handleReset}
              className="text-xs text-[#6B6B6B] underline text-center"
            >
              Reset recipe to original
            </button>
          </div>
        ) : !showFeedback ? (
          /* Feedback trigger */
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-[#E1E2E5] text-[#333333] text-sm font-medium rounded-[14px] py-3.5 active:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C11.87 15 15 11.87 15 8C15 4.13 11.87 1 8 1Z" stroke="#333333" strokeWidth="1.3"/>
                <path d="M8 5V8M8 11H8.01" stroke="#333333" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              How did it taste?
            </button>
            {feedbackRound > 0 && (
              <button
                onClick={handleReset}
                className="text-xs text-[#9CA3AF] underline text-center"
              >
                Reset to original
              </button>
            )}
          </div>
        ) : (
          /* Symptom selector */
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#333333]">What was off?</p>
              <p className="text-[10px] text-[#9CA3AF]">
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
                      ? 'bg-[#333333] text-white'
                      : 'bg-[#F5F4F2] text-[#333333]'
                  }`}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>

            {adjustError && (
              <p className="text-xs text-red-500">{adjustError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowFeedback(false); setSelectedSymptom(null); setAdjustError(null) }}
                className="flex-1 py-3 rounded-[12px] text-sm font-medium text-[#6B6B6B] bg-[#F5F4F2] active:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                disabled={!selectedSymptom || adjusting}
                className="flex-1 py-3 rounded-[12px] text-sm font-semibold text-white bg-[#333333] disabled:opacity-40 active:opacity-80 flex items-center justify-center gap-2"
              >
                {adjusting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Adjust'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
