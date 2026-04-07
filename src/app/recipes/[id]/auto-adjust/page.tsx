'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Recipe, SavedRecipe, ManualEditRound, METHOD_DISPLAY_NAMES, MethodId } from '@/types/recipe'
import { migrateRecipe } from '@/lib/recipe-migrations'
import { useProfile } from '@/hooks/useProfile'
import ConfirmSheet from '@/components/ConfirmSheet'
import { CURRENT_SCHEMA_VERSION } from '@/lib/recipe-migrations'

const SCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: '½×' },
  { value: 0.75, label: '¾×' },
  { value: 1.0, label: '1×' },
  { value: 1.25, label: '1¼×' },
  { value: 1.5, label: '1½×' },
  { value: 2.0, label: '2×' },
]

function normalizeClickSetting(value: string): string {
  return value.replace(/^clicks?\s+(\d+)$/i, '$1 clicks')
}

export default function AutoAdjustPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { profile } = useProfile()
  const tempUnit = profile?.temp_unit ?? 'C'

  const [sourceRecipe, setSourceRecipe] = useState<SavedRecipe | null>(null)
  const [loadingSource, setLoadingSource] = useState(true)

  const [scaleFactor, setScaleFactor] = useState(1.0)
  const [intent, setIntent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<Recipe | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then(async r => {
        if (!r.ok) {
          if (r.status === 401) router.replace('/auth?returnTo=/recipes')
          return null
        }
        return r.json()
      })
      .then((data: SavedRecipe | null) => {
        if (data) {
          const migrated = migrateRecipe(data.current_recipe_json, data.schema_version)
          setSourceRecipe({ ...data, current_recipe_json: migrated })
        }
      })
      .finally(() => setLoadingSource(false))
  }, [id, router])

  const canGenerate = !(scaleFactor === 1.0 && intent.trim() === '')

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/recipes/${id}/auto-adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scale_factor: scaleFactor, intent: intent.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Generation failed')
      }
      setResult(data.recipe)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveAsNew() {
    if (!result || !sourceRecipe) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: result.method,
          bean_info: sourceRecipe.bean_info,
          original_recipe_json: result,
          current_recipe_json: result,
          feedback_history: [],
          parent_recipe_id: id,
          scale_factor: scaleFactor,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      router.replace(`/recipes/${data.id}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  async function handleReplace() {
    if (!result || !sourceRecipe) return
    setSaving(true)
    setSaveError(null)
    try {
      const allHistory = (sourceRecipe.feedback_history ?? []) as ManualEditRound[]
      const existingEdits = allHistory.filter(h => 'type' in h && (h.type === 'manual_edit' || h.type === 'auto_adjust'))
      const newRound: ManualEditRound = {
        type: 'auto_adjust',
        version: existingEdits.length + 1,
        edited_at: new Date().toISOString(),
        changes: [{ field: 'recipe', previous_value: 'previous version', new_value: `auto-adjusted (${scaleFactor}×)` }],
      }
      const res = await fetch(`/api/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_recipe_json: result,
          feedback_history: [...(sourceRecipe.feedback_history ?? []), newRound],
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      router.replace(`/recipes/${id}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  if (loadingSource) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!sourceRecipe) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-6 gap-4">
        <p className="text-sm text-[var(--muted-foreground)]">Recipe not found.</p>
        <button onClick={() => router.replace('/recipes')} className="text-sm text-[var(--foreground)] underline">Back to recipes</button>
      </div>
    )
  }

  const displayName = METHOD_DISPLAY_NAMES[sourceRecipe.method as MethodId] ?? sourceRecipe.method
  const beanName = sourceRecipe.bean_info.bean_name ?? sourceRecipe.bean_info.origin ?? 'Unknown bean'

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">Auto Adjust</h2>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5 pb-8 overflow-y-auto">

        {/* Source recipe summary */}
        <div className="flex items-center gap-2 bg-[var(--card)] rounded-xl px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--foreground)] truncate">{beanName}</p>
            <p className="text-[10px] text-[#9CA3AF]">{displayName}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-[var(--muted-foreground)]">
              {sourceRecipe.current_recipe_json.parameters.coffee_g}g · {sourceRecipe.current_recipe_json.parameters.water_g}ml
            </p>
          </div>
        </div>

        {/* Scale selector */}
        <div>
          <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Scale</p>
          <div className="flex gap-1.5 flex-wrap">
            {SCALE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setScaleFactor(opt.value)}
                className={`flex-1 min-w-0 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  scaleFactor === opt.value
                    ? 'bg-[var(--foreground)] text-[var(--background)]'
                    : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {scaleFactor !== 1.0 && (
            <p className="text-[10px] text-[#9CA3AF] mt-1.5">
              {Math.round(sourceRecipe.current_recipe_json.parameters.coffee_g * scaleFactor * 10) / 10}g coffee ·{' '}
              {Math.round(sourceRecipe.current_recipe_json.parameters.water_g * scaleFactor)}ml water
            </p>
          )}
        </div>

        {/* Intent field */}
        <div>
          <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Intent (optional)</p>
          <textarea
            value={intent}
            onChange={e => setIntent(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. Make it sweeter and rounder, slightly coarser grind for a lazy morning…"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
          />
          <p className="text-[10px] text-[#9CA3AF] text-right mt-1">{intent.length}/500</p>
        </div>

        {/* Disabled hint */}
        {!canGenerate && (
          <p className="text-xs text-[#9CA3AF] text-center -mt-2">Change the scale or describe what you&apos;d like to adjust</p>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold rounded-[14px] active:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L9.5 6H14L10.5 8.5L12 12.5L8 10L4 12.5L5.5 8.5L2 6H6.5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Generate
            </>
          )}
        </button>

        {/* Generation error */}
        {genError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
            {genError}
          </div>
        )}

        {/* Result preview */}
        {result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Result</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: `${result.parameters.water_g}ml`, label: 'Water' },
                { value: `${result.parameters.coffee_g}g`, label: 'Coffee' },
                { value: tempUnit === 'F' ? `${Math.round(result.parameters.temperature_c * 9 / 5 + 32)}°F` : `${result.parameters.temperature_c}°C`, label: 'Temp' },
                { value: result.parameters.total_time, label: 'Time' },
                { value: normalizeClickSetting(result.grind.k_ultra.starting_point), label: 'Grind (K-Ultra)' },
                { value: result.parameters.ratio, label: 'Ratio' },
              ].map(p => (
                <div key={p.label} className="rounded-xl p-3 flex flex-col items-start gap-1 bg-[var(--card)]">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{p.value}</p>
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider leading-tight">{p.label}</p>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-2">
              {result.steps.map(step => (
                <div key={step.step} className="rounded-2xl p-4 flex gap-3 bg-[var(--card)]">
                  <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-xs font-bold shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-[var(--foreground)]">{step.time}</p>
                      <p className="text-[10px] text-[#9CA3AF]">+{step.water_poured_g}g → {step.water_accumulated_g}g</p>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{step.action}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Save error */}
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
                {saveError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pb-4">
              <button
                onClick={handleSaveAsNew}
                disabled={saving}
                className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold rounded-[14px] active:opacity-80 disabled:opacity-50 flex items-center justify-center"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                ) : 'Save as New Recipe'}
              </button>
              <button
                onClick={() => setShowReplaceConfirm(true)}
                disabled={saving}
                className="w-full py-3.5 bg-[var(--card)] text-[var(--foreground)] text-sm font-medium rounded-[14px] border border-[var(--border)] active:opacity-80 disabled:opacity-50"
              >
                Replace This Recipe
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || saving}
                className="w-full py-3 text-[var(--muted-foreground)] text-sm font-medium active:opacity-60 disabled:opacity-40"
              >
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmSheet
        open={showReplaceConfirm}
        title="Replace recipe?"
        message="This will overwrite the current version of this recipe. The change will be recorded in Edit History."
        confirmLabel="Replace"
        destructive
        loading={saving}
        onConfirm={handleReplace}
        onCancel={() => setShowReplaceConfirm(false)}
      />
    </div>
  )
}
