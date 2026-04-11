'use client'

import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BeanProfile } from '@/types/recipe'
import { useAuth } from '@/hooks/useAuth'
import { recommendMethods } from '@/lib/method-decision-engine'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'
import { useProfile } from '@/hooks/useProfile'

const PROCESS_OPTIONS = [
  { value: 'washed', label: 'Washed' },
  { value: 'natural', label: 'Natural' },
  { value: 'honey', label: 'Honey' },
  { value: 'anaerobic', label: 'Anaerobic' },
  { value: 'unknown', label: 'Other / Unknown' },
]

const ROAST_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'medium-light', label: 'Medium-Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'medium-dark', label: 'Medium-Dark' },
  { value: 'dark', label: 'Dark' },
]

const VARIETY_SUGGESTIONS = [
  'Gesha', 'Pacamara', 'Bourbon', 'Typica', 'Caturra', 'Catuai',
  'Catimor', 'SL28', 'SL34', 'Heirloom', 'Java', 'Mundo Novo',
]

function PickerField<T extends string>({
  label,
  options,
  value,
  onChange,
  required,
  error,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | ''
  onChange: (v: T) => void
  required?: boolean
  error?: string
}) {
  return (
    <div>
      <label className="ui-overline block mb-1.5">
        {label}{required && <span className="ui-text-danger ml-0.5">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`ui-chip ${
              value === opt.value
                ? 'ui-chip-selected'
                : 'ui-chip-unselected'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error && <p className="ui-meta ui-text-danger mt-1">{error}</p>}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputId,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputId: string
}) {
  return (
    <div className="ui-surface-field p-3">
      <label htmlFor={inputId} className="ui-overline block mb-1">
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="ui-input min-h-0 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 focus-visible:ring-0"
      />
    </div>
  )
}

export default function ManualPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { profile } = useProfile()

  // Required fields
  const [process, setProcess] = useState<BeanProfile['process'] | ''>('')
  const [roastLevel, setRoastLevel] = useState<BeanProfile['roast_level'] | ''>('')

  // Optional fields
  const [roaster, setRoaster] = useState('')
  const [beanName, setBeanName] = useState('')
  const [origin, setOrigin] = useState('')
  const [variety, setVariety] = useState('')
  const [altitude, setAltitude] = useState('')
  const [targetVolume, setTargetVolume] = useState('')
  const [roastDate, setRoastDate] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [tastingNotes, setTastingNotes] = useState<string[]>([])

  const [errors, setErrors] = useState<{ process?: string; roastLevel?: string; altitude?: string; roastDate?: string }>({})

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth?returnTo=/manual')
  }, [user, authLoading, router])

  useEffect(() => {
    if (profile?.default_volume_ml) {
      startTransition(() => {
        setTargetVolume(String(profile.default_volume_ml))
      })
    }
  }, [profile])

  function addNote(note: string) {
    const trimmed = note.trim().toLowerCase()
    if (trimmed && !tastingNotes.includes(trimmed)) {
      setTastingNotes(prev => [...prev, trimmed])
    }
    setNoteInput('')
  }

  function removeNote(note: string) {
    setTastingNotes(prev => prev.filter(n => n !== note))
  }

  function handleSubmit() {
    const newErrors: typeof errors = {}
    if (!process) newErrors.process = 'Process is required'
    if (!roastLevel) newErrors.roastLevel = 'Roast level is required'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const bean: BeanProfile = {
      process: process as BeanProfile['process'],
      roast_level: roastLevel as BeanProfile['roast_level'],
      roaster: roaster || undefined,
      bean_name: beanName || undefined,
      origin: origin || undefined,
      variety: variety || undefined,
      altitude_masl: altitude ? parseInt(altitude) || undefined : undefined,
      tasting_notes: tastingNotes.length > 0 ? tastingNotes : undefined,
      roast_date: roastDate || undefined,
    }

    // Annotate assumptions for missing fields (freshness defaults to optimal)
    if (!roastDate) {
      // range_logic will note this assumption in recipe generation
    }

    recipeSessionStorage.setConfirmedBean(bean)
    recipeSessionStorage.clearManualRecipeDraft()
    recipeSessionStorage.clearRecipe()
    recipeSessionStorage.clearRecipeOriginal()
    recipeSessionStorage.clearFeedbackRound()
    recipeSessionStorage.clearAdjustmentHistory()
    recipeSessionStorage.clearManualEditHistory()
    recipeSessionStorage.clearSelectedMethod()
    recipeSessionStorage.setRecipeFlowSource('manual')

    const vol = parseInt(targetVolume, 10)
    if (vol > 0) {
      recipeSessionStorage.setTargetVolumeMl(vol)
    } else {
      recipeSessionStorage.clearTargetVolumeMl()
    }

    const recs = recommendMethods(bean)
    recipeSessionStorage.setMethodRecommendations(recs)

    router.push('/methods')
  }

  const hasRequiredFields = process !== '' && roastLevel !== ''

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      <div className="flex items-center gap-3 px-4 pb-4 ui-animate-enter">
        <button onClick={() => router.back()} className="ui-icon-button -ml-2" aria-label="Go back">
          <svg className="ui-icon-action" viewBox="0 0 20 20" fill="none">
            <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="ui-section-title">Enter Manually</h1>
          <p className="ui-meta">Process & roast level required</p>
        </div>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5 overflow-y-auto pb-32 ui-animate-enter-soft">

        {/* Required: Process */}
        <PickerField
          label="Process"
          options={PROCESS_OPTIONS}
          value={process}
          onChange={v => { setProcess(v as BeanProfile['process']); setErrors(e => ({ ...e, process: undefined })) }}
          required
          error={errors.process}
        />

        {/* Required: Roast Level */}
        <PickerField
          label="Roast Level"
          options={ROAST_OPTIONS}
          value={roastLevel}
          onChange={v => { setRoastLevel(v as BeanProfile['roast_level']); setErrors(e => ({ ...e, roastLevel: undefined })) }}
          required
          error={errors.roastLevel}
        />

        <div className="flex flex-col gap-2">
          <h2 className="ui-overline">Bean Details (optional)</h2>
          <TextField inputId="manual-roaster" label="Roaster" value={roaster} onChange={setRoaster} placeholder="e.g. Square Mile" />
          <TextField inputId="manual-bean-name" label="Bean Name" value={beanName} onChange={setBeanName} placeholder="e.g. Red Brick" />
          <TextField inputId="manual-origin" label="Origin" value={origin} onChange={setOrigin} placeholder="e.g. Ethiopia, Yirgacheffe" />
        </div>

        <div>
          <h2 className="ui-overline mb-1.5">Variety (optional)</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            {VARIETY_SUGGESTIONS.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVariety(variety === v ? '' : v)}
                className={`ui-chip ${
                  variety === v
                    ? 'ui-chip-selected'
                    : 'ui-chip-unselected'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="ui-surface-field p-3">
            <label htmlFor="manual-variety" className="ui-overline block mb-1">
              Or type a variety
            </label>
            <input
              id="manual-variety"
              type="text"
              value={variety}
              onChange={e => setVariety(e.target.value)}
              placeholder="e.g. Castillo, Pink Bourbon..."
              className="ui-input min-h-0 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="ui-surface-field p-3">
          <label htmlFor="manual-altitude" className="ui-overline block mb-1">
            Altitude (masl, optional)
          </label>
          <input
            id="manual-altitude"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={altitude}
            onChange={e => {
              const val = e.target.value
              if (val === '' || /^\d+$/.test(val)) {
                setAltitude(val)
                setErrors(prev => ({ ...prev, altitude: undefined }))
              }
            }}
            onKeyDown={e => { if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault() }}
            placeholder="e.g. 1800"
            className="ui-input min-h-0 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 focus-visible:ring-0"
          />
          {errors.altitude && <p className="ui-meta ui-text-danger mt-1">{errors.altitude}</p>}
          {!altitude && !errors.altitude && (
            <p className="ui-meta mt-1">Block 5 density fine-tune will be skipped if left blank</p>
          )}
        </div>

        <div>
          <h2 className="ui-overline mb-1.5">Target Volume</h2>
          <div className="ui-surface-field p-3 flex items-center gap-2">
            <input
              id="manual-target-volume"
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
              className="ui-input min-h-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 focus-visible:ring-0"
              placeholder="250"
            />
            <span className="ui-body-muted">ml</span>
          </div>
        </div>

        <div>
          <h2 className="ui-overline mb-1.5">Tasting Notes (optional)</h2>
          {tastingNotes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {tastingNotes.map(note => (
                <button
                  key={note}
                  type="button"
                  onClick={() => removeNote(note)}
                  className="ui-chip ui-chip-selected flex items-center gap-1"
                >
                  {note}
                  <svg className="size-2.5" viewBox="0 0 10 10" fill="none">
                    <path d="M3 3L7 7M7 3L3 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          <div className="ui-surface-field p-3 flex items-center gap-2">
            <input
              id="manual-note-input"
              type="text"
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addNote(noteInput) } }}
              placeholder="e.g. blueberry, chocolate..."
              className="ui-input min-h-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 focus-visible:ring-0"
            />
            {noteInput.trim() && (
              <button
                type="button"
                onClick={() => addNote(noteInput)}
                className="ui-focus-ring rounded-md px-2 py-1 text-[var(--foreground)] ui-meta font-semibold shrink-0 transition-colors duration-150 hover:bg-[var(--surface-strong)]"
              >
                Add
              </button>
            )}
          </div>
        </div>

        <div className="ui-surface-field p-3">
          <label htmlFor="manual-roast-date" className="ui-overline block mb-1">
            Roast Date (optional)
          </label>
          <input
            id="manual-roast-date"
            type="date"
            value={roastDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => {
              const selected = e.target.value
              const today = new Date().toISOString().split('T')[0]
              if (selected > today) {
                setRoastDate(today)
                setErrors(prev => ({ ...prev, roastDate: 'Roast date cannot be in the future' }))
              } else {
                setRoastDate(selected)
                setErrors(prev => ({ ...prev, roastDate: undefined }))
              }
            }}
            className="ui-input min-h-0 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 focus-visible:ring-0"
          />
          {errors.roastDate && <p className="ui-meta ui-text-danger mt-1">{errors.roastDate}</p>}
          {!roastDate && !errors.roastDate && (
            <p className="ui-meta mt-1">Assuming optimal window (8–21 days)</p>
          )}
        </div>

        {!origin && !altitude && tastingNotes.length === 0 && (
          <p className="ui-body-muted text-center leading-relaxed px-2">
            With just process and roast level, the app will recommend versatile methods and note assumptions in the recipe.
          </p>
        )}
      </div>

      <div className="ui-sticky-footer fixed bottom-0 left-0 right-0 lg:left-56 pt-4 pb-24 lg:pb-6">
        <div className="w-full px-4 sm:px-6 md:max-w-2xl md:mx-auto md:px-8 lg:max-w-3xl xl:max-w-5xl xl:px-8">
          <button
            onClick={handleSubmit}
            className={`w-full ui-button-primary font-semibold ${
              hasRequiredFields
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'bg-[var(--border)] text-[var(--muted-foreground)] shadow-none hover:translate-y-0 hover:brightness-100 active:scale-100'
            }`}
          >
            <svg className="ui-icon-inline" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Continue to Methods
          </button>
        </div>
      </div>
    </div>
  )
}
