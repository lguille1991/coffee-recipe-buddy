'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { recommendMethods } from '@/lib/method-decision-engine'
import { BeanProfile, BrewGoalSchema, METHOD_DISPLAY_NAMES, MethodIdSchema } from '@/types/recipe'

type ProfileDetail = {
  id: string
  label: string
  bean_profile_json: {
    roaster?: string | null
    origin?: string | null
    process?: string | null
    roast_level?: string | null
  }
  archived_at: string | null
}

type ProfileDetailResponse = {
  profile: ProfileDetail
  primary_image: { id: string; signed_url: string | null } | null
}

export default function SavedCoffeeDetailClient({ profileId }: { profileId: string }) {
  const router = useRouter()
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProfileDetailResponse | null>(null)

  const [method, setMethod] = useState('v60')
  const [goal, setGoal] = useState('balanced')
  const [waterMode, setWaterMode] = useState<'absolute' | 'delta'>('absolute')
  const [waterValue, setWaterValue] = useState('250')
  const hasAutoSelectedMethod = useRef(false)

  useEffect(() => {
    let active = true

    async function loadDetail() {
      try {
        const response = await fetch(`/api/coffee-profiles/${profileId}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load coffee profile')
        const data = await response.json() as ProfileDetailResponse
        if (active) setDetail(data)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load coffee profile')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDetail()
    return () => {
      active = false
    }
  }, [profileId])

  const archived = useMemo(() => detail?.profile.archived_at != null, [detail])
  const beanProfileForRecommendations = useMemo<BeanProfile | null>(() => {
    if (!detail) return null
    const bean = detail.profile.bean_profile_json
    const process = normalizeProcess(bean.process)
    if (!process) return null

    return {
      process,
      roast_level: normalizeRoastLevel(bean.roast_level) ?? 'medium',
      roaster: bean.roaster ?? null,
      origin: bean.origin ?? null,
    }
  }, [detail])

  const recommendedMethods = useMemo(() => {
    if (!beanProfileForRecommendations) return []
    return recommendMethods(beanProfileForRecommendations, { brewGoal: goal as (typeof GOAL_OPTIONS)[number] })
  }, [beanProfileForRecommendations, goal])

  const groupedMethodOptions = useMemo(() => {
    const recommended = recommendedMethods
      .map(entry => entry.method)
      .filter((value): value is (typeof METHOD_OPTIONS)[number] => METHOD_OPTIONS.includes(value as (typeof METHOD_OPTIONS)[number]))

    const recommendedSet = new Set(recommended)
    const other = METHOD_OPTIONS.filter(option => !recommendedSet.has(option))

    return { recommended, other }
  }, [recommendedMethods])

  useEffect(() => {
    if (!profile?.default_volume_ml) return
    if (waterMode !== 'absolute') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWaterValue(String(profile.default_volume_ml))
  }, [profile?.default_volume_ml, waterMode])

  useEffect(() => {
    if (hasAutoSelectedMethod.current) return
    const topRecommendation = groupedMethodOptions.recommended[0]
    if (!topRecommendation) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMethod(topRecommendation)
    hasAutoSelectedMethod.current = true
  }, [groupedMethodOptions.recommended])

  async function handleGenerate() {
    setSaving(true)
    setError(null)

    const value = Number.parseInt(waterValue, 10)
    if (!Number.isFinite(value)) {
      setError('Water value must be a number')
      setSaving(false)
      return
    }

    const payload: Record<string, unknown> = {
      coffee_profile_id: profileId,
      method,
      goal,
      water_mode: waterMode,
    }

    if (waterMode === 'absolute') {
      payload.water_grams = value
    } else {
      payload.water_delta_grams = value
    }

    try {
      const response = await fetch('/api/recipes/from-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to generate recipe')
      }

      router.push(`/recipes/${data.recipeId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recipe')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    try {
      const response = await fetch(`/api/coffee-profiles/${profileId}/archive`, {
        method: 'POST',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to archive profile')
      }
      setDetail(prev => prev ? { ...prev, profile: { ...prev.profile, archived_at: new Date().toISOString() } } : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive profile')
    }
  }

  async function handleRestore() {
    try {
      const response = await fetch(`/api/coffee-profiles/${profileId}/restore`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to restore profile')
      }
      setDetail(prev => prev ? { ...prev, profile: { ...prev.profile, archived_at: null } } : prev)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore profile')
    }
  }

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="h-12" />
      <div className="px-4 sm:px-6 pb-4">
        <Link href="/coffees" className="ui-meta underline">Back to saved coffees</Link>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && detail && (
        <div className="px-4 sm:px-6 pb-8 flex flex-col gap-4">
          <div className="ui-card-interactive bg-[var(--card)] rounded-2xl p-4">
            <h1 className="ui-page-title" data-testid="coffee-name">{detail.profile.label}</h1>
            <p className="ui-body-muted mt-2" data-testid="roaster">
              {detail.profile.bean_profile_json.roaster ?? 'Unknown roaster'} · {detail.profile.bean_profile_json.origin ?? 'Unknown origin'}
            </p>
            <p className="ui-body-muted mt-1" data-testid="bean-process">
              {toDisplayLabel(detail.profile.bean_profile_json.process, 'Unknown process')} · {toDisplayLabel(detail.profile.bean_profile_json.roast_level, 'Unknown roast')}
            </p>
          </div>

          <div className="w-full max-w-2xl rounded-2xl overflow-hidden bg-[var(--surface-strong)] lg:mx-auto">
            {detail.primary_image?.signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.primary_image.signed_url} alt={detail.profile.label} className="w-full h-auto object-cover" />
            ) : (
              <div className="aspect-[4/3] flex items-center justify-center ui-body-muted">No image</div>
            )}
          </div>

          <div className="ui-card-interactive bg-[var(--card)] rounded-2xl p-4 flex flex-col gap-3">
            <h2 className="ui-card-title">Generate New Recipe</h2>

            <label className="ui-meta">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} data-testid="brew-method" className="ui-input">
              {groupedMethodOptions.recommended.length > 0 && (
                <optgroup label="Recommended methods">
                  {groupedMethodOptions.recommended.map(m => <option key={`recommended-${m}`} value={m}>{METHOD_DISPLAY_NAMES[m]}</option>)}
                </optgroup>
              )}
              <optgroup label="Other">
                {groupedMethodOptions.other.map(m => <option key={`other-${m}`} value={m}>{METHOD_DISPLAY_NAMES[m]}</option>)}
              </optgroup>
            </select>

            <label className="ui-meta">Goal</label>
            <select value={goal} onChange={e => setGoal(e.target.value)} data-testid="brew-goal" className="ui-input">
              {GOAL_OPTIONS.map(g => <option key={g} value={g}>{toDisplayLabel(g, g)}</option>)}
            </select>

            <label className="ui-meta">Water Mode</label>
            <select value={waterMode} onChange={e => setWaterMode(e.target.value as 'absolute' | 'delta')} data-testid="water-mode" className="ui-input">
              <option value="absolute">Absolute grams</option>
              <option value="delta">Delta grams</option>
            </select>

            <label className="ui-meta">{waterMode === 'absolute' ? 'Water grams' : 'Water delta grams'}</label>
            <input
              value={waterValue}
              onChange={e => {
                const raw = e.target.value
                if (waterMode === 'absolute') {
                  setWaterValue(raw.replace(/\D/g, ''))
                  return
                }
                const normalized = raw
                  .replace(/[^\d-]/g, '')
                  .replace(/(?!^)-/g, '')
                setWaterValue(normalized)
              }}
              data-testid={waterMode === 'absolute' ? 'water-amount' : 'water-delta'}
              className="ui-input"
              inputMode="numeric"
              pattern={waterMode === 'absolute' ? '[0-9]*' : '-?[0-9]*'}
            />

            <button onClick={handleGenerate} disabled={saving || archived} data-testid="generate-recipe" className="ui-button-primary">
              {saving ? 'Generating...' : 'Generate Recipe'}
            </button>

            {archived ? (
              <button onClick={handleRestore} data-testid="restore-profile" className="ui-button-secondary">
                Restore Profile
              </button>
            ) : (
              <button onClick={handleArchive} data-testid="archive-profile" className="ui-button-secondary">
                Archive Profile
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="px-4 sm:px-6 pb-8">
          <div className="ui-card-interactive bg-[var(--card)] rounded-2xl p-4 text-center">
            <p className="ui-body-muted">{error}</p>
          </div>
        </div>
      )}

      <div className="h-24" />
    </div>
  )
}
const METHOD_OPTIONS = MethodIdSchema.options
const GOAL_OPTIONS = BrewGoalSchema.options

function normalizeProcess(value: string | null | undefined): BeanProfile['process'] | null {
  if (!value) return null
  const normalized = normalizeCanonicalToken(value)
  const matched = PROCESS_VALUES.find(option => option === normalized)
  return matched ?? null
}

function normalizeRoastLevel(value: string | null | undefined): BeanProfile['roast_level'] | null {
  if (!value) return null
  const normalized = normalizeCanonicalToken(value).replace(/_/g, '-')
  const matched = ROAST_LEVEL_VALUES.find(option => option === normalized)
  return matched ?? null
}

function normalizeCanonicalToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function toDisplayLabel(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  const normalized = value.replace(/[_-]+/g, ' ').trim()
  if (!normalized) return fallback

  return normalized
    .split(/\s+/)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
}

const PROCESS_VALUES = [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'carbonic',
  'thermal_shock',
  'experimental',
  'unknown',
] as const

const ROAST_LEVEL_VALUES = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const
