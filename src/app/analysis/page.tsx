'use client'

import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { isSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { BeanProfile, BeanProfileSchema, BrewGoal, ExtractionResponse } from '@/types/recipe'
import { recommendMethods } from '@/lib/method-decision-engine'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

const PROCESS_LABELS: Record<string, string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  unknown: 'Unknown',
}

const ROAST_LABELS: Record<string, string> = {
  light: 'Light',
  'medium-light': 'Med-Light',
  medium: 'Medium',
  'medium-dark': 'Med-Dark',
  dark: 'Dark',
}

const GOAL_OPTIONS: Array<{ value: BrewGoal; label: string; description: string }> = [
  { value: 'clarity', label: 'Clarity', description: 'clean, tea-like, transparent cup' },
  { value: 'balanced', label: 'Balanced', description: 'sweetness and structure with low fuss' },
  { value: 'sweetness', label: 'Sweetness', description: 'push ripe fruit and round sweetness' },
  { value: 'body', label: 'Body', description: 'heavier texture and more weight' },
  { value: 'forgiving', label: 'Forgiving', description: 'safer starting point when the bag is tricky' },
]

function ConfidenceBadge({ score }: { score?: number }) {
  if (!score || score >= 0.6) return null
  return (
    <span className="ml-1 inline-block ui-badge ui-badge-warning">
      low confidence
    </span>
  )
}

function EditableField({
  label,
  value,
  onChange,
  confidence,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  confidence?: number
  type?: string
}) {
  return (
    <div className="bg-[var(--card)] rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <label className="ui-overline">{label}</label>
        <ConfidenceBadge score={confidence} />
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-base font-medium text-[var(--foreground)] bg-transparent outline-none"
      />
    </div>
  )
}

export default function AnalysisPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { profile } = useProfile()
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null)
  const [bean, setBean] = useState<BeanProfile | null>(null)
  const [roastDate, setRoastDate] = useState('')
  const [targetVolume, setTargetVolume] = useState('')
  const [brewGoal, setBrewGoal] = useState<BrewGoal>('balanced')
  const [generating, setGenerating] = useState(false)
  const [savingProfileOnly, setSavingProfileOnly] = useState(false)
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null)
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.default_volume_ml) {
      startTransition(() => {
        setTargetVolume(String(profile.default_volume_ml))
      })
    }
  }, [profile])

  useEffect(() => {
    const data = recipeSessionStorage.getExtractionResult<ExtractionResponse>()
    if (!data) { router.replace('/scan'); return }
    const b = data.bean
    const parts = [b.variety, b.finca, b.producer].filter(Boolean)
    startTransition(() => {
      setExtraction(data)
      setBean({ ...b, bean_name: parts.length ? parts.join(' · ') : b.bean_name || undefined })
    })
  }, [router])

  function updateField<K extends keyof BeanProfile>(key: K, value: BeanProfile[K]) {
    setBean(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function buildFinalBean() {
    if (!bean) return null
    return BeanProfileSchema.parse({
      ...bean,
      process: bean.process ?? 'unknown',
      roast_level: bean.roast_level ?? 'medium',
      roast_date: roastDate || undefined,
    }) as BeanProfile
  }

  async function saveCoffeeProfile(finalBean: BeanProfile) {
    if (!isSavedCoffeeProfilesEnabled() || !user) {
      return { profileId: null as string | null }
    }

    const imageDataUrl = recipeSessionStorage.getScannedBagImageDataUrl()
    const response = await fetch('/api/coffee-profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: finalBean.bean_name || `${finalBean.roaster || 'Coffee'} — ${finalBean.origin || 'Unknown Origin'}`,
        bean_profile_json: finalBean,
        scan_source: 'scan',
        image_data_url: imageDataUrl ?? undefined,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to save coffee profile')
    }

    return {
      profileId: typeof data?.profile?.id === 'string' ? data.profile.id : null,
      imageError: typeof data?.primary_image_error === 'string' ? data.primary_image_error : null,
    }
  }

  function clearSaveOnlySessionState() {
    recipeSessionStorage.clearConfirmedBean()
    recipeSessionStorage.clearMethodRecommendations()
    recipeSessionStorage.clearRecipeFlowSource()
    recipeSessionStorage.clearSelectedMethod()
    recipeSessionStorage.clearTargetVolumeMl()
    recipeSessionStorage.clearRecipe()
    recipeSessionStorage.clearRecipeOriginal()
    recipeSessionStorage.clearPendingSaveRecipe()
    recipeSessionStorage.clearFeedbackRound()
    recipeSessionStorage.clearAdjustmentHistory()
    recipeSessionStorage.clearExtractionResult()
    recipeSessionStorage.clearScannedBagImageDataUrl()
  }

  async function handleSaveProfileOnly() {
    const finalBean = buildFinalBean()
    if (!finalBean) return

    setSavingProfileOnly(true)
    setSaveProfileError(null)

    try {
      const saved = await saveCoffeeProfile(finalBean)
      clearSaveOnlySessionState()
      setSavedProfileId(saved.profileId)
      if (saved.imageError) {
        setSaveProfileError(`Coffee saved, but image upload failed: ${saved.imageError}`)
      }
    } catch (error) {
      setSaveProfileError(error instanceof Error ? error.message : 'Failed to save coffee profile')
    } finally {
      setSavingProfileOnly(false)
    }
  }

  async function handleSaveAndGenerate() {
    const finalBean = buildFinalBean()
    if (!finalBean) return

    setGenerating(true)
    setSaveProfileError(null)

    if (isSavedCoffeeProfilesEnabled()) {
      try {
        await saveCoffeeProfile(finalBean)
      } catch {
        // Continue recipe generation flow even if profile save fails.
      }
    }

    try {
      recipeSessionStorage.setConfirmedBean(finalBean)
      recipeSessionStorage.clearManualRecipeDraft()
      recipeSessionStorage.setRecipeFlowSource('generated')

      const vol = parseInt(targetVolume, 10)
      if (vol > 0) {
        recipeSessionStorage.setTargetVolumeMl(vol)
      } else {
        recipeSessionStorage.clearTargetVolumeMl()
      }

      const recs = recommendMethods(finalBean, {
        brewGoal,
        extractionConfidence: extraction?.confidence ?? null,
        source: 'scan',
      })
      recipeSessionStorage.setMethodRecommendations(recs)
      router.push('/methods')
    } finally {
      setGenerating(false)
    }
  }

  if (!bean || !extraction) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 pb-4">
        <button onClick={() => router.back()} className="min-h-10 min-w-10 p-2 -ml-2 flex items-center justify-center" aria-label="Go back">
          <ArrowLeft className="ui-icon-action" />
        </button>
        <h2 className="ui-section-title">Coffee Analysis</h2>
      </div>

      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-5 overflow-y-auto pb-48">
        {/* Bean identity card */}
        <div className="bg-[var(--card)] rounded-2xl p-4 flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-[#D4C9B8] flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="12" rx="8" ry="5" stroke="#6B5B45" strokeWidth="1.5" />
              <path d="M4 12C4 12 8 7 12 12S20 12 20 12" stroke="#6B5B45" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={bean.bean_name || ''}
              onChange={e => updateField('bean_name', e.target.value || undefined)}
              placeholder="Unknown Bean"
              className="w-full font-semibold text-[var(--foreground)] text-base bg-transparent outline-none placeholder:text-[var(--muted-foreground)]"
            />
            <p className="ui-body-muted mt-0.5">{bean.roaster || 'Unknown Roaster'}</p>
            <p className="ui-body-muted mt-0.5">
              {bean.origin ? `${bean.origin} · ` : ''}{ROAST_LABELS[bean.roast_level]} Roast
            </p>
          </div>
        </div>

        {/* Bean profile grid */}
        <div>
          <h3 className="ui-overline px-1 mb-2">Bean Profile</h3>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            <EditableField
              label="Origin"
              value={bean.origin || ''}
              onChange={v => updateField('origin', v || undefined)}
              confidence={extraction.confidence.origin}
            />
            <EditableField
              label="Roast"
              value={ROAST_LABELS[bean.roast_level] || bean.roast_level}
              onChange={v => updateField('roast_level', v.toLowerCase().replace(' ', '-') as BeanProfile['roast_level'])}
              confidence={extraction.confidence.roast_level}
            />
            <EditableField
              label="Process"
              value={PROCESS_LABELS[bean.process] || bean.process}
              onChange={v => updateField('process', v.toLowerCase() as BeanProfile['process'])}
              confidence={extraction.confidence.process}
            />
            <EditableField
              label="Altitude"
              value={bean.altitude_masl ? `${bean.altitude_masl}m` : ''}
              onChange={v => updateField('altitude_masl', parseInt(v) || undefined)}
              confidence={extraction.confidence.altitude_masl}
            />
          </div>
        </div>

        {/* Flavor notes */}
        {(bean.tasting_notes?.length ?? 0) > 0 && (
          <div>
            <h3 className="ui-overline px-1 mb-2">Flavor Notes</h3>
            <div className="flex flex-wrap gap-2">
              {bean.tasting_notes!.map(note => (
                <span key={note} className="ui-chip ui-chip-unselected capitalize">
                  {note}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Roast date */}
        <div>
          <h3 className="ui-overline px-1 mb-2">Roast Date</h3>
          <div className="bg-[var(--card)] rounded-xl p-3">
            <input
              type="date"
              value={roastDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => {
                const selected = e.target.value
                const today = new Date().toISOString().split('T')[0]
                if (selected > today) {
                  setRoastDate(today)
                } else {
                  setRoastDate(selected)
                }
              }}
              className="w-full text-base font-medium text-[var(--foreground)] bg-transparent outline-none"
              placeholder="Optional — leave blank for optimal window"
            />
            {!roastDate && (
              <p className="ui-meta mt-1">Assuming optimal window (8–21 days)</p>
            )}
          </div>
        </div>

        {/* Target volume */}
        <div>
          <h3 className="ui-overline px-1 mb-2">Target Volume</h3>
          <div className="bg-[var(--card)] rounded-xl p-3 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={targetVolume}
              onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault() }}
              onChange={e => {
                const val = e.target.value
                if (val === '') {
                  setTargetVolume('')
                } else {
                  const num = Math.max(0, parseInt(val) || 0)
                  setTargetVolume(String(num))
                }
              }}
              min={50}
              max={2000}
              className="flex-1 text-base font-medium text-[var(--foreground)] bg-transparent outline-none"
              placeholder="250"
            />
            <span className="ui-body-muted">ml</span>
          </div>
        </div>

        <div>
          <h3 className="ui-overline px-1 mb-2">Brew Goal</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GOAL_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setBrewGoal(option.value)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  brewGoal === option.value
                    ? 'border-[var(--foreground)] bg-[var(--surface-subtle)]'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
              >
                <div className="ui-card-title">{option.label}</div>
                <p className="ui-meta mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-56 bg-[var(--background)] pt-4 pb-24 lg:pb-6">
        <div className="w-full px-4 sm:px-6 md:max-w-2xl md:mx-auto md:px-8 lg:max-w-3xl xl:max-w-5xl xl:px-8 flex flex-col gap-2">
          {savedProfileId && (
            <div className="ui-card-interactive bg-[var(--card)] rounded-xl p-3">
              <p className="ui-body-muted">Coffee saved.</p>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => router.push(`/coffees/${savedProfileId}`)}
                  className="ui-button-secondary"
                >
                  View Saved Coffee
                </button>
                <button
                  onClick={handleSaveAndGenerate}
                  disabled={generating}
                  className="ui-button-primary"
                >
                  {generating ? 'Generating...' : 'Generate Recipe Now'}
                </button>
              </div>
            </div>
          )}

          {saveProfileError && (
            <div className="ui-alert-danger text-sm">
              {saveProfileError}
            </div>
          )}

          {isSavedCoffeeProfilesEnabled() && user && !savedProfileId && (
            <button
              onClick={handleSaveProfileOnly}
              disabled={savingProfileOnly || generating}
              className="w-full ui-button-secondary font-semibold disabled:opacity-50"
            >
              {savingProfileOnly ? 'Saving coffee...' : 'Save Coffee'}
            </button>
          )}

          <button
            onClick={handleSaveAndGenerate}
            disabled={generating || savingProfileOnly}
            className="w-full ui-button-primary font-semibold disabled:opacity-50"
          >
            {generating ? (
              <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="ui-icon-action" />
            )}
            Save + Generate Recipe
          </button>
        </div>
      </div>
    </div>
  )
}
