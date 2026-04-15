'use client'

import dynamic from 'next/dynamic'
import { computeGrindScalingDelta } from '@/lib/grind-scaling-engine'
import {
  grinderValueToKUltraClicks,
  kUltraClicksToGrinderValue,
  parseGrinderValueForEdit,
} from '@/lib/grinder-converter'
import type { GrinderId, RecipeDraftStep, RecipeWithAdjustment } from '@/types/recipe'
import { RecipeEditGrindSettings, RecipeViewGrindSettings, getGrindRangeForEdit } from './RecipeDetailSections'
import { parseKUltraRange } from '@/lib/grinder-converter'
import { scaleStepsToWater, type EditDraft } from '../_lib/editing'

const SortableStepList = dynamic(() => import('../SortableStepList'), { ssr: false })

function parseWholeNumberInput(value: string): number | '' {
  if (value === '') return ''
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? '' : Math.max(0, parsed)
}

type LiveGrindSettings = {
  k_ultra: { starting_point: string; range: string; description?: string; note?: string }
  q_air: { starting_point: string; range: string; description?: string; note?: string }
  baratza_encore_esp: { starting_point: string; range: string; description?: string; note?: string }
  timemore_c2: { starting_point: string; range: string; description?: string; note?: string }
}

export interface RecipeEditFormProps {
  editDraft: EditDraft
  tempUnit: 'C' | 'F'
  preferredGrinder: GrinderId
  editError: string | null
  stepError: string | null
  advancedOpen: boolean
  setAdvancedOpen: (open: boolean) => void
  setEditDraft: (updater: (draft: EditDraft | null) => EditDraft | null) => void
  liveGrindSettings: LiveGrindSettings | null
  currentRecipe: RecipeWithAdjustment
  onStepUpdate: (dndId: string, updates: Partial<RecipeDraftStep>) => void
  onStepDelete: (dndId: string) => void
  onStepAdd: () => void
  onStepReorder: (newSteps: EditDraft['steps']) => void
  secondaryGrindersOpen: boolean
  setSecondaryGrindersOpen: (open: boolean) => void
}

export default function RecipeEditForm({
  editDraft,
  tempUnit,
  preferredGrinder,
  editError,
  stepError,
  advancedOpen,
  setAdvancedOpen,
  setEditDraft,
  liveGrindSettings,
  currentRecipe,
  onStepUpdate,
  onStepDelete,
  onStepAdd,
  onStepReorder,
  secondaryGrindersOpen,
  setSecondaryGrindersOpen,
}: RecipeEditFormProps) {
  const activeGrind = liveGrindSettings ?? currentRecipe.grind

  const grindRange = getGrindRangeForEdit(preferredGrinder, currentRecipe.range_logic.final_operating_range)

  const kUltraRange = parseKUltraRange(currentRecipe.range_logic.final_operating_range)
  const isGrindOutOfRange = (() => {
    if (editDraft.grind_preferred_value === '') return false
    if (preferredGrinder === 'q_air' && typeof editDraft.grind_preferred_value !== 'string') return false
    const currentClicks = grinderValueToKUltraClicks(preferredGrinder, editDraft.grind_preferred_value)
    if (!kUltraRange) return false
    return currentClicks < kUltraRange.low || currentClicks > kUltraRange.high
  })()

  return (
    <div className="flex flex-col gap-4">
      {editError && (
        <div className="ui-alert-danger px-3 text-sm">
          {editError}
        </div>
      )}

      <div>
        <h2 className="ui-overline mb-2">Parameters</h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="ui-overline">Temp (°{tempUnit})</span>
              <input
                type="number"
                inputMode="numeric"
                min={tempUnit === 'F' ? 140 : 60}
                max={tempUnit === 'F' ? 212 : 100}
                step={1}
                value={editDraft.temperature_display}
                onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                onChange={event => setEditDraft(draft => draft ? { ...draft, temperature_display: parseWholeNumberInput(event.target.value) } : draft)}
                className="ui-input bg-[var(--background)] font-semibold px-3"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ui-overline">Brew Time</span>
              <input
                type="text"
                placeholder="e.g. 3:30"
                value={editDraft.total_time}
                onChange={event => setEditDraft(draft => draft ? { ...draft, total_time: event.target.value } : draft)}
                className="ui-input bg-[var(--background)] font-semibold px-3"
              />
            </label>
          </div>

          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="ui-focus-ring ui-pressable flex items-center justify-between w-full rounded-xl py-2 text-left"
          >
            <span className="ui-overline normal-case tracking-normal font-medium">Advanced (dose &amp; ratio)</span>
            <svg
              className={`size-3.5 transition-transform text-[var(--muted-foreground)] ${advancedOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 14 14"
              fill="none"
            >
              <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {advancedOpen && (
            <div className="bg-[var(--card)] rounded-2xl p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="ui-overline">Coffee (g)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step={0.1}
                    value={editDraft.coffee_g}
                    onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                    onChange={event => setEditDraft(draft => draft ? { ...draft, coffee_g: Math.max(0, parseFloat(event.target.value) || draft.coffee_g) } : draft)}
                    onBlur={() => {
                      const savedParams = currentRecipe.parameters
                      const baseDose = savedParams.coffee_g
                      const baseRatio = savedParams.water_g / savedParams.coffee_g
                      const savedGrindValue = parseGrinderValueForEdit(preferredGrinder, currentRecipe.grind[preferredGrinder].starting_point)

                      setEditDraft(draft => {
                        if (!draft) return draft
                        const newCoffee = draft.coffee_g
                        if (newCoffee <= 0) return draft
                        const newWater = Math.round(newCoffee * draft.ratio_multiplier * 10) / 10
                        const newSteps = scaleStepsToWater(draft.steps, draft.water_g, newWater)
                        const { deltaKUltraClicks } = computeGrindScalingDelta(baseDose, newCoffee, baseRatio, draft.ratio_multiplier)
                        let newGrindValue = draft.grind_preferred_value
                        if (deltaKUltraClicks !== 0) {
                          const baseKUltra = grinderValueToKUltraClicks(preferredGrinder, savedGrindValue)
                          const newKUltra = Math.max(40, Math.min(120, baseKUltra + deltaKUltraClicks))
                          newGrindValue = kUltraClicksToGrinderValue(preferredGrinder, newKUltra)
                        }
                        return { ...draft, coffee_g: newCoffee, water_g: newWater, steps: newSteps, grind_preferred_value: newGrindValue, scaledFromDose: true }
                      })
                    }}
                    className="ui-input bg-[var(--background)] font-semibold px-3"
                  />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="ui-overline">Water (g)</span>
                  <div className="rounded-xl px-3 py-2.5 bg-[var(--background)] border border-[var(--border)]">
                    <p className="ui-card-title">{editDraft.water_g}</p>
                  </div>
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="ui-overline">Ratio</span>
                <div className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 bg-[var(--background)] border border-[var(--border)] focus-within:ring-1 focus-within:ring-[var(--foreground)]/20">
                  <span className="ui-card-title">1:</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={50}
                    step={0.1}
                    value={parseFloat(editDraft.ratio_multiplier.toFixed(1))}
                    onKeyDown={event => { if (event.key === '-' || event.key === 'e') event.preventDefault() }}
                    onChange={event => setEditDraft(draft => draft ? { ...draft, ratio_multiplier: Math.max(0, parseFloat(event.target.value) || draft.ratio_multiplier) } : draft)}
                    onBlur={() => {
                      const savedParams = currentRecipe.parameters
                      const baseDose = savedParams.coffee_g
                      const baseRatio = savedParams.water_g / savedParams.coffee_g
                      const savedGrindValue = parseGrinderValueForEdit(preferredGrinder, currentRecipe.grind[preferredGrinder].starting_point)

                      setEditDraft(draft => {
                        if (!draft) return draft
                        const newRatio = draft.ratio_multiplier
                        if (newRatio <= 0) return draft
                        const newWater = Math.round(draft.coffee_g * newRatio * 10) / 10
                        const newSteps = scaleStepsToWater(draft.steps, draft.water_g, newWater)
                        const { deltaKUltraClicks } = computeGrindScalingDelta(baseDose, draft.coffee_g, baseRatio, newRatio)
                        let newGrindValue = draft.grind_preferred_value
                        if (deltaKUltraClicks !== 0) {
                          const baseKUltra = grinderValueToKUltraClicks(preferredGrinder, savedGrindValue)
                          const newKUltra = Math.max(40, Math.min(120, baseKUltra + deltaKUltraClicks))
                          newGrindValue = kUltraClicksToGrinderValue(preferredGrinder, newKUltra)
                        }
                        return { ...draft, ratio_multiplier: newRatio, water_g: newWater, steps: newSteps, grind_preferred_value: newGrindValue, scaledFromRatio: true }
                      })
                    }}
                    className="flex-1 min-w-0 bg-transparent text-base font-semibold text-[var(--foreground)] focus:outline-none"
                  />
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[var(--card)] rounded-2xl p-4">
        <h2 className="ui-overline mb-3">Grind Settings</h2>
        <RecipeEditGrindSettings
          editDraft={editDraft}
          grindRange={grindRange}
          isGrindOutOfRange={isGrindOutOfRange}
          onChange={value => setEditDraft(draft => {
            if (!draft) return draft
            if (preferredGrinder === 'q_air') {
              return { ...draft, grind_preferred_value: value }
            }
            return { ...draft, grind_preferred_value: parseWholeNumberInput(value) }
          })}
          preferredGrinder={preferredGrinder}
        />
        <RecipeViewGrindSettings
          activeGrind={activeGrind}
          preferredGrinder={preferredGrinder}
          secondaryGrindersOpen={secondaryGrindersOpen}
          setSecondaryGrindersOpen={setSecondaryGrindersOpen}
        />
      </div>

      <div>
        <h2 className="ui-overline mb-2">Brew Steps</h2>
        <SortableStepList
          steps={editDraft.steps}
          onUpdate={onStepUpdate}
          onDelete={onStepDelete}
          onAdd={onStepAdd}
          onReorder={onStepReorder}
          stepError={stepError}
        />
      </div>
    </div>
  )
}
