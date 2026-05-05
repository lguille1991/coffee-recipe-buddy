'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'
import { formatGrinderSettingForDisplay } from '@/lib/grinder-converter'
import { useProfile } from '@/hooks/useProfile'
import { GRINDER_DISPLAY_NAMES, ManualEditRound, METHOD_DISPLAY_NAMES, MethodId, Recipe, SavedRecipeDetail } from '@/types/recipe'

const SCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2.0, label: '2x' },
]
const AUTO_ADJUST_CLIENT_TIMEOUT_MS = 120_000

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError'
  }
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')
  }
  return false
}

async function parseResponsePayload(res: Response): Promise<{ error?: string, recipe?: Recipe }> {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return {}
  }

  try {
    const parsed = await res.json()
    if (parsed && typeof parsed === 'object') {
      return parsed as { error?: string, recipe?: Recipe }
    }
    return {}
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw error
    }
    return {}
  }
}

type AutoAdjustClientProps = {
  id: string
  sourceRecipe: SavedRecipeDetail
}

export default function AutoAdjustClient({ id, sourceRecipe }: AutoAdjustClientProps) {
  const router = useRouter()
  const { setGuard } = useNavGuard()

  const { profile, preferredGrinder } = useProfile()
  const tempUnit = profile?.temp_unit ?? 'C'

  const [scaleFactor, setScaleFactor] = useState(1.0)
  const [intent, setIntent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<Recipe | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  useEffect(() => {
    if (result) {
      setGuard(href => {
        setPendingNavHref(href)
        setShowLeaveConfirm(true)
        return true
      })
    } else {
      setGuard(null)
    }
    return () => setGuard(null)
  }, [result, setGuard])

  const canGenerate = !(scaleFactor === 1.0 && intent.trim() === '')

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    setResult(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AUTO_ADJUST_CLIENT_TIMEOUT_MS)
    try {
      const res = await fetch(`/api/recipes/${id}/auto-adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scale_factor: scaleFactor, intent: intent.trim() }),
        signal: controller.signal,
      })
      const data = await parseResponsePayload(res)
      if (!res.ok) {
        throw new Error(data.error ?? 'Generation failed. Please try again.')
      }
      if (!data.recipe) {
        throw new Error('Generation failed. Please try again.')
      }
      setResult(data.recipe)
    } catch (err) {
      const aborted = isAbortLikeError(err)
      if (aborted) {
        setGenError('Auto-adjust timed out. Please try again.')
      } else {
        setGenError(err instanceof Error ? err.message : 'Something went wrong')
      }
    } finally {
      clearTimeout(timeout)
      setGenerating(false)
    }
  }

  async function handleSaveAsNew() {
    if (!result) return
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
    if (!result) return
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
          snapshot_kind: 'auto_adjust',
          change_summary: newRound.changes,
          current_recipe_json: result,
          feedback_history: [...(sourceRecipe.feedback_history ?? []), newRound],
          source_snapshot_id: sourceRecipe.live_snapshot_id ?? null,
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

  const displayName = METHOD_DISPLAY_NAMES[sourceRecipe.method as MethodId] ?? sourceRecipe.method
  const beanName = sourceRecipe.bean_info.bean_name ?? sourceRecipe.bean_info.origin ?? 'Unknown bean'
  const preferredGrind = result?.grind[preferredGrinder]

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      <div className="flex items-center gap-3 px-4 pb-4">
        <button onClick={() => router.back()} className="min-h-10 min-w-10 p-2 -ml-2 flex items-center justify-center" aria-label="Go back">
          <svg className="ui-icon-action" viewBox="0 0 20 20" fill="none">
            <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="ui-section-title">Auto Adjust</h2>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5 pb-8 overflow-y-auto">
        <div className="flex items-center gap-2 bg-[var(--card)] rounded-xl px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="ui-card-title truncate">{beanName}</p>
            <p className="ui-meta">{displayName}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="ui-meta">
              {sourceRecipe.current_recipe_json.parameters.coffee_g}g · {sourceRecipe.current_recipe_json.parameters.water_g}ml
            </p>
          </div>
        </div>

        <div>
          <p className="ui-overline mb-2">Scale</p>
          <div className="flex gap-1.5 flex-wrap">
            {SCALE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setScaleFactor(opt.value)}
                className={`flex-1 min-w-0 min-h-10 rounded-xl text-sm font-semibold transition-colors ${
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
            <p className="ui-meta mt-1.5">
              {Math.round(sourceRecipe.current_recipe_json.parameters.coffee_g * scaleFactor * 10) / 10}g coffee ·{' '}
              {Math.round(sourceRecipe.current_recipe_json.parameters.water_g * scaleFactor)}ml water
            </p>
          )}
        </div>

        <div>
          <p className="ui-overline mb-2">Intent (optional)</p>
          <textarea
            value={intent}
            onChange={e => setIntent(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. Make it sweeter and rounder, slightly coarser grind for a lazy morning..."
            className="ui-textarea"
          />
          <p className="ui-meta text-right mt-1">{intent.length}/500</p>
        </div>

        {!canGenerate && (
          <p className="ui-body-muted text-center -mt-2">Change the scale or describe what you&apos;d like to adjust</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className="w-full ui-button-primary font-semibold disabled:opacity-40"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
              Generating...
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

        {genError && (
          <div className="ui-alert-danger text-sm">
            {genError}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="ui-overline">Result</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { value: `${result.parameters.water_g}ml`, label: 'Water' },
                { value: `${result.parameters.coffee_g}g`, label: 'Coffee' },
                { value: tempUnit === 'F' ? `${Math.round(result.parameters.temperature_c * 9 / 5 + 32)}°F` : `${result.parameters.temperature_c}°C`, label: 'Temp' },
                { value: result.parameters.total_time, label: 'Time' },
                { value: preferredGrind ? formatGrinderSettingForDisplay(preferredGrinder, preferredGrind.starting_point) : 'N/A', label: `Grind (${GRINDER_DISPLAY_NAMES[preferredGrinder]})` },
                { value: result.parameters.ratio, label: 'Ratio' },
              ].map(p => (
                <div key={p.label} className="rounded-xl p-3 flex flex-col items-start gap-1 bg-[var(--card)]">
                  <p className="ui-card-title">{p.value}</p>
                  <p className="ui-overline leading-tight">{p.label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {result.steps.map(step => (
                <div key={step.step} className="rounded-2xl p-4 flex gap-3 bg-[var(--card)]">
                  <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-xs font-bold shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="ui-card-title">{step.time}</p>
                      <p className="ui-body-muted">+{step.water_poured_g}g → <span className="font-bold">{step.water_accumulated_g}g</span></p>
                    </div>
                    <p className="ui-body-muted leading-relaxed">{step.action}</p>
                  </div>
                </div>
              ))}
            </div>

            {saveError && (
              <div className="ui-alert-danger text-sm">
                {saveError}
              </div>
            )}

            <div className="flex flex-col gap-2 pb-4">
              <button
                onClick={handleSaveAsNew}
                disabled={saving}
                className="w-full ui-button-primary font-semibold"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                ) : 'Save as New Recipe'}
              </button>
              <button
                onClick={() => setShowReplaceConfirm(true)}
                disabled={saving}
                className="w-full ui-button-secondary"
              >
                Replace This Recipe
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || saving}
                className="w-full ui-button-ghost disabled:opacity-40"
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

      <ConfirmSheet
        open={showLeaveConfirm}
        title="Leave without saving?"
        message="Your adjusted recipe won't be saved."
        confirmLabel="Leave"
        destructive
        onConfirm={() => {
          setShowLeaveConfirm(false)
          if (pendingNavHref) {
            router.push(pendingNavHref)
            setPendingNavHref(null)
          }
        }}
        onCancel={() => { setShowLeaveConfirm(false); setPendingNavHref(null) }}
      />
    </div>
  )
}
