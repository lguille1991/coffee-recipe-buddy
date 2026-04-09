'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MethodRecommendation, MethodId, METHOD_DISPLAY_NAMES } from '@/types/recipe'
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
  const [selecting, setSelecting] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)

  useEffect(() => {
    const storedRecommendations = recipeSessionStorage.getMethodRecommendations()
    if (storedRecommendations.length === 0) { router.replace('/scan'); return }
    setRecommendations(storedRecommendations)
  }, [router])

  async function selectMethod(method: string, displayName: string, rec?: MethodRecommendation) {
    if (selecting) return
    setSelecting(method)

    const bean = recipeSessionStorage.getConfirmedBean()
    if (!bean) { router.replace('/analysis'); return }

    const targetVolumeMl = recipeSessionStorage.getTargetVolumeMl() ?? undefined

    const storedRec: MethodRecommendation = rec ?? {
      method: method as MethodId,
      displayName,
      rank: 0,
      score: 0,
      rationale: 'Manually selected — not in top recommendations for this bean.',
    }

    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, bean, targetVolumeMl }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Recipe generation failed')
      }

      const recipe = await res.json()
      recipeSessionStorage.setRecipe(recipe)
      recipeSessionStorage.clearRecipeOriginal()
      recipeSessionStorage.clearFeedbackRound()
      recipeSessionStorage.clearAdjustmentHistory()
      recipeSessionStorage.setSelectedMethod(storedRec)
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
        Based on your bean profile, here are the best brewing methods:
      </p>

      <div className="px-4 flex flex-col gap-3 pb-24">
        {recommendations.map((rec, i) => (
          <button
            key={rec.method}
            onClick={() => selectMethod(rec.method, rec.displayName, rec)}
            disabled={selecting !== null}
            className="w-full bg-[var(--card)] rounded-2xl p-4 text-left flex active:scale-[0.98] transition-transform disabled:opacity-60 relative overflow-hidden"
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
                <svg className="ui-icon-inline shrink-0 text-[var(--muted-foreground)]" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <p className="ui-meta leading-relaxed">{rec.rationale}</p>
            </div>
          </button>
        ))}

        {/* Other Methods */}
        <button
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
                onClick={() => selectMethod(methodId, METHOD_DISPLAY_NAMES[methodId])}
                disabled={selecting !== null}
                className="w-full bg-[var(--card)] rounded-2xl p-4 text-left flex items-center gap-4 active:scale-[0.98] transition-transform disabled:opacity-60 relative overflow-hidden border border-[var(--border)]"
              >
                {selecting === methodId && (
                  <div className="absolute inset-0 bg-[var(--card)]/80 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <span className="text-xl">{METHOD_ICONS[methodId] || '☕'}</span>
                <span className="flex-1 ui-card-title">{METHOD_DISPLAY_NAMES[methodId]}</span>

                <svg className="ui-icon-inline shrink-0 text-[var(--muted-foreground)]" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
