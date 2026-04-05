'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { SavedRecipe, METHOD_DISPLAY_NAMES, MethodId, GrinderId, GRINDER_DISPLAY_NAMES } from '@/types/recipe'
import { recalculateFreshness, FreshnessAdjustment } from '@/lib/freshness-recalculator'
import { migrateRecipe } from '@/lib/recipe-migrations'
import { useProfile } from '@/hooks/useProfile'

export default function SavedRecipeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [recipe, setRecipe] = useState<SavedRecipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [freshnessAdj, setFreshnessAdj] = useState<FreshnessAdjustment | null>(null)
  const [freshnessIgnored, setFreshnessIgnored] = useState(false)
  const { preferredGrinder } = useProfile()

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then(async r => {
        if (!r.ok) {
          if (r.status === 401) { router.replace('/auth?returnTo=/recipes'); return }
          throw new Error('Not found')
        }
        return r.json()
      })
      .then((data: SavedRecipe) => {
        const migrated = migrateRecipe(data.current_recipe_json, data.schema_version)
        const hydratedData = { ...data, current_recipe_json: migrated }
        setRecipe(hydratedData)
        // Pre-compute freshness adjustment
        const adj = recalculateFreshness(migrated, data.bean_info.roast_date ?? undefined)
        if (adj.adjusted) setFreshnessAdj(adj)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, router])

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    router.replace('/recipes')
  }

  function handleBrewAgain() {
    if (!recipe) return
    const migrated = migrateRecipe(recipe.current_recipe_json, recipe.schema_version)
    const finalRecipe = freshnessAdj && !freshnessIgnored ? freshnessAdj.adjustedRecipe : migrated

    sessionStorage.setItem('recipe', JSON.stringify(finalRecipe))
    sessionStorage.setItem('recipe_original', JSON.stringify(recipe.original_recipe_json))
    sessionStorage.setItem('confirmedBean', JSON.stringify(recipe.bean_info))
    sessionStorage.setItem('feedback_round', '0')
    sessionStorage.setItem('adjustment_history', JSON.stringify(recipe.feedback_history ?? []))
    sessionStorage.setItem('rebrew_recipe_id', id) // track which saved recipe we're re-brewing
    router.push('/recipe')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-6 gap-4">
        <p className="text-sm text-[#6B6B6B]">{error ?? 'Recipe not found.'}</p>
        <button onClick={() => router.replace('/recipes')} className="text-sm text-[#333333] underline">
          Back to recipes
        </button>
      </div>
    )
  }

  const displayName = METHOD_DISPLAY_NAMES[recipe.method as MethodId] ?? recipe.method
  const beanName = recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Unknown bean'
  const r = recipe.current_recipe_json

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold">Saved Recipe</h2>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 text-red-400"
          aria-label="Delete recipe"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 5H15M6 5V3.5C6 3.22 6.22 3 6.5 3H11.5C11.78 3 12 3.22 12 3.5V5M7 8.5V13M11 8.5V13M4.5 5L5.5 15H12.5L13.5 5H4.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-4 pb-24 overflow-y-auto">

        {/* Bag photo */}
        {recipe.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.image_url}
            alt={beanName}
            className="w-full aspect-[4/3] rounded-2xl object-cover"
          />
        )}

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#333333]">{displayName}</h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5">{beanName}</p>
          {recipe.bean_info.roaster && (
            <p className="text-xs text-[#9CA3AF] mt-0.5">{recipe.bean_info.roaster}</p>
          )}
          <p className="text-xs text-[#9CA3AF] mt-1">
            Saved {new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Freshness notice */}
        {freshnessAdj && !freshnessIgnored && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-2">
            <p className="text-xs font-semibold text-amber-700">Freshness updated</p>
            <p className="text-xs text-amber-800">
              This coffee is now {freshnessAdj.daysPostRoast} days post-roast ({freshnessAdj.freshnessLabel}).
              Recipe adjusted for freshness.
            </p>
            {freshnessAdj.changedFields.map(cf => (
              <p key={cf.field} className="text-[10px] text-amber-600">
                {cf.field}: {cf.previous} → {cf.next}
              </p>
            ))}
            <button
              onClick={() => setFreshnessIgnored(true)}
              className="text-[10px] text-amber-700 underline self-start"
            >
              Keep original recipe
            </button>
          </div>
        )}

        {/* Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-2">Parameters</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: `${r.parameters.water_g}ml`, label: 'Water' },
              { value: `${r.parameters.coffee_g}g`, label: 'Coffee' },
              { value: `${r.parameters.temperature_c}°C`, label: 'Temp' },
              { value: r.parameters.total_time, label: 'Time' },
              { value: r.grind[preferredGrinder].starting_point, label: 'Grind' },
              { value: r.parameters.ratio, label: 'Ratio' },
            ].map(p => (
              <div key={p.label} className="rounded-xl p-3 flex flex-col items-start gap-1 bg-[#F5F4F2]">
                <p className="text-sm font-semibold text-[#333333]">{p.value}</p>
                <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{p.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Grinder Settings */}
        {(() => {
          const secondaryGrinders = (['k_ultra', 'q_air', 'baratza_encore_esp', 'timemore_c2'] as GrinderId[]).filter(g => g !== preferredGrinder)
          const primaryData = r.grind[preferredGrinder]
          return (
            <div className="bg-white rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">Grind Settings</h3>

              {/* Primary grinder */}
              <div className="rounded-xl p-3 mb-3 bg-[#333333] text-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white/70">{GRINDER_DISPLAY_NAMES[preferredGrinder]}</span>
                  <span className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full">Primary</span>
                </div>
                <p className="text-lg font-bold">{primaryData.starting_point}</p>
                <p className="text-xs text-white/60 mt-0.5">Range: {primaryData.range}</p>
                {primaryData.description && (
                  <p className="text-xs text-white/50 mt-1 italic">{primaryData.description}</p>
                )}
                {primaryData.note && (
                  <p className="text-xs text-white/50 mt-1 italic">{primaryData.note}</p>
                )}
              </div>

              {/* Secondary grinders */}
              {secondaryGrinders.map((grinder, i) => {
                const data = r.grind[grinder]
                const isLast = i === secondaryGrinders.length - 1
                return (
                  <div key={grinder} className={`flex items-start justify-between py-2.5 gap-3 ${isLast ? '' : 'border-b border-[#F0EDE9]'}`}>
                    <div>
                      <p className="text-xs font-medium text-[#6B6B6B]">{GRINDER_DISPLAY_NAMES[grinder]}</p>
                      <p className="text-xs text-[#9CA3AF]">Range: {data.range}</p>
                      {data.note && (
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5 italic">{data.note}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#333333] shrink-0">{data.starting_point}</p>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Brew steps */}
        <div>
          <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-2">Brew Steps</h3>
          <div className="flex flex-col gap-2">
            {r.steps.map(step => (
              <div key={step.step} className="rounded-2xl p-4 flex gap-3 bg-white">
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

        {/* Feedback history */}
        {recipe.feedback_history.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-2">Adjustment History</h3>
            <div className="flex flex-col gap-2">
              {recipe.feedback_history.map((fh, i) => (
                <div key={i} className="bg-white rounded-xl px-4 py-2.5 text-xs text-[#6B6B6B]">
                  <span className="font-medium text-[#333333]">Round {fh.round}</span>
                  {' · '}
                  {fh.variable_changed}: {fh.previous_value} → {fh.new_value}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={handleBrewAgain}
          className="w-full flex items-center justify-center gap-2 bg-[#333333] text-white text-sm font-semibold rounded-[14px] py-4 active:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2.5 8C2.5 4.96 4.96 2.5 8 2.5C10.07 2.5 11.87 3.6 12.85 5.25M13.5 8C13.5 11.04 11.04 13.5 8 13.5C5.93 13.5 4.13 12.4 3.15 10.75" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M12 3V6H15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 10V13H4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Brew Again
        </button>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-safe">
          <div className="bg-white rounded-t-3xl w-full max-w-sm px-6 pt-6 pb-10">
            <h3 className="text-base font-semibold text-[#333333] mb-1">Delete this recipe?</h3>
            <p className="text-sm text-[#6B6B6B] mb-6">This action cannot be undone.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-3.5 bg-red-500 text-white text-sm font-semibold rounded-[14px] active:opacity-80 disabled:opacity-50 flex items-center justify-center"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : 'Delete Recipe'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-3.5 bg-[#F5F4F2] text-[#333333] text-sm font-medium rounded-[14px] active:opacity-80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
