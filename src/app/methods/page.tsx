'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MethodRecommendation, MethodId, METHOD_DISPLAY_NAMES } from '@/types/recipe'
import { createManualRecipeDraft } from '@/lib/manual-recipe'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'

const METHOD_ICONS: Record<string, string> = {
  v60: '▽',
  origami: '◇',
  orea_v4: '□',
  hario_switch: '⊕',
  kalita_wave: '≋',
  chemex: '⌁',
  ceado_hoop: '○',
  pulsar: '⬡',
  aeropress: '⊙',
}

const ALL_METHODS = Object.keys(METHOD_DISPLAY_NAMES) as MethodId[]

const RANK_LABELS = ['Best Match', 'Great Choice', 'Also Try']
const RANK_COLORS = ['bg-[var(--foreground)] text-[var(--background)]', 'bg-[var(--surface-subtle)] text-[var(--foreground)]', 'bg-[var(--surface-subtle)] text-[var(--foreground)]']

export default function MethodsPage() {
  const router = useRouter()
  const [recommendations, setRecommendations] = useState<MethodRecommendation[]>([])
  const [selectedMethod, setSelectedMethod] = useState<MethodRecommendation | null>(null)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)

  useEffect(() => {
    const storedRecommendations = recipeSessionStorage.getMethodRecommendations()
    if (storedRecommendations.length === 0) { router.replace('/scan'); return }
    setRecommendations(storedRecommendations)

    const shouldRestoreSelection = recipeSessionStorage.shouldRestoreMethodSelection()
    recipeSessionStorage.clearRestoreMethodSelection()

    if (!shouldRestoreSelection) {
      setSelectedMethod(null)
      return
    }

    const storedSelection = recipeSessionStorage.getSelectedMethod<MethodRecommendation>()
    if (storedSelection?.method) {
      const matchedRecommendation = storedRecommendations.find(rec => rec.method === storedSelection.method)
      setSelectedMethod(matchedRecommendation ?? storedSelection)
    }
  }, [router])

  function buildManualSelection(method: MethodId, displayName: string): MethodRecommendation {
    return {
      method,
      displayName,
      rank: 0,
      score: 0,
      rationale: 'Manually selected — not in top recommendations for this bean.',
      reasonBadges: ['manual choice'],
      confidence: 'medium',
      confidenceNote: 'This brewer was selected manually instead of coming from the ranked recommendations.',
    }
  }

  function toggleMethod(method: MethodId, displayName: string, rec?: MethodRecommendation) {
    if (selecting) return

    if (selectedMethod?.method === method) {
      setSelectedMethod(null)
      return
    }

    setSelectedMethod(rec ?? buildManualSelection(method, displayName))
  }

  async function continueWithSelectedMethod() {
    if (!selectedMethod || selecting) return

    const flowSource = recipeSessionStorage.getRecipeFlowSource()
    const bean = recipeSessionStorage.getConfirmedBean()
    if (!bean) {
      router.replace(flowSource === 'manual' ? '/manual' : '/analysis')
      return
    }

    if (flowSource === 'manual') {
      recipeSessionStorage.setSelectedMethod(selectedMethod)
      recipeSessionStorage.setRestoreMethodSelection(true)
      recipeSessionStorage.setManualRecipeDraft(
        createManualRecipeDraft(bean, selectedMethod.method),
      )
      recipeSessionStorage.clearRecipe()
      recipeSessionStorage.clearRecipeOriginal()
      recipeSessionStorage.clearFeedbackRound()
      recipeSessionStorage.clearAdjustmentHistory()
      recipeSessionStorage.clearManualEditHistory()
      router.push('/recipe')
      return
    }

    setSelecting(selectedMethod.method)

    const targetVolumeMl = recipeSessionStorage.getTargetVolumeMl() ?? undefined

    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: selectedMethod.method, bean, targetVolumeMl }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Recipe generation failed')
      }

      const recipe = await res.json()
      recipeSessionStorage.setRecipe(recipe)
      recipeSessionStorage.setRecipeFlowSource('generated')
      recipeSessionStorage.clearManualRecipeDraft()
      recipeSessionStorage.clearRecipeOriginal()
      recipeSessionStorage.clearFeedbackRound()
      recipeSessionStorage.clearAdjustmentHistory()
      recipeSessionStorage.setSelectedMethod(selectedMethod)
      recipeSessionStorage.setRestoreMethodSelection(true)
      router.push('/recipe')
    } catch (err) {
      console.error(err)
      setSelecting(null)
      alert(err instanceof Error ? err.message : 'Failed to generate recipe')
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const recommendedIds = new Set(recommendations.map(r => r.method))
  const otherMethods = ALL_METHODS.filter(m => !recommendedIds.has(m))
  const recommendationConfidence = recommendations[0]?.confidence ?? 'high'
  const confidenceNote = recommendations[0]?.confidenceNote

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      <div className="flex items-center gap-3 px-4 pb-4">
        <button onClick={() => router.back()} className="min-h-10 min-w-10 p-2 -ml-2 flex items-center justify-center" aria-label="Go back">
          <svg className="ui-icon-action" viewBox="0 0 20 20" fill="none">
            <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="ui-section-title">Brew Methods</h2>
      </div>

      <p className="px-4 ui-body-muted mb-4">
        {recommendationConfidence === 'low'
          ? 'The bag details are a little uncertain, so these are safer starting points:'
          : 'Based on your bean profile, here are the best brewing methods:'}
      </p>

      {confidenceNote && (
        <div className="mx-4 mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <p className="ui-meta leading-relaxed">{confidenceNote}</p>
        </div>
      )}

      <div className="px-4 flex flex-col gap-3 pb-[calc(env(safe-area-inset-bottom)+14rem)] sm:pb-52 lg:pb-44">
        {recommendations.map((rec, i) => (
          <button
            key={rec.method}
            type="button"
            onClick={() => toggleMethod(rec.method, rec.displayName, rec)}
            disabled={selecting !== null}
            aria-pressed={selectedMethod?.method === rec.method}
            className={`w-full rounded-2xl p-4 text-left flex active:scale-[0.98] transition-all disabled:opacity-60 relative overflow-hidden border ${
              selectedMethod?.method === rec.method
                ? 'bg-[var(--surface-subtle)] border-[var(--foreground)] shadow-[0_0_0_1px_var(--foreground)]'
                : 'bg-[var(--card)] border-transparent'
            }`}
          >
            {selecting === rec.method && (
              <div className="absolute inset-0 bg-[var(--card)]/80 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <div className="flex-1 flex flex-col gap-2">
              <span className={`self-start ui-badge px-2.5 ${RANK_COLORS[i]}`}>
                {RANK_LABELS[i]}
              </span>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{METHOD_ICONS[rec.method] || '☕'}</span>
                  <span className="ui-card-title">{rec.displayName}</span>
                </div>
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    selectedMethod?.method === rec.method
                      ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                      : 'border-[var(--border)] text-transparent'
                  }`}
                  aria-hidden="true"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <p className="ui-meta leading-relaxed">{rec.rationale}</p>

              {rec.reasonBadges.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {rec.reasonBadges.map(reason => (
                    <span key={`${rec.method}-${reason}`} className="ui-chip ui-chip-unselected capitalize">
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}

        {/* Other Methods */}
        <button
          type="button"
          onClick={() => setShowOthers(v => !v)}
          className="w-full mt-1 flex items-center justify-between px-1 py-2 ui-body-muted active:opacity-60 transition-opacity"
        >
          <span>Other methods</span>
          <svg
            className={`ui-icon-inline transition-transform ${showOthers ? 'rotate-90' : ''}`}
            viewBox="0 0 16 16" fill="none"
          >
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showOthers && (
          <>
            <div className="ui-alert-warning flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <p className="ui-body-muted ui-text-warning leading-relaxed">
                These methods are not recommended for this bean. Results may be unexpected.
              </p>
            </div>

            {otherMethods.map(methodId => (
              <button
                key={methodId}
                type="button"
                onClick={() => toggleMethod(methodId, METHOD_DISPLAY_NAMES[methodId])}
                disabled={selecting !== null}
                aria-pressed={selectedMethod?.method === methodId}
                className={`w-full rounded-2xl p-4 text-left flex items-center gap-4 active:scale-[0.98] transition-all disabled:opacity-60 relative overflow-hidden border ${
                  selectedMethod?.method === methodId
                    ? 'bg-[var(--surface-subtle)] border-[var(--foreground)] shadow-[0_0_0_1px_var(--foreground)]'
                    : 'bg-[var(--card)] border-[var(--border)]'
                }`}
              >
                {selecting === methodId && (
                  <div className="absolute inset-0 bg-[var(--card)]/80 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <span className="text-xl">{METHOD_ICONS[methodId] || '☕'}</span>
                <span className="flex-1 ui-card-title">{METHOD_DISPLAY_NAMES[methodId]}</span>

                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    selectedMethod?.method === methodId
                      ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                      : 'border-[var(--border)] text-transparent'
                  }`}
                  aria-hidden="true"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="ui-sticky-footer fixed bottom-0 left-0 right-0 lg:left-56 pt-4 pb-24 lg:pb-6">
        <div className="w-full px-4 md:max-w-2xl md:mx-auto md:px-8 lg:max-w-3xl xl:max-w-5xl xl:px-8">
          <div className="mb-3 px-1 ui-meta">
            {selectedMethod
              ? `Selected: ${selectedMethod.displayName}`
              : 'Select a brewing method before continuing.'}
          </div>
          <button
            type="button"
            onClick={continueWithSelectedMethod}
            disabled={!selectedMethod || selecting !== null}
            className="w-full ui-button-primary font-semibold disabled:opacity-50"
          >
            {selecting ? (
              <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="ui-icon-action" viewBox="0 0 20 20" fill="none">
                <path d="M4 10H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M11 5L16 10L11 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {selectedMethod ? `Continue with ${selectedMethod.displayName}` : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
