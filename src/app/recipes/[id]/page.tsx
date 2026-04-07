'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter, useParams } from 'next/navigation'
import {
  SavedRecipe, RecipeWithAdjustment, METHOD_DISPLAY_NAMES, MethodId,
  GrinderId, GRINDER_DISPLAY_NAMES, ManualEditRound, FeedbackRound,
} from '@/types/recipe'
import { recalculateFreshness, FreshnessAdjustment } from '@/lib/freshness-recalculator'
import { migrateRecipe } from '@/lib/recipe-migrations'
import { useProfile } from '@/hooks/useProfile'
import {
  kUltraRangeToQAir, kUltraRangeToBaratza, kUltraRangeToTimemoreC2,
  parseKUltraRange, parseGrinderValueForEdit, grinderValueToKUltraClicks,
  kUltraClicksToGrinderValue, parseGrinderRange,
} from '@/lib/grinder-converter'
import { computeGrindScalingDelta } from '@/lib/grind-scaling-engine'
import ConfirmSheet from '@/components/ConfirmSheet'
import { useNavGuard } from '@/components/NavGuardContext'
import type { DraftStep } from './SortableStepList'

const SortableStepList = dynamic(() => import('./SortableStepList'), { ssr: false })


function normalizeClickSetting(value: string): string {
  return value.replace(/^clicks?\s+(\d+)$/i, '$1 clicks')
}

type EditDraft = {
  coffee_g: number
  water_g: number
  ratio_multiplier: number
  scaledFromDose: boolean
  scaledFromRatio: boolean
  temperature_display: number
  total_time: string
  grind_preferred_value: number
  steps: DraftStep[]
}

type AnyFeedbackRound = FeedbackRound | ManualEditRound

function isFeedbackRound(fh: AnyFeedbackRound): fh is FeedbackRound {
  return !('type' in fh) || fh.type === 'feedback'
}

function isManualEditRound(fh: AnyFeedbackRound): fh is ManualEditRound {
  return 'type' in fh && (fh.type === 'manual_edit' || fh.type === 'auto_adjust')
}

function recomputeAccumulated(steps: DraftStep[]): DraftStep[] {
  let acc = 0
  return steps.map(s => {
    acc = Math.round((acc + s.water_poured_g) * 10) / 10
    return { ...s, water_accumulated_g: acc }
  })
}

function scaleStepsToWater(steps: DraftStep[], oldWater: number, newWater: number): DraftStep[] {
  if (oldWater === 0 || oldWater === newWater) return steps
  const scaled = steps.map(s => ({
    ...s,
    water_poured_g: s.water_poured_g === 0 ? 0 : Math.round(s.water_poured_g / oldWater * newWater * 10) / 10,
  }))
  // Absorb rounding remainder into last non-zero step so sum equals newWater exactly
  const currentSum = Math.round(scaled.reduce((sum, s) => sum + s.water_poured_g, 0) * 10) / 10
  const remainder = Math.round((newWater - currentSum) * 10) / 10
  if (remainder !== 0) {
    const lastNonZero = scaled.reduceRight((found, s, i) => found === -1 && s.water_poured_g > 0 ? i : found, -1)
    if (lastNonZero !== -1) scaled[lastNonZero] = {
      ...scaled[lastNonZero],
      water_poured_g: Math.round((scaled[lastNonZero].water_poured_g + remainder) * 10) / 10,
    }
  }
  return recomputeAccumulated(scaled)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SavedRecipeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { setGuard } = useNavGuard()

  const [recipe, setRecipe] = useState<SavedRecipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [freshnessAdj, setFreshnessAdj] = useState<FreshnessAdjustment | null>(null)
  const [freshnessIgnored, setFreshnessIgnored] = useState(false)
  const { profile, preferredGrinder } = useProfile()
  const tempUnit = profile?.temp_unit ?? 'C'

  // Notes state
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sharing state
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string>('')
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [commentCount, setCommentCount] = useState<number | null>(null)
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  const [showEditHistorySheet, setShowEditHistorySheet] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

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
        setNotes(data.notes ?? '')
        const adj = recalculateFreshness(migrated, data.bean_info.roast_date ?? undefined)
        if (adj.adjusted) setFreshnessAdj(adj)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))

    fetch(`/api/recipes/${id}/share`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setShareToken(data.shareToken)
          setShareUrl(data.url)
        }
      })
  }, [id, router])

  // Fetch comment count independently — runs after shareToken is set,
  // decoupled from the share fetch so it doesn't block recipe rendering.
  useEffect(() => {
    if (!shareToken) return
    fetch(`/api/share/${shareToken}/comments?page=1`)
      .then(r => r.ok ? r.json() : null)
      .then(res => { if (res) setCommentCount(res.total) })
  }, [shareToken])

  useEffect(() => {
    if (isEditing) {
      setGuard((href) => {
        setPendingNavHref(href)
        setShowDiscardConfirm(true)
        return true
      })
    } else {
      setGuard(null)
    }
    return () => setGuard(null)
  }, [isEditing, setGuard])

  function enterEditMode() {
    if (!recipe) return
    const r = recipe.current_recipe_json
    setEditDraft({
      coffee_g: r.parameters.coffee_g,
      water_g: r.parameters.water_g,
      ratio_multiplier: r.parameters.water_g / r.parameters.coffee_g,
      scaledFromDose: false,
      scaledFromRatio: false,
      temperature_display: tempUnit === 'F'
        ? Math.round(r.parameters.temperature_c * 9 / 5 + 32)
        : r.parameters.temperature_c,
      total_time: r.parameters.total_time,
      grind_preferred_value: parseGrinderValueForEdit(preferredGrinder, r.grind[preferredGrinder].starting_point),
      steps: r.steps.map((s, i) => ({ ...s, _dndId: `step-${i}-${s.step}` })),
    })
    setEditError(null)
    setStepError(null)
    setAdvancedOpen(false)
    setIsEditing(true)
  }

  function exitEditMode() {
    setIsEditing(false)
    setEditDraft(null)
    setEditError(null)
    setStepError(null)
    setAdvancedOpen(false)
  }

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
    const migratedOriginal = migrateRecipe(recipe.original_recipe_json as RecipeWithAdjustment, recipe.schema_version)
    sessionStorage.setItem('recipe_original', JSON.stringify(migratedOriginal))
    sessionStorage.setItem('confirmedBean', JSON.stringify(recipe.bean_info))
    sessionStorage.setItem('feedback_round', '0')

    const allHistory = (recipe.feedback_history ?? []) as AnyFeedbackRound[]
    const feedbackRounds = allHistory.filter(isFeedbackRound)
    const manualEdits = allHistory.filter(isManualEditRound)
    sessionStorage.setItem('adjustment_history', JSON.stringify(feedbackRounds))
    sessionStorage.setItem('manual_edit_history', JSON.stringify(manualEdits))

    sessionStorage.setItem('rebrew_recipe_id', id)
    router.push('/recipe')
  }

  function validateSteps(steps: DraftStep[], targetWaterG: number): string | null {
    if (steps.length > 20) return 'Recipes can have at most 20 steps.'

    const timeRegex = /^\d+:[0-5]\d$/
    let prevSeconds = -1

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      const num = i + 1

      if (!s.action.trim()) return `Step ${num} is missing a description.`

      if (!timeRegex.test(s.time)) return `Step ${num} has an invalid time "${s.time}" — use m:ss format (e.g. 1:30).`

      if (s.water_poured_g < 0) return `Step ${num} has a negative water amount.`

      const [m, ss] = s.time.split(':').map(Number)
      const seconds = m * 60 + ss
      if (seconds < prevSeconds) return `Step ${num} time (${s.time}) is earlier than the previous step — steps must be in chronological order.`
      prevSeconds = seconds
    }

    const totalPoured = Math.round(steps.reduce((sum, s) => sum + s.water_poured_g, 0) * 10) / 10
    if (Math.abs(totalPoured - targetWaterG) > 1) {
      return `Step water amounts total ${totalPoured} g but the recipe targets ${targetWaterG} g. Adjust individual step amounts to match.`
    }

    return null
  }

  async function handleSaveEdit() {
    if (!recipe || !editDraft) return

    setEditError(null)
    setStepError(null)

    // 1. Validate brew time
    if (!/^\d+:[0-5]\d(\s*[–-]\s*\d+:[0-5]\d)?$/.test(editDraft.total_time)) {
      setEditError('Brew time must be in m:ss format (e.g. 3:30) or a range (e.g. 3:30 – 4:00)')
      return
    }

    // 2. Validate steps
    const stepsValidationError = validateSteps(editDraft.steps, editDraft.water_g)
    if (stepsValidationError) {
      setStepError(stepsValidationError)
      return
    }

    // 3. Convert temperature to Celsius
    const newTempC = tempUnit === 'F'
      ? Math.round((editDraft.temperature_display - 32) * 5 / 9)
      : editDraft.temperature_display

    // 3. Back-convert grind to K-Ultra clicks
    const newKUltraClicks = grinderValueToKUltraClicks(preferredGrinder, editDraft.grind_preferred_value)

    const r = recipe.current_recipe_json
    const oldWaterG = r.parameters.water_g

    // 4. Recompute accumulated totals (water_g is derived from step amounts)
    const newSteps = recomputeAccumulated(editDraft.steps)

    // 5. Compute ratio
    const newRatio = `1:${(editDraft.water_g / editDraft.coffee_g).toFixed(1)}`

    // 6. Rebuild grinder settings
    const lowHigh = parseKUltraRange(r.range_logic.final_operating_range)
    const grindLow = lowHigh?.low ?? newKUltraClicks
    const grindHigh = lowHigh?.high ?? newKUltraClicks

    const qAirResult = kUltraRangeToQAir(grindLow, grindHigh, newKUltraClicks)
    const baratzaResult = kUltraRangeToBaratza(grindLow, grindHigh, newKUltraClicks, recipe.method)
    const timemoreResult = kUltraRangeToTimemoreC2(grindLow, grindHigh, newKUltraClicks, recipe.method)

    const newGrind = {
      k_ultra: { ...r.grind.k_ultra, starting_point: `${newKUltraClicks} clicks` },
      q_air: { ...r.grind.q_air, starting_point: qAirResult.starting_point },
      baratza_encore_esp: { ...r.grind.baratza_encore_esp, starting_point: baratzaResult.starting_point, note: baratzaResult.note },
      timemore_c2: { ...r.grind.timemore_c2, starting_point: timemoreResult.starting_point, note: timemoreResult.note },
    }

    // 7. Build ManualEditRound changes
    const changes: ManualEditRound['changes'] = []
    if (editDraft.coffee_g !== r.parameters.coffee_g)
      changes.push({ field: 'coffee_g', previous_value: String(r.parameters.coffee_g), new_value: String(editDraft.coffee_g) })
    if (editDraft.water_g !== oldWaterG)
      changes.push({ field: 'water_g', previous_value: String(oldWaterG), new_value: String(editDraft.water_g) })
    if (newTempC !== r.parameters.temperature_c)
      changes.push({ field: 'temperature_c', previous_value: String(r.parameters.temperature_c), new_value: String(newTempC) })
    if (editDraft.total_time !== r.parameters.total_time)
      changes.push({ field: 'total_time', previous_value: r.parameters.total_time, new_value: editDraft.total_time })
    const oldGrindValue = parseGrinderValueForEdit(preferredGrinder, r.grind[preferredGrinder].starting_point)
    if (editDraft.grind_preferred_value !== oldGrindValue)
      changes.push({ field: 'grind', previous_value: String(oldGrindValue), new_value: String(editDraft.grind_preferred_value) })
    const stepsChanged = JSON.stringify(newSteps.map(({ _dndId: _, ...s }) => s)) !== JSON.stringify(r.steps)
    if (stepsChanged)
      changes.push({ field: 'steps', previous_value: `${r.steps.length} steps`, new_value: `${newSteps.length} steps` })

    // 8. No changes — exit silently
    if (changes.length === 0) {
      exitEditMode()
      return
    }

    const allHistory = (recipe.feedback_history ?? []) as AnyFeedbackRound[]
    const existingManualEdits = allHistory.filter(isManualEditRound)
    const newEditRound: ManualEditRound = {
      type: 'manual_edit',
      version: existingManualEdits.length + 1,
      edited_at: new Date().toISOString(),
      changes,
    }

    const cleanedSteps = newSteps.map(({ _dndId: _, ...s }) => ({ ...s, step: 0 })).map((s, i) => ({ ...s, step: i + 1 }))

    const updatedRecipeJson: RecipeWithAdjustment = {
      ...r,
      parameters: {
        ...r.parameters,
        coffee_g: editDraft.coffee_g,
        water_g: editDraft.water_g,
        temperature_c: newTempC,
        total_time: editDraft.total_time,
        ratio: newRatio,
      },
      grind: newGrind,
      steps: cleanedSteps,
    }

    const updatedHistory = [...allHistory, newEditRound]

    // 9. PATCH the API
    setIsSavingEdit(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_recipe_json: updatedRecipeJson,
          feedback_history: updatedHistory,
        }),
      })
      if (!res.ok) {
        throw new Error('Failed to save. Please try again.')
      }
      const saved = await res.json()
      setRecipe({ ...recipe, ...saved, current_recipe_json: updatedRecipeJson, feedback_history: updatedHistory })
      exitEditMode()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleShare() {
    setSharing(true)
    try {
      const res = await fetch(`/api/recipes/${id}/share`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create share link')
      const data = await res.json()
      setShareToken(data.shareToken)
      setShareUrl(data.url)
      setShowShareSheet(true)
    } finally {
      setSharing(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
    notesDebounceRef.current = setTimeout(async () => {
      setNotesSaving(true)
      await fetch(`/api/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value || null }),
      })
      setNotesSaving(false)
    }, 500)
  }

  async function handleRevoke() {
    setRevoking(true)
    try {
      await fetch(`/api/recipes/${id}/share`, { method: 'DELETE' })
      setShareToken(null)
      setShareUrl('')
      setShowShareSheet(false)
      setShowRevokeConfirm(false)
    } finally {
      setRevoking(false)
    }
  }

  const handleStepUpdate = useCallback((dndId: string, updates: Partial<DraftStep>) => {
    setEditDraft(d => {
      if (!d) return d
      const updatedSteps = d.steps.map(s => s._dndId === dndId ? { ...s, ...updates } : s)
      if ('water_poured_g' in updates) {
        const newSteps = recomputeAccumulated(updatedSteps)
        const totalPoured = Math.round(newSteps.reduce((sum, s) => sum + s.water_poured_g, 0) * 10) / 10
        return { ...d, steps: newSteps, water_g: totalPoured, ratio_multiplier: d.coffee_g > 0 ? totalPoured / d.coffee_g : d.ratio_multiplier }
      }
      return { ...d, steps: updatedSteps }
    })
  }, [])

  const handleStepDelete = useCallback((dndId: string) => {
    setEditDraft(d => {
      if (!d) return d
      const newSteps = recomputeAccumulated(d.steps.filter(s => s._dndId !== dndId))
      const totalPoured = Math.round(newSteps.reduce((sum, s) => sum + s.water_poured_g, 0) * 10) / 10
      return { ...d, steps: newSteps, water_g: totalPoured, ratio_multiplier: d.coffee_g > 0 ? totalPoured / d.coffee_g : d.ratio_multiplier }
    })
  }, [])

  const handleStepAdd = useCallback(() => {
    setEditDraft(d => {
      if (!d) return d
      const newStep: DraftStep = {
        step: d.steps.length + 1,
        time: '0:00',
        action: '',
        water_poured_g: 0,
        water_accumulated_g: 0,
        _dndId: `new-${Date.now()}`,
      }
      return { ...d, steps: [...d.steps, newStep] }
    })
  }, [])

  const handleReorder = useCallback((newSteps: DraftStep[]) => {
    setEditDraft(d => d ? { ...d, steps: recomputeAccumulated(newSteps) } : d)
  }, [])

  // Live grind preview for edit mode
  const liveGrindSettings = useMemo(() => {
    if (!isEditing || !editDraft || !recipe) return null
    const r = recipe.current_recipe_json
    const newKUltraClicks = grinderValueToKUltraClicks(preferredGrinder, editDraft.grind_preferred_value)
    const lowHigh = parseKUltraRange(r.range_logic.final_operating_range)
    const lo = lowHigh?.low ?? newKUltraClicks
    const hi = lowHigh?.high ?? newKUltraClicks
    const qAir = kUltraRangeToQAir(lo, hi, newKUltraClicks)
    const baratza = kUltraRangeToBaratza(lo, hi, newKUltraClicks, recipe.method)
    const timemore = kUltraRangeToTimemoreC2(lo, hi, newKUltraClicks, recipe.method)
    return {
      k_ultra: { ...r.grind.k_ultra, starting_point: `${newKUltraClicks} clicks` },
      q_air: { ...r.grind.q_air, starting_point: qAir.starting_point },
      baratza_encore_esp: { ...r.grind.baratza_encore_esp, starting_point: baratza.starting_point, note: baratza.note },
      timemore_c2: { ...r.grind.timemore_c2, starting_point: timemore.starting_point, note: timemore.note },
    }
  }, [isEditing, editDraft, recipe, preferredGrinder])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-6 gap-4">
        <p className="text-sm text-[var(--muted-foreground)]">{error ?? 'Recipe not found.'}</p>
        <button onClick={() => router.replace('/recipes')} className="text-sm text-[var(--foreground)] underline">
          Back to recipes
        </button>
      </div>
    )
  }

  const displayName = METHOD_DISPLAY_NAMES[recipe.method as MethodId] ?? recipe.method
  const beanName = recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Unknown bean'
  const r = recipe.current_recipe_json

  const allHistory = (recipe.feedback_history ?? []) as AnyFeedbackRound[]
  const manualEditRounds = allHistory.filter(isManualEditRound)
  const feedbackRounds = allHistory.filter(isFeedbackRound)
  const hasManualEdits = manualEditRounds.length > 0
  const hasFeedbackAdjustments = feedbackRounds.length > 0
  const versionN = allHistory.length + 1

  // Grind range hint for edit mode
  const grindRange = editDraft
    ? parseGrinderRange(preferredGrinder, r.range_logic.final_operating_range)
    : null
  const isGrindOutOfRange = editDraft && grindRange
    ? editDraft.grind_preferred_value < grindRange.low || editDraft.grind_preferred_value > grindRange.high
    : false

  const activeGrind = (isEditing && liveGrindSettings) ? liveGrindSettings : r.grind

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isEditing) {
                setShowDiscardConfirm(true)
              } else {
                router.back()
              }
            }}
            className="p-2 -ml-2"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold">{isEditing ? 'Edit Recipe' : 'Saved Recipe'}</h2>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={shareToken ? () => setShowShareSheet(true) : handleShare}
              disabled={sharing}
              className="p-2 text-[var(--muted-foreground)] active:opacity-60 disabled:opacity-40"
              aria-label="Share recipe"
            >
              {sharing ? (
                <div className="w-[18px] h-[18px] border-2 border-[var(--muted-foreground)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M13 12.5C12.4 12.5 11.87 12.74 11.47 13.12L6.62 10.3C6.67 10.1 6.7 9.9 6.7 9.68C6.7 9.46 6.67 9.26 6.62 9.06L11.42 6.27C11.83 6.68 12.39 6.94 13 6.94C14.24 6.94 15.25 5.93 15.25 4.69C15.25 3.45 14.24 2.44 13 2.44C11.76 2.44 10.75 3.45 10.75 4.69C10.75 4.91 10.78 5.11 10.83 5.31L6.03 8.1C5.62 7.69 5.06 7.44 4.45 7.44C3.21 7.44 2.2 8.45 2.2 9.69C2.2 10.93 3.21 11.94 4.45 11.94C5.06 11.94 5.62 11.68 6.03 11.27L10.88 14.1C10.83 14.29 10.8 14.49 10.8 14.69C10.8 15.9 11.79 16.88 13 16.88C14.21 16.88 15.2 15.9 15.2 14.69C15.2 13.48 14.21 12.5 13 12.5Z" fill="currentColor" />
                </svg>
              )}
            </button>
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
        )}
      </div>

      <div className="flex-1 px-4 flex flex-col gap-4 pb-52 overflow-y-auto">

        {/* Bag photo */}
        {recipe.image_url && (
          <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden relative">
            <Image
              src={recipe.image_url}
              alt={beanName}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Title */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{displayName}</h1>
            {hasManualEdits && (
              <button
                onClick={() => setShowEditHistorySheet(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium active:opacity-70"
              >
                v{versionN} edited
              </button>
            )}
            {hasFeedbackAdjustments && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                auto-adjusted
              </span>
            )}
            {shareToken && !isEditing && (
              <button
                onClick={() => setShowShareSheet(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--foreground)]/10 text-[var(--foreground)] text-[10px] font-medium active:opacity-70"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M7.2 6.9C6.87 6.9 6.59 7.03 6.37 7.24L3.68 5.72C3.7 5.61 3.71 5.49 3.71 5.37C3.71 5.25 3.7 5.13 3.68 5.02L6.34 3.52C6.56 3.74 6.86 3.87 7.2 3.87C7.91 3.87 8.48 3.3 8.48 2.59C8.48 1.88 7.91 1.31 7.2 1.31C6.49 1.31 5.92 1.88 5.92 2.59C5.92 2.71 5.93 2.83 5.95 2.94L3.29 4.44C3.07 4.22 2.77 4.09 2.43 4.09C1.72 4.09 1.15 4.66 1.15 5.37C1.15 6.08 1.72 6.65 2.43 6.65C2.77 6.65 3.07 6.52 3.29 6.3L5.98 7.82C5.96 7.93 5.95 8.05 5.95 8.17C5.95 8.86 6.51 9.42 7.2 9.42C7.89 9.42 8.45 8.86 8.45 8.17C8.45 7.48 7.89 6.9 7.2 6.9Z" fill="currentColor" />
                </svg>
                Shared{commentCount !== null && commentCount > 0 ? ` · ${commentCount}` : ''}
              </button>
            )}
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{beanName}</p>
          {recipe.bean_info.roaster && (
            <p className="text-xs text-[#9CA3AF] mt-0.5">{recipe.bean_info.roaster}</p>
          )}
          {recipe.parent_recipe_id && !isEditing && (
            <button
              onClick={() => router.push(`/recipes/${recipe.parent_recipe_id}`)}
              className="flex items-center gap-1 mt-1 text-xs text-[var(--muted-foreground)] active:opacity-60"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Scaled from original recipe{recipe.scale_factor && recipe.scale_factor !== 1 ? ` (×${recipe.scale_factor})` : ''}
            </button>
          )}
          <p className="text-xs text-[#9CA3AF] mt-1">
            Saved {new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Freshness notice */}
        {freshnessAdj && !freshnessIgnored && !isEditing && (
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

        {/* Edit error */}
        {editError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
            {editError}
          </div>
        )}

        {/* Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Parameters</h3>

          {isEditing && editDraft ? (
            <div className="flex flex-col gap-3">
              {/* Temperature + Brew Time row (primary) */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Temp (°{tempUnit})</span>
                  <input
                    type="number"
                    min={tempUnit === 'F' ? 140 : 60}
                    max={tempUnit === 'F' ? 212 : 100}
                    step={1}
                    value={editDraft.temperature_display}
                    onChange={e => setEditDraft(d => d ? { ...d, temperature_display: parseInt(e.target.value) || d.temperature_display } : d)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Brew Time</span>
                  <input
                    type="text"
                    placeholder="e.g. 3:30"
                    value={editDraft.total_time}
                    onChange={e => setEditDraft(d => d ? { ...d, total_time: e.target.value } : d)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
                  />
                </label>
              </div>

              {/* Advanced collapsible (dose & ratio) */}
              <button
                onClick={() => setAdvancedOpen(o => !o)}
                className="flex items-center justify-between w-full py-2 text-left"
              >
                <span className="text-xs font-medium text-[var(--muted-foreground)]">Advanced (dose &amp; ratio)</span>
                <svg
                  width="14" height="14" viewBox="0 0 14 14" fill="none"
                  className={`transition-transform text-[#9CA3AF] ${advancedOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {advancedOpen && (() => {
                const showWarning = editDraft.scaledFromDose || editDraft.scaledFromRatio
                const savedParams = recipe?.current_recipe_json.parameters
                const d1 = savedParams?.coffee_g ?? editDraft.coffee_g
                const r1 = savedParams ? savedParams.water_g / savedParams.coffee_g : editDraft.ratio_multiplier
                const savedGrindValue = recipe ? parseGrinderValueForEdit(preferredGrinder, recipe.current_recipe_json.grind[preferredGrinder].starting_point) : editDraft.grind_preferred_value

                // Compute grind sentence from engine result
                let grindSentence: string | null = null
                if (showWarning) {
                  const { deltaKUltraClicks, direction, magnitude } = computeGrindScalingDelta(
                    d1, editDraft.coffee_g, r1, editDraft.ratio_multiplier
                  )
                  if (deltaKUltraClicks !== 0 && direction !== 'none') {
                    const magnitudeWord = magnitude === 'slight' ? 'slightly' : magnitude === 'moderate' ? 'moderately' : 'significantly'
                    grindSentence = `Grind adjusted ${magnitudeWord} ${direction} — fine-tune by taste.`
                  }
                }

                return (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Coffee (g)</span>
                        <input
                          type="number"
                          min={1} max={50} step={0.1}
                          value={editDraft.coffee_g}
                          onChange={e => setEditDraft(d => d ? { ...d, coffee_g: parseFloat(e.target.value) || d.coffee_g } : d)}
                          onBlur={() => {
                            if (!recipe) return
                            setEditDraft(d => {
                              if (!d) return d
                              const newCoffee = d.coffee_g
                              if (newCoffee <= 0) return d
                              const newWater = Math.round(newCoffee * d.ratio_multiplier * 10) / 10
                              const newSteps = scaleStepsToWater(d.steps, d.water_g, newWater)
                              const { deltaKUltraClicks } = computeGrindScalingDelta(d1, newCoffee, r1, d.ratio_multiplier)
                              let newGrindValue = d.grind_preferred_value
                              if (deltaKUltraClicks !== 0) {
                                const baseKUltra = grinderValueToKUltraClicks(preferredGrinder, savedGrindValue)
                                const newKUltra = Math.max(40, Math.min(120, baseKUltra + deltaKUltraClicks))
                                newGrindValue = kUltraClicksToGrinderValue(preferredGrinder, newKUltra)
                              }
                              return { ...d, coffee_g: newCoffee, water_g: newWater, steps: newSteps, grind_preferred_value: newGrindValue, scaledFromDose: true }
                            })
                          }}
                          className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
                        />
                      </label>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Water (g)</span>
                        <div className="rounded-xl px-3 py-2.5 bg-[var(--background)] border border-[var(--border)]">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{editDraft.water_g}</p>
                        </div>
                      </div>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Ratio</span>
                      <div className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 bg-[var(--background)] border border-[var(--border)] focus-within:ring-1 focus-within:ring-[var(--foreground)]/20">
                        <span className="text-sm font-semibold text-[var(--foreground)]">1:</span>
                        <input
                          type="number"
                          min={1} max={50} step={0.1}
                          value={parseFloat(editDraft.ratio_multiplier.toFixed(1))}
                          onChange={e => setEditDraft(d => d ? { ...d, ratio_multiplier: parseFloat(e.target.value) || d.ratio_multiplier } : d)}
                          onBlur={() => {
                            if (!recipe) return
                            setEditDraft(d => {
                              if (!d) return d
                              const newRatio = d.ratio_multiplier
                              if (newRatio <= 0) return d
                              const newWater = Math.round(d.coffee_g * newRatio * 10) / 10
                              const newSteps = scaleStepsToWater(d.steps, d.water_g, newWater)
                              const { deltaKUltraClicks } = computeGrindScalingDelta(d1, d.coffee_g, r1, newRatio)
                              let newGrindValue = d.grind_preferred_value
                              if (deltaKUltraClicks !== 0) {
                                const baseKUltra = grinderValueToKUltraClicks(preferredGrinder, savedGrindValue)
                                const newKUltra = Math.max(40, Math.min(120, baseKUltra + deltaKUltraClicks))
                                newGrindValue = kUltraClicksToGrinderValue(preferredGrinder, newKUltra)
                              }
                              return { ...d, ratio_multiplier: newRatio, water_g: newWater, steps: newSteps, grind_preferred_value: newGrindValue, scaledFromRatio: true }
                            })
                          }}
                          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[var(--foreground)] focus:outline-none"
                        />
                      </div>
                    </label>
                    {showWarning && (
                      <p className="text-xs text-amber-500 font-medium">
                        Step amounts were scaled proportionally.{grindSentence ? ` ${grindSentence}` : ''}
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: `${r.parameters.water_g}ml`, label: 'Water' },
                { value: `${r.parameters.coffee_g}g`, label: 'Coffee' },
                { value: tempUnit === 'F' ? `${Math.round(r.parameters.temperature_c * 9 / 5 + 32)}°F` : `${r.parameters.temperature_c}°C`, label: 'Temp' },
                { value: r.parameters.total_time, label: 'Time' },
                { value: normalizeClickSetting(r.grind[preferredGrinder].starting_point), label: 'Grind' },
                { value: r.parameters.ratio, label: 'Ratio' },
              ].map(p => (
                <div key={p.label} className="rounded-xl p-3 flex flex-col items-start gap-1 bg-[var(--background)]">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{p.value}</p>
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{p.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grind Settings */}
        {(() => {
          const secondaryGrinders = (['k_ultra', 'q_air', 'baratza_encore_esp', 'timemore_c2'] as GrinderId[]).filter(g => g !== preferredGrinder)
          const primaryData = activeGrind[preferredGrinder]
          return (
            <div className="bg-[var(--card)] rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Grind Settings</h3>

              {/* Primary grinder */}
              {isEditing && editDraft ? (
                <div className="mb-3">
                  <div className="rounded-xl p-3 mb-2 bg-[var(--foreground)] text-[var(--background)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium opacity-70">{GRINDER_DISPLAY_NAMES[preferredGrinder]}</span>
                      <span className="text-[10px] opacity-50 bg-[var(--background)]/10 px-2 py-0.5 rounded-full">Primary</span>
                    </div>
                    <input
                      type="number"
                      min={1} max={150} step={1}
                      value={editDraft.grind_preferred_value}
                      onChange={e => setEditDraft(d => d ? { ...d, grind_preferred_value: parseInt(e.target.value) || d.grind_preferred_value } : d)}
                      className="w-full rounded-lg px-3 py-2 text-lg font-bold bg-[var(--background)]/20 text-[var(--background)] focus:outline-none focus:bg-[var(--background)]/30 border border-[var(--background)]/20"
                    />
                    {grindRange && (
                      <p className="text-xs opacity-60 mt-1.5">
                        Recommended: {grindRange.low}–{grindRange.high} clicks
                      </p>
                    )}
                    {isGrindOutOfRange && (
                      <p className="text-[10px] text-amber-300 font-medium mt-1">Outside recommended range</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-3 mb-3 bg-[var(--foreground)] text-[var(--background)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium opacity-70">{GRINDER_DISPLAY_NAMES[preferredGrinder]}</span>
                    <span className="text-[10px] opacity-50 bg-[var(--background)]/10 px-2 py-0.5 rounded-full">Primary</span>
                  </div>
                  <p className="text-lg font-bold">{normalizeClickSetting(primaryData.starting_point)}</p>
                  <p className="text-xs opacity-60 mt-0.5">Range: {primaryData.range}</p>
                  {primaryData.description && (
                    <p className="text-xs opacity-50 mt-1 italic">{primaryData.description}</p>
                  )}
                  {primaryData.note && (
                    <p className="text-xs opacity-50 mt-1 italic">{primaryData.note}</p>
                  )}
                </div>
              )}

              {/* Secondary grinders */}
              {secondaryGrinders.map((grinder, i) => {
                const data = activeGrind[grinder]
                const isLast = i === secondaryGrinders.length - 1
                return (
                  <div key={grinder} className={`flex items-start justify-between py-2.5 gap-3 ${isLast ? '' : 'border-b border-[var(--border)]'}`}>
                    <div>
                      <p className="text-xs font-medium text-[var(--muted-foreground)]">{GRINDER_DISPLAY_NAMES[grinder]}</p>
                      <p className="text-xs text-[#9CA3AF]">Range: {data.range}</p>
                      {data.note && (
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5 italic">{data.note}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[var(--foreground)] shrink-0">{normalizeClickSetting(data.starting_point)}</p>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Brew Steps — view mode or editor */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Brew Steps</h3>
          {isEditing && editDraft ? (
            <SortableStepList
              steps={editDraft.steps}
              onUpdate={handleStepUpdate}
              onDelete={handleStepDelete}
              onAdd={handleStepAdd}
              onReorder={handleReorder}
              stepError={stepError}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {r.steps.map(step => (
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
          )}
        </div>

        {/* Feedback history (only FeedbackRound entries, only when not editing) */}
        {!isEditing && feedbackRounds.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Adjustment History</h3>
            <div className="flex flex-col gap-2">
              {feedbackRounds.map((fh, i) => (
                <div key={i} className="bg-[var(--card)] rounded-xl px-4 py-2.5 text-xs text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">Round {fh.round}</span>
                  {' · '}
                  {fh.variable_changed}: {fh.previous_value} → {fh.new_value}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes (only when not editing) */}
        {!isEditing && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Notes</h3>
              {notesSaving && (
                <span className="text-[10px] text-[#9CA3AF]">Saving…</span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              maxLength={1000}
              placeholder="Add notes about this brew…"
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-xs text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
            />
            <p className="text-[10px] text-[#9CA3AF] text-right mt-1">{notes.length}/1000</p>
          </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-56">
        <div className="max-w-sm lg:max-w-md mx-auto px-4 pb-20 pt-3 bg-[var(--background)]/95 backdrop-blur-sm border-t border-[var(--border)]">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
              className="w-full py-3.5 bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold rounded-[14px] active:opacity-80 disabled:opacity-50 flex items-center justify-center"
            >
              {isSavingEdit ? (
                <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
              ) : 'Save'}
            </button>
            <button
              onClick={() => setShowDiscardConfirm(true)}
              disabled={isSavingEdit}
              className="w-full py-3 text-sm font-medium text-[var(--muted-foreground)] bg-[var(--card)] rounded-[14px] active:opacity-80 disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Primary: Brew */}
            <button
              onClick={handleBrewAgain}
              className="w-full flex items-center justify-center gap-2 bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold rounded-[14px] py-4 active:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3H13L11.5 10H4.5L3 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.5 10C4.5 12 5.5 13 8 13C10.5 13 11.5 12 11.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M11 3C11 3 13 3.5 13 5.5C13 7.5 11 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Brew
            </button>
            {/* Secondary: Edit Recipe */}
            <button
              onClick={enterEditMode}
              className="w-full flex items-center justify-center gap-2 bg-[var(--card)] text-[var(--foreground)] text-sm font-medium rounded-[14px] py-3.5 border border-[var(--border)] active:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 14L5.5 13L13.5 5C14.05 4.45 14.05 3.55 13.5 3L13 2.5C12.45 1.95 11.55 1.95 11 2.5L3 10.5L2 14Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.5 3L13 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Edit Recipe
            </button>
            {/* Ghost: Auto Adjust */}
            <button
              onClick={() => router.push(`/recipes/${id}/auto-adjust`)}
              className="w-full flex items-center justify-center gap-2 text-[var(--muted-foreground)] text-sm font-medium rounded-[14px] py-3 active:opacity-60 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L9.5 6H14L10.5 8.5L12 12.5L8 10L4 12.5L5.5 8.5L2 6H6.5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Auto Adjust
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Share sheet */}
      {showShareSheet && shareToken && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-safe" onClick={() => setShowShareSheet(false)}>
          <div className="bg-[var(--card)] rounded-t-3xl w-full max-w-sm px-6 pt-6 pb-10" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">Share Recipe</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">Anyone with this link can view and clone your recipe.</p>

            <div className="flex items-center gap-2 bg-[var(--background)] rounded-xl px-3 py-2.5 mb-4">
              <p className="flex-1 text-xs text-[var(--muted-foreground)] truncate">{shareUrl}</p>
              <button
                onClick={handleCopy}
                className="text-xs font-semibold text-[var(--foreground)] shrink-0 active:opacity-60"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleCopy}
                className="w-full py-3.5 bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold rounded-[14px] active:opacity-80"
              >
                {copied ? 'Link Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="w-full py-3.5 bg-[var(--background)] text-red-500 text-sm font-medium rounded-[14px] active:opacity-80"
              >
                Revoke Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit History sheet */}
      {showEditHistorySheet && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-safe" onClick={() => setShowEditHistorySheet(false)}>
          <div className="bg-[var(--card)] rounded-t-3xl w-full max-w-sm px-6 pt-6 pb-10 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Edit History</h3>
            <div className="flex flex-col gap-3">
              {manualEditRounds.map(edit => (
                <div key={edit.version} className="bg-[var(--background)] rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[var(--foreground)]">
                      {edit.type === 'auto_adjust' ? 'Auto Adjusted' : `Edit v${edit.version}`}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {new Date(edit.edited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {edit.changes.map((ch, i) => (
                      <p key={i} className="text-xs text-[var(--muted-foreground)]">
                        <span className="font-medium text-[var(--foreground)]">{{
                          coffee_g: 'Coffee Dose (g)',
                          water_g: 'Water (ml)',
                          temperature_c: 'Temperature (°C)',
                          total_time: 'Total Time (m:ss)',
                          grind: 'Grind Setting (clicks)',
                          ratio: 'Ratio',
                          steps: 'Steps',
                          notes: 'Notes',
                        }[ch.field] ?? ch.field}</span>: {ch.previous_value} → {ch.new_value}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-safe">
          <div className="bg-[var(--card)] rounded-t-3xl w-full max-w-sm px-6 pt-6 pb-10">
            <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">Delete this recipe?</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">This action cannot be undone.</p>
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
                className="w-full py-3.5 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium rounded-[14px] active:opacity-80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirm (Case C) */}
      <ConfirmSheet
        open={showRevokeConfirm}
        title="Revoke share link?"
        message="Anyone with the current link will lose access. This cannot be undone."
        confirmLabel="Revoke Link"
        destructive
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setShowRevokeConfirm(false)}
      />

      {/* Discard edit confirm (Case E) */}
      <ConfirmSheet
        open={showDiscardConfirm}
        title="Discard changes?"
        message="Your edits to this recipe won't be saved."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          exitEditMode()
          setShowDiscardConfirm(false)
          if (pendingNavHref) {
            router.push(pendingNavHref)
            setPendingNavHref(null)
          }
        }}
        onCancel={() => { setShowDiscardConfirm(false); setPendingNavHref(null) }}
      />
    </div>
  )
}
