'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MethodRecommendation } from '@/types/recipe'

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

const RANK_LABELS = ['Best Match', 'Great Choice', 'Also Try']
const RANK_COLORS = ['bg-[#333333] text-white', 'bg-[#E5E3DF] text-[#333333]', 'bg-[#E5E3DF] text-[#333333]']

export default function MethodsPage() {
  const router = useRouter()
  const [recommendations, setRecommendations] = useState<MethodRecommendation[]>([])
  const [selecting, setSelecting] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('methodRecommendations')
    if (!raw) { router.replace('/scan'); return }
    setRecommendations(JSON.parse(raw))
  }, [router])

  async function selectMethod(rec: MethodRecommendation) {
    if (selecting) return
    setSelecting(rec.method)

    const beanRaw = sessionStorage.getItem('confirmedBean')
    if (!beanRaw) { router.replace('/analysis'); return }

    const bean = JSON.parse(beanRaw)

    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: rec.method, bean }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Recipe generation failed')
      }

      const recipe = await res.json()
      sessionStorage.setItem('recipe', JSON.stringify(recipe))
      sessionStorage.setItem('selectedMethod', JSON.stringify(rec))
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
        <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      <div className="flex items-center gap-3 px-4 pb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 15L7 10L12 5" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">Brew Methods</h2>
      </div>

      <p className="px-4 text-sm text-[#6B6B6B] mb-4">
        Based on your bean profile, here are the best brewing methods:
      </p>

      <div className="px-4 flex flex-col gap-3 pb-24">
        {recommendations.map((rec, i) => (
          <button
            key={rec.method}
            onClick={() => selectMethod(rec)}
            disabled={selecting !== null}
            className="w-full bg-white rounded-2xl p-4 text-left flex items-start gap-4 active:scale-[0.98] transition-transform disabled:opacity-60 relative overflow-hidden"
          >
            {selecting === rec.method && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Rank badge */}
            <span className={`shrink-0 mt-0.5 px-2.5 py-1 rounded-full text-xs font-semibold ${RANK_COLORS[i]}`}>
              {RANK_LABELS[i]}
            </span>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{METHOD_ICONS[rec.method] || '☕'}</span>
                <span className="font-semibold text-[#333333] text-sm">{rec.displayName}</span>
              </div>
              <p className="text-xs text-[#6B6B6B] leading-relaxed">{rec.rationale}</p>
            </div>

            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-1 shrink-0">
              <path d="M6 4L10 8L6 12" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
