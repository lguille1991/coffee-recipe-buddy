'use client'

import dynamic from 'next/dynamic'
import type { ManualRecipeDraft } from '@/lib/manual-recipe'
import type { GrinderId, RecipeDraftStep } from '@/types/recipe'
import { RecipeEditGrindSettings } from '@/app/recipes/[id]/_components/RecipeDetailSections'

const SortableStepList = dynamic(() => import('@/app/recipes/[id]/SortableStepList'), { ssr: false })

interface ManualRecipeFormProps {
  manualDraft: ManualRecipeDraft
  tempUnit: 'C' | 'F'
  preferredGrinder: GrinderId
  saveError: string | null
  stepError: string | null
  requiredState: {
    temperatureMissing: boolean
    totalTimeMissing: boolean
    coffeeMissing: boolean
    waterMissing: boolean
    grindMissing: boolean
  }
  updateDraft: (updater: (draft: ManualRecipeDraft) => ManualRecipeDraft) => void
  onStepUpdate: (dndId: string, updates: Partial<RecipeDraftStep>) => void
  onStepDelete: (dndId: string) => void
  onStepAdd: () => void
  onStepReorder: (newSteps: RecipeDraftStep[]) => void
}

function parseWholeNumberInput(value: string): number | '' {
  if (value === '') return ''
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? '' : Math.max(0, parsed)
}

function sanitizeManualBrewTimeInput(value: string) {
  const filtered = value.replace(/[^\d:-]/g, '')
  let result = ''
  let colonCount = 0
  let dashUsed = false

  for (const char of filtered) {
    if (/\d/.test(char)) {
      result += char
      continue
    }

    if (char === ':' && colonCount < 2 && result !== '' && result[result.length - 1] !== ':' && result[result.length - 1] !== '-') {
      result += char
      colonCount++
      continue
    }

    if (char === '-' && !dashUsed && colonCount === 1 && result !== '' && result[result.length - 1] !== '-') {
      result += char
      dashUsed = true
    }
  }

  return result
}

function getRequiredInputClass(isMissing: boolean) {
  return [
    'ui-input bg-[var(--background)] font-semibold px-3',
    isMissing
      ? 'border-[var(--danger-border)] bg-[var(--danger-bg)]/45 focus:border-[var(--danger-border)] focus:ring-2 focus:ring-[var(--danger-border)]/45'
      : '',
  ].join(' ').trim()
}

export default function ManualRecipeForm({
  manualDraft,
  tempUnit,
  preferredGrinder,
  saveError,
  stepError,
  requiredState,
  updateDraft,
  onStepUpdate,
  onStepDelete,
  onStepAdd,
  onStepReorder,
}: ManualRecipeFormProps) {
  return (
    <div className="flex-1 px-4 sm:px-6 flex flex-col gap-4 pb-24 overflow-y-auto">
      <div>
        <h1 className="ui-page-title-hero">{manualDraft.display_name}</h1>
        <p className="ui-body-muted mt-0.5" data-testid="coffee-name">
          {manualDraft.bean_info.bean_name || manualDraft.bean_info.origin || 'Your Coffee'}
          {manualDraft.bean_info.roast_level ? ` · ${manualDraft.bean_info.roast_level.charAt(0).toUpperCase() + manualDraft.bean_info.roast_level.slice(1)} Roast` : ''}
        </p>
        <p className="ui-body-muted mt-1.5 leading-relaxed">
          Add your own brew parameters and steps. This manual recipe will save once the fields are complete.
        </p>
        <p className="ui-meta ui-text-danger mt-2">
          All fields marked * are required before you can save.
        </p>
      </div>

      {saveError && (
        <div className="ui-alert-danger text-sm">
          {saveError}
        </div>
      )}

      <div>
        <h3 className="ui-overline mb-2">Parameters</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="ui-overline">Temp (°{tempUnit}) <span className="ui-text-danger">*</span></span>
            <input
              type="number"
              inputMode="numeric"
              min={tempUnit === 'F' ? 140 : 60}
              max={tempUnit === 'F' ? 212 : 100}
              step={1}
              value={manualDraft.edit_draft.temperature_display}
              data-testid="brew-temp"
              onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
              onChange={event => updateDraft(current => ({
                ...current,
                edit_draft: { ...current.edit_draft, temperature_display: parseWholeNumberInput(event.target.value) },
              }))}
              className={getRequiredInputClass(requiredState.temperatureMissing)}
              placeholder={tempUnit === 'F' ? '199' : '93'}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="ui-overline">Brew Time <span className="ui-text-danger">*</span></span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1:00-1:45"
              value={manualDraft.edit_draft.total_time}
              data-testid="brew-time"
              onChange={event => updateDraft(current => ({
                ...current,
                edit_draft: { ...current.edit_draft, total_time: sanitizeManualBrewTimeInput(event.target.value) },
              }))}
              className={getRequiredInputClass(requiredState.totalTimeMissing)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="ui-overline">Coffee (g) <span className="ui-text-danger">*</span></span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={0.1}
              value={manualDraft.edit_draft.coffee_g || ''}
              data-testid="coffee-amount"
              onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
              onChange={event => updateDraft(current => {
                const coffee = event.target.value === '' ? 0 : Math.max(0, parseFloat(event.target.value) || 0)
                return {
                  ...current,
                  edit_draft: {
                    ...current.edit_draft,
                    coffee_g: coffee,
                    ratio_multiplier: coffee > 0 ? current.edit_draft.water_g / coffee : 0,
                  },
                }
              })}
              className={getRequiredInputClass(requiredState.coffeeMissing)}
              placeholder="15"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="ui-overline">Water (g) <span className="ui-text-danger">*</span></span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={0.1}
              value={manualDraft.edit_draft.water_g || ''}
              data-testid="water-amount"
              onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
              onChange={event => updateDraft(current => {
                const water = event.target.value === '' ? 0 : Math.max(0, parseFloat(event.target.value) || 0)
                return {
                  ...current,
                  edit_draft: {
                    ...current.edit_draft,
                    water_g: water,
                    ratio_multiplier: current.edit_draft.coffee_g > 0 ? water / current.edit_draft.coffee_g : 0,
                  },
                }
              })}
              className={getRequiredInputClass(requiredState.waterMissing)}
              placeholder="250"
            />
          </label>
        </div>
      </div>

      <RecipeEditGrindSettings
        editDraft={manualDraft.edit_draft}
        grindRange={null}
        highlightEmptyRequired={requiredState.grindMissing}
        isGrindOutOfRange={false}
        onChange={value => updateDraft(current => ({
          ...current,
          edit_draft: { ...current.edit_draft, grind_preferred_value: value },
        }))}
        preferredGrinder={preferredGrinder}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="ui-overline">Brew Steps</h3>
          <span className="ui-meta">Time, water, and description are required for each step.</span>
        </div>
        <SortableStepList
          highlightEmptyRequired
          steps={manualDraft.edit_draft.steps}
          onAdd={onStepAdd}
          onDelete={onStepDelete}
          onReorder={onStepReorder}
          onUpdate={onStepUpdate}
          stepError={stepError}
        />
      </div>
    </div>
  )
}
