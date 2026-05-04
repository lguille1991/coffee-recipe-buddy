'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles } from 'lucide-react'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'
import { isSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { BeanProfile, BeanProfileSchema, BrewGoal, ExtractionResponse } from '@/types/recipe'
import { recommendMethods } from '@/lib/method-decision-engine'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

type DuplicateCandidate = {
  id: string
  label: string
}

type SaveCoffeeProfileResult =
  | { type: 'created'; profileId: string | null; imageError: string | null }
  | { type: 'duplicate_blocked'; selectedCandidateId: string; candidates: DuplicateCandidate[] }

const PROCESS_LABELS: Record<string, string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  carbonic: 'Carbonic',
  thermal_shock: 'Thermal Shock',
  experimental: 'Experimental',
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

const ROAST_OPTIONS: BeanProfile['roast_level'][] = ['light', 'medium-light', 'medium', 'medium-dark', 'dark']
const PROCESS_OPTIONS: BeanProfile['process'][] = [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'carbonic',
  'thermal_shock',
  'experimental',
  'unknown',
]

type FieldErrors = {
  coffeeName?: string
  origin?: string
  altitude?: string
}

function getAltitudeError(value: string): string | undefined {
  if (value === '') return undefined
  if (!/^\d+$/.test(value)) return 'Enter altitude as a whole number between 300 and 3000, or leave blank.'
  const parsed = parseInt(value, 10)
  if (parsed < 300 || parsed > 3000) return 'Enter altitude as a whole number between 300 and 3000, or leave blank.'
  return undefined
}

function getMaxLengthError(label: string, value: string): string | undefined {
  if (value.length <= 150) return undefined
  return `${label} must be 150 characters or fewer.`
}

function ConfidenceBadge({ score }: { score?: number }) {
  if (!score || score >= 0.6) return null
  return (
    <span className="ml-1 inline-block ui-badge ui-badge-warning">
      low confidence
    </span>
  )
}

function EditableBadge() {
  return <span className="inline-block ui-badge">Editable</span>
}

function EditableTextField({
  label,
  value,
  onChange,
  confidence,
  testId,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  confidence?: number
  testId: string
  maxLength?: number
}) {
  return (
    <div className="bg-[var(--card)] rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <label className="ui-overline">{label}</label>
          <EditableBadge />
        </div>
        <ConfidenceBadge score={confidence} />
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={maxLength}
        data-testid={testId}
        className="w-full text-base font-medium text-[var(--foreground)] bg-transparent outline-none"
      />
    </div>
  )
}

export default function AnalysisPage() {
  const router = useRouter()
  const { setGuard } = useNavGuard()
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
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([])
  const [selectedDuplicateProfileId, setSelectedDuplicateProfileId] = useState<string | null>(null)
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const [pendingDuplicateAction, setPendingDuplicateAction] = useState<'save' | 'save_and_generate' | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  const [altitudeInput, setAltitudeInput] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

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
    const initialBean = { ...b, bean_name: parts.length ? parts.join(' · ') : b.bean_name || undefined }
    startTransition(() => {
      setExtraction(data)
      setBean(initialBean)
      setAltitudeInput(initialBean.altitude_masl ? String(initialBean.altitude_masl) : '')
      setFieldErrors({
        coffeeName: getMaxLengthError('Coffee name', initialBean.bean_name ?? ''),
        origin: getMaxLengthError('Origin', initialBean.origin ?? ''),
        altitude: getAltitudeError(initialBean.altitude_masl ? String(initialBean.altitude_masl) : ''),
      })
    })
  }, [router])

  const hasUnsavedCoffeeProfile =
    isSavedCoffeeProfilesEnabled() && Boolean(user) && !savedProfileId && !savingProfileOnly && !generating

  useEffect(() => {
    if (!hasUnsavedCoffeeProfile) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedCoffeeProfile])

  useEffect(() => {
    if (hasUnsavedCoffeeProfile) {
      setGuard((href: string) => {
        setPendingNavHref(href)
        setShowLeaveConfirm(true)
        return true
      })
    } else {
      setGuard(null)
    }

    return () => setGuard(null)
  }, [hasUnsavedCoffeeProfile, setGuard])

  function updateField<K extends keyof BeanProfile>(key: K, value: BeanProfile[K]) {
    setBean(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function buildFinalBean() {
    if (!bean) return null
    const altitudeError = getAltitudeError(altitudeInput)
    const coffeeNameError = getMaxLengthError('Coffee name', bean.bean_name ?? '')
    const originError = getMaxLengthError('Origin', bean.origin ?? '')

    if (altitudeError || coffeeNameError || originError) {
      setFieldErrors({
        altitude: altitudeError,
        coffeeName: coffeeNameError,
        origin: originError,
      })
      return null
    }

    const altitude = altitudeInput === '' ? undefined : parseInt(altitudeInput, 10)
    return BeanProfileSchema.parse({
      ...bean,
      altitude_masl: altitude,
      process: bean.process ?? 'unknown',
      roast_level: bean.roast_level ?? 'medium',
      roast_date: roastDate || undefined,
    }) as BeanProfile
  }

  async function saveCoffeeProfile(finalBean: BeanProfile) {
    if (!isSavedCoffeeProfilesEnabled() || !user) {
      return { type: 'created', profileId: null, imageError: null } satisfies SaveCoffeeProfileResult
    }

    const imageDataUrl = recipeSessionStorage.getScannedBagImageDataUrl()
    const label = finalBean.bean_name || `${finalBean.roaster || 'Coffee'} — ${finalBean.origin || 'Unknown Origin'}`
    const response = await fetch('/api/coffee-profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label,
        bean_profile_json: finalBean,
        scan_source: 'scan',
        image_data_url: imageDataUrl ?? undefined,
      }),
    })

    const data = await response.json()
    if (response.status === 409 && data?.status === 'duplicate_blocked') {
      const selectedCandidateId = typeof data?.selected_candidate_id === 'string'
        ? data.selected_candidate_id
        : null
      if (!selectedCandidateId) {
        throw new Error('Duplicate profile found, but no candidate id was returned')
      }

      const candidates = Array.isArray(data?.candidates)
        ? data.candidates
          .filter((candidate: unknown): candidate is DuplicateCandidate => {
            const typed = candidate as { id?: unknown; label?: unknown }
            return typeof typed.id === 'string' && typeof typed.label === 'string'
          })
        : []

      return {
        type: 'duplicate_blocked',
        selectedCandidateId,
        candidates,
      } satisfies SaveCoffeeProfileResult
    }

    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to save coffee profile')
    }

    return {
      type: 'created',
      profileId: typeof data?.profile?.id === 'string' ? data.profile.id : null,
      imageError: typeof data?.primary_image_error === 'string' ? data.primary_image_error : null,
    } satisfies SaveCoffeeProfileResult
  }

  function openDuplicateConfirm(result: Extract<SaveCoffeeProfileResult, { type: 'duplicate_blocked' }>, action: 'save' | 'save_and_generate') {
    setDuplicateCandidates(result.candidates)
    setSelectedDuplicateProfileId(result.selectedCandidateId)
    setPendingDuplicateAction(action)
    setShowDuplicateConfirm(true)
  }

  function continueToMethodSelection(finalBean: BeanProfile, profileId: string | null) {
    if (profileId) {
      recipeSessionStorage.setSelectedCoffeeProfileId(profileId)
    } else {
      recipeSessionStorage.clearSelectedCoffeeProfileId()
    }

    recipeSessionStorage.setSelectedBrewGoal(brewGoal)
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
    recipeSessionStorage.clearSelectedCoffeeProfileId()
    recipeSessionStorage.clearSelectedBrewGoal()
  }

  async function handleSaveProfileOnly() {
    const finalBean = buildFinalBean()
    if (!finalBean) return

    setSavingProfileOnly(true)
    setSaveProfileError(null)

    try {
      const saved = await saveCoffeeProfile(finalBean)
      if (saved.type === 'duplicate_blocked') {
        openDuplicateConfirm(saved, 'save')
        return
      }
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
    recipeSessionStorage.clearSelectedCoffeeProfileId()
    recipeSessionStorage.setSelectedBrewGoal(brewGoal)

    if (isSavedCoffeeProfilesEnabled()) {
      try {
        const saved = await saveCoffeeProfile(finalBean)
        if (saved.type === 'duplicate_blocked') {
          openDuplicateConfirm(saved, 'save_and_generate')
          return
        }
        if (saved.profileId) {
          recipeSessionStorage.setSelectedCoffeeProfileId(saved.profileId)
        }
      } catch {
        // Continue recipe generation flow even if profile save fails.
      }
    }

    try {
      continueToMethodSelection(finalBean, recipeSessionStorage.getSelectedCoffeeProfileId())
    } finally {
      setGenerating(false)
    }
  }

  function handleUseExistingDuplicate() {
    const selectedId = selectedDuplicateProfileId
    const action = pendingDuplicateAction
    if (!selectedId || !action) {
      setShowDuplicateConfirm(false)
      return
    }

    setShowDuplicateConfirm(false)
    setSavedProfileId(selectedId)
    recipeSessionStorage.setSelectedCoffeeProfileId(selectedId)

    if (action === 'save') {
      clearSaveOnlySessionState()
      setSavedProfileId(selectedId)
      return
    }

    const finalBean = buildFinalBean()
    if (!finalBean) return
    continueToMethodSelection(finalBean, selectedId)
  }

  const handleCancelDuplicate = useCallback(() => {
    setShowDuplicateConfirm(false)
    setDuplicateCandidates([])
    setSelectedDuplicateProfileId(null)
    setPendingDuplicateAction(null)
    setGenerating(false)
    setSavingProfileOnly(false)
  }, [])

  const handleConfirmLeave = useCallback(() => {
    setGuard(null)
    if (pendingNavHref) {
      router.push(pendingNavHref)
    } else {
      router.back()
    }
    setPendingNavHref(null)
    setShowLeaveConfirm(false)
  }, [pendingNavHref, router, setGuard])

  const handleCancelLeave = useCallback(() => {
    setShowLeaveConfirm(false)
    setPendingNavHref(null)
  }, [])

  const handleBack = useCallback(() => {
    if (hasUnsavedCoffeeProfile) {
      setShowLeaveConfirm(true)
      return
    }

    router.back()
  }, [hasUnsavedCoffeeProfile, router])

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
        <button onClick={handleBack} className="min-h-10 min-w-10 p-2 -ml-2 flex items-center justify-center" aria-label="Go back">
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
              onChange={e => {
                const value = e.target.value
                updateField('bean_name', value || undefined)
                setFieldErrors(prev => ({ ...prev, coffeeName: getMaxLengthError('Coffee name', value) }))
              }}
              maxLength={150}
              data-testid="coffee-name"
              placeholder="Unknown Bean"
              className="w-full font-semibold text-[var(--foreground)] text-base bg-transparent outline-none placeholder:text-[var(--muted-foreground)]"
            />
            {fieldErrors.coffeeName && <p className="ui-meta ui-text-danger mt-1">{fieldErrors.coffeeName}</p>}
            <p className="ui-body-muted mt-0.5" data-testid="roaster">{bean.roaster || 'Unknown Roaster'}</p>
            <p className="ui-body-muted mt-0.5" data-testid="roast-level-display">
              {bean.origin ? `${bean.origin} · ` : ''}{ROAST_LABELS[bean.roast_level]} Roast
            </p>
          </div>
        </div>

        {/* Bean profile grid */}
        <div>
          <h3 className="ui-overline px-1 mb-2">Bean Profile</h3>
          <p className="ui-meta px-1 mb-2">Review and edit extracted values before continuing.</p>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            <EditableTextField
              label="Origin"
              value={bean.origin || ''}
              onChange={v => {
                updateField('origin', v || undefined)
                setFieldErrors(prev => ({ ...prev, origin: getMaxLengthError('Origin', v) }))
              }}
              confidence={extraction.confidence.origin}
              testId="bean-origin"
              maxLength={150}
            />
            <div className="bg-[var(--card)] rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <label className="ui-overline">Roast</label>
                  <EditableBadge />
                </div>
                <ConfidenceBadge score={extraction.confidence.roast_level} />
              </div>
              <select
                value={bean.roast_level}
                onChange={e => updateField('roast_level', e.target.value as BeanProfile['roast_level'])}
                data-testid="roast-level-input"
                className="w-full text-base font-medium text-[var(--foreground)] bg-transparent outline-none"
              >
                {ROAST_OPTIONS.map(option => (
                  <option
                    key={option}
                    value={option}
                    data-testid={`roast-level-option-${option}`}
                  >
                    {ROAST_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <label className="ui-overline">Process</label>
                  <EditableBadge />
                </div>
                <ConfidenceBadge score={extraction.confidence.process} />
              </div>
              <select
                value={bean.process}
                onChange={e => updateField('process', e.target.value as BeanProfile['process'])}
                data-testid="bean-process"
                className="w-full text-base font-medium text-[var(--foreground)] bg-transparent outline-none"
              >
                {PROCESS_OPTIONS.map(option => (
                  <option
                    key={option}
                    value={option}
                    data-testid={`bean-process-option-${option}`}
                  >
                    {PROCESS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <label className="ui-overline">Altitude (masl)</label>
                  <EditableBadge />
                </div>
                <ConfidenceBadge score={extraction.confidence.altitude_masl} />
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={altitudeInput}
                onKeyDown={e => {
                  if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault()
                }}
                onChange={e => {
                  const value = e.target.value
                  if (!/^\d*$/.test(value)) {
                    setAltitudeInput(value)
                    setFieldErrors(prev => ({ ...prev, altitude: getAltitudeError(value) }))
                    return
                  }
                  setAltitudeInput(value)
                  setFieldErrors(prev => ({ ...prev, altitude: getAltitudeError(value) }))
                }}
                data-testid="altitude"
                className="w-full text-base font-medium text-[var(--foreground)] bg-transparent outline-none"
                placeholder="e.g. 1800"
              />
              {fieldErrors.altitude && <p className="ui-meta ui-text-danger mt-1">{fieldErrors.altitude}</p>}
            </div>
          </div>
          {fieldErrors.origin && <p className="ui-meta ui-text-danger mt-1 px-1">{fieldErrors.origin}</p>}
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
              data-testid="roast-date"
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
              data-testid="target-volume"
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
                data-testid={`brew-goal-${option.value}`}
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
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => router.push(`/coffees/${savedProfileId}`)}
                  data-testid="view-saved-coffee"
                  className="w-full ui-button-secondary"
                >
                  View Saved Coffee
                </button>
                <button
                  onClick={handleSaveAndGenerate}
                  disabled={generating}
                  data-testid="generate-recipe-now"
                  className="w-full ui-button-primary"
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
              data-testid="save-coffee-profile"
              className="w-full ui-button-secondary font-semibold disabled:opacity-50"
            >
              {savingProfileOnly ? 'Saving coffee...' : 'Save Coffee'}
            </button>
          )}

          <button
            onClick={handleSaveAndGenerate}
            disabled={generating || savingProfileOnly}
            data-testid="save-and-generate-recipe"
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

      <ConfirmSheet
        open={showLeaveConfirm}
        title="Leave without saving?"
        message="If you leave now, this coffee profile will be lost."
        confirmLabel="Leave screen"
        destructive
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
      <ConfirmSheet
        open={showDuplicateConfirm}
        title="Duplicate coffee found"
        message={
          duplicateCandidates.length > 1
            ? `A matching active profile already exists. Using "${duplicateCandidates[0]?.label ?? 'existing profile'}" by default.`
            : 'A matching active profile already exists. Use the existing profile to continue.'
        }
        confirmLabel="Use Existing"
        onConfirm={handleUseExistingDuplicate}
        onCancel={handleCancelDuplicate}
      />
    </div>
  )
}
