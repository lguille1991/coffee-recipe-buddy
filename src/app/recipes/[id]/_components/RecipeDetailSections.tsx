'use client'

import Image from 'next/image'
import type { GrinderId, ManualEditRound, MethodId, RecipeWithAdjustment, SavedRecipe } from '@/types/recipe'
import { GRINDER_DISPLAY_NAMES, METHOD_DISPLAY_NAMES } from '@/types/recipe'
import {
  formatGrinderRangeForEdit,
  formatGrinderSettingForDisplay,
  isValidQAirSetting,
} from '@/lib/grinder-converter'
import type { DraftStep } from '../SortableStepList'

export function RecipeTitleBlock({
  commentCount,
  hasFeedbackAdjustments,
  hasManualEdits,
  isEditing,
  onOpenEditHistory,
  onOpenShare,
  onOpenParentRecipe,
  recipe,
  shareToken,
  versionN,
}: {
  commentCount: number | null
  hasFeedbackAdjustments: boolean
  hasManualEdits: boolean
  isEditing: boolean
  onOpenEditHistory: () => void
  onOpenShare: () => void
  onOpenParentRecipe: () => void
  recipe: SavedRecipe
  shareToken: string | null
  versionN: number
}) {
  const displayName = METHOD_DISPLAY_NAMES[recipe.method as MethodId] ?? recipe.method
  const beanName = recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Unknown bean'

  return (
    <>
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

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="ui-page-title">{displayName}</h1>
          {hasManualEdits && (
            <button onClick={onOpenEditHistory} className="ui-badge ui-badge-info active:opacity-70">
              v{versionN} edited
            </button>
          )}
          {hasFeedbackAdjustments && (
            <span className="ui-badge ui-badge-warning">
              auto-adjusted
            </span>
          )}
          {shareToken && !isEditing && (
            <button
              onClick={onOpenShare}
              className="ui-badge bg-[var(--foreground)]/10 text-[var(--foreground)] active:opacity-70"
            >
              <svg className="size-2.5" viewBox="0 0 10 10" fill="none">
                <path d="M7.2 6.9C6.87 6.9 6.59 7.03 6.37 7.24L3.68 5.72C3.7 5.61 3.71 5.49 3.71 5.37C3.71 5.25 3.7 5.13 3.68 5.02L6.34 3.52C6.56 3.74 6.86 3.87 7.2 3.87C7.91 3.87 8.48 3.3 8.48 2.59C8.48 1.88 7.91 1.31 7.2 1.31C6.49 1.31 5.92 1.88 5.92 2.59C5.92 2.71 5.93 2.83 5.95 2.94L3.29 4.44C3.07 4.22 2.77 4.09 2.43 4.09C1.72 4.09 1.15 4.66 1.15 5.37C1.15 6.08 1.72 6.65 2.43 6.65C2.77 6.65 3.07 6.52 3.29 6.3L5.98 7.82C5.96 7.93 5.95 8.05 5.95 8.17C5.95 8.86 6.51 9.42 7.2 9.42C7.89 9.42 8.45 8.86 8.45 8.17C8.45 7.48 7.89 6.9 7.2 6.9Z" fill="currentColor" />
              </svg>
              Shared{commentCount !== null && commentCount > 0 ? ` · ${commentCount}` : ''}
            </button>
          )}
        </div>
        <p className="ui-body-muted mt-0.5">{beanName}</p>
        {recipe.bean_info.roaster && (
          <p className="ui-body-muted mt-0.5">{recipe.bean_info.roaster}</p>
        )}
        {recipe.parent_recipe_id && !isEditing && (
          <button onClick={onOpenParentRecipe} className="flex items-center gap-1 mt-1 ui-body-muted active:opacity-60">
            <svg className="size-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Scaled from original recipe{recipe.scale_factor && recipe.scale_factor !== 1 ? ` (×${recipe.scale_factor})` : ''}
          </button>
        )}
        <p className="ui-body-muted mt-1">
          Saved {new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </>
  )
}

export function RecipeViewParameters({
  preferredGrinder,
  recipe,
  tempUnit,
}: {
  preferredGrinder: GrinderId
  recipe: RecipeWithAdjustment
  tempUnit: 'C' | 'F'
}) {
  return (
    <div>
      <h2 className="ui-overline mb-2">Parameters</h2>
      <div className="grid grid-cols-3 gap-2">
        {[
          { value: `${recipe.parameters.water_g}ml`, label: 'Water' },
          { value: `${recipe.parameters.coffee_g}g`, label: 'Coffee' },
          { value: tempUnit === 'F' ? `${Math.round(recipe.parameters.temperature_c * 9 / 5 + 32)}°F` : `${recipe.parameters.temperature_c}°C`, label: 'Temp' },
          { value: recipe.parameters.total_time, label: 'Time' },
          { value: formatGrinderSettingForDisplay(preferredGrinder, recipe.grind[preferredGrinder].starting_point), label: 'Grind' },
          { value: recipe.parameters.ratio, label: 'Ratio' },
        ].map(parameter => (
          <div key={parameter.label} className="rounded-xl p-3 flex flex-col items-start gap-1 bg-[var(--background)]">
            <p className="ui-card-title">{parameter.value}</p>
            <p className="ui-overline">{parameter.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecipeViewGrindSettings({
  activeGrind,
  preferredGrinder,
  secondaryGrindersOpen,
  setSecondaryGrindersOpen,
}: {
  activeGrind: RecipeWithAdjustment['grind']
  preferredGrinder: GrinderId
  secondaryGrindersOpen: boolean
  setSecondaryGrindersOpen: (open: boolean) => void
}) {
  const secondaryGrinders = (['k_ultra', 'q_air', 'baratza_encore_esp', 'timemore_c2'] as GrinderId[]).filter(grinder => grinder !== preferredGrinder)
  const primaryData = activeGrind[preferredGrinder]

  return (
    <div className="bg-[var(--card)] rounded-2xl p-4">
      <h2 className="ui-overline mb-3">Grind Settings</h2>

      <div className="rounded-xl p-3 mb-3 bg-[var(--foreground)] text-[var(--background)]">
        <div className="flex items-center justify-between mb-1">
          <span className="ui-meta text-[var(--background)]">{GRINDER_DISPLAY_NAMES[preferredGrinder]}</span>
          <span className="ui-badge bg-[var(--background)]/20 text-[var(--background)]">Primary</span>
        </div>
        <p className="text-lg font-bold">{formatGrinderSettingForDisplay(preferredGrinder, primaryData.starting_point)}</p>
        <p className="ui-body-muted text-[var(--background)] mt-0.5">Range: {primaryData.range}</p>
        {primaryData.description && (
          <p className="ui-body-muted text-[var(--background)] mt-1 italic">{primaryData.description}</p>
        )}
        {primaryData.note && (
          <p className="ui-body-muted text-[var(--background)] mt-1 italic">{primaryData.note}</p>
        )}
      </div>

      <button
        onClick={() => setSecondaryGrindersOpen(!secondaryGrindersOpen)}
        className="flex items-center justify-between w-full py-2 text-left mt-2"
      >
        <span className="ui-overline normal-case tracking-normal font-medium">See more grinders</span>
        <svg
          className={`size-3.5 transition-transform text-[var(--muted-foreground)] ${secondaryGrindersOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 14 14"
          fill="none"
        >
          <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {secondaryGrindersOpen && (
        <div className="mt-2">
          {secondaryGrinders.map((grinder, index) => {
            const data = activeGrind[grinder]
            const isLast = index === secondaryGrinders.length - 1

            return (
              <div key={grinder} className={`flex items-start justify-between py-2.5 gap-3 ${isLast ? '' : 'border-b border-[var(--border)]'}`}>
                <div>
                  <p className="ui-body-muted font-medium">{GRINDER_DISPLAY_NAMES[grinder]}</p>
                  <p className="ui-body-muted">Range: {data.range}</p>
                  {data.note && (
                    <p className="ui-meta mt-0.5 italic">{data.note}</p>
                  )}
                </div>
                <p className="ui-card-title shrink-0">{formatGrinderSettingForDisplay(grinder, data.starting_point)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function RecipeEditGrindSettings({
  editDraft,
  grindRange,
  isGrindOutOfRange,
  onChange,
  preferredGrinder,
}: {
  editDraft: { grind_preferred_value: DraftStep['water_poured_g'] | string | number }
  grindRange: string | null
  isGrindOutOfRange: boolean
  onChange: (value: string) => void
  preferredGrinder: GrinderId
}) {
  return (
    <div className="rounded-xl p-3 mb-2 bg-[var(--foreground)] text-[var(--background)]">
      <div className="flex items-center justify-between mb-2">
        <span className="ui-meta text-[var(--background)]">{GRINDER_DISPLAY_NAMES[preferredGrinder]}</span>
        <span className="ui-badge bg-[var(--background)]/20 text-[var(--background)]">Primary</span>
      </div>
      {preferredGrinder === 'q_air' ? (
        <input
          type="text"
          inputMode="decimal"
          placeholder="2.5.0"
          value={String(editDraft.grind_preferred_value)}
          onChange={event => onChange(event.target.value.replace(/[^\d.]/g, ''))}
          className="w-full rounded-lg px-3 py-2 text-lg font-bold bg-[var(--background)]/20 text-[var(--background)] focus:outline-none focus:bg-[var(--background)]/30 border border-[var(--background)]/20"
        />
      ) : (
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={150}
          step={1}
          value={String(editDraft.grind_preferred_value)}
          onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
          onChange={event => onChange(event.target.value)}
          className="w-full rounded-lg px-3 py-2 text-lg font-bold bg-[var(--background)]/20 text-[var(--background)] focus:outline-none focus:bg-[var(--background)]/30 border border-[var(--background)]/20"
        />
      )}
      {grindRange && (
        <p className="ui-body-muted text-[var(--background)] mt-1.5">
          Recommended: {grindRange}
        </p>
      )}
      {preferredGrinder === 'q_air' && (
        <p className="ui-body-muted text-[var(--background)] mt-1.5">
          Use rotations.major.minor format, for example 2.5.0.
        </p>
      )}
      {isGrindOutOfRange && (
        <p className="ui-meta text-[var(--background)] font-medium mt-1">Outside recommended range</p>
      )}
    </div>
  )
}

export function RecipeViewSteps({ recipe }: { recipe: RecipeWithAdjustment }) {
  return (
    <div className="flex flex-col gap-2">
      {recipe.steps.map(step => (
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
  )
}

export function ShareSheet({
  copied,
  onClose,
  onCopy,
  onRevoke,
  open,
  shareToken,
  shareUrl,
}: {
  copied: boolean
  onClose: () => void
  onCopy: () => void
  onRevoke: () => void
  open: boolean
  shareToken: string | null
  shareUrl: string
}) {
  if (!open || !shareToken) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 pb-safe sm:pb-0 lg:pl-56" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-t-3xl sm:rounded-3xl w-full max-w-sm px-6 pt-6 pb-10" onClick={event => event.stopPropagation()}>
        <h3 className="ui-sheet-title mb-1">Share Recipe</h3>
        <p className="ui-sheet-body mb-4">Anyone with this link can view and clone your recipe.</p>

        <div className="flex items-center gap-2 bg-[var(--background)] rounded-xl px-3 py-2.5 mb-4">
          <p className="flex-1 ui-meta truncate">{shareUrl}</p>
          <button onClick={onCopy} className="ui-meta font-semibold text-[var(--foreground)] shrink-0 active:opacity-60">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={onCopy} className="w-full ui-button-primary font-semibold">
            {copied ? 'Link Copied!' : 'Copy Link'}
          </button>
          <button onClick={onRevoke} className="w-full ui-button-danger bg-[var(--background)]">
            Revoke Link
          </button>
        </div>
      </div>
    </div>
  )
}

export function EditHistorySheet({
  manualEditRounds,
  onClose,
  open,
}: {
  manualEditRounds: ManualEditRound[]
  onClose: () => void
  open: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 pb-safe sm:pb-0 lg:pl-56" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-t-3xl sm:rounded-3xl w-full max-w-sm px-6 pt-6 pb-10 max-h-[70vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <h3 className="ui-sheet-title mb-4">Edit History</h3>
        <div className="flex flex-col gap-3">
          {manualEditRounds.map(edit => (
            <div key={edit.version} className="bg-[var(--background)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="ui-overline text-[var(--foreground)]">
                  {edit.type === 'auto_adjust' ? 'Auto Adjusted' : `Edit v${edit.version}`}
                </span>
                <span className="ui-meta">
                  {new Date(edit.edited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {edit.changes.map((change, index) => (
                  <p key={index} className="ui-meta">
                    <span className="font-medium text-[var(--foreground)]">{{
                      coffee_g: 'Coffee Dose (g)',
                      water_g: 'Water (ml)',
                      temperature_c: 'Temperature (°C)',
                      total_time: 'Total Time (m:ss)',
                      grind: 'Grind Setting (clicks)',
                      ratio: 'Ratio',
                      steps: 'Steps',
                      notes: 'Notes',
                    }[change.field] ?? change.field}</span>: {change.previous_value} → {change.new_value}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function isQAirValueInvalid(preferredGrinder: GrinderId, value: string | number) {
  return preferredGrinder === 'q_air' && (typeof value !== 'string' || !isValidQAirSetting(value))
}

export function getGrindRangeForEdit(preferredGrinder: GrinderId, range: string) {
  return formatGrinderRangeForEdit(preferredGrinder, range)
}
