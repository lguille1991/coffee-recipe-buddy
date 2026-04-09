'use client'

import { useState } from 'react'
import {
  CircleDot,
  Droplets,
  Play,
  Ratio,
  Scale,
  Square,
  Thermometer,
  Timer,
} from 'lucide-react'
import type {
  AdjustmentMetadata,
  GrinderId,
  RecipeWithAdjustment,
  Symptom,
} from '@/types/recipe'
import {
  GRINDER_DISPLAY_NAMES,
} from '@/types/recipe'
import { formatGrinderSettingForDisplay } from '@/lib/grinder-converter'
import { formatElapsed } from '../_hooks/useWakeLockTimer'

const SYMPTOM_OPTIONS: { value: Symptom; emoji: string; label: string }[] = [
  { value: 'too_acidic', emoji: '☀️', label: 'Too acidic' },
  { value: 'too_bitter', emoji: '🔥', label: 'Too bitter' },
  { value: 'flat_lifeless', emoji: '💧', label: 'Flat / lifeless' },
  { value: 'slow_drain', emoji: '🐌', label: 'Slow drain' },
  { value: 'fast_drain', emoji: '💨', label: 'Fast drain' },
]

function ParamCard({
  annotation,
  changed,
  icon,
  label,
  value,
}: {
  annotation?: string
  changed?: boolean
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className={`rounded-xl p-3 flex flex-col items-start gap-1.5 relative ${
        changed ? 'bg-[var(--warning-bg)] ring-1 ring-[var(--warning-border)]' : 'bg-[var(--background)]'
      }`}
    >
      <div className="text-[var(--muted-foreground)]">{icon}</div>
      <p className="ui-card-title">{value}</p>
      <p className="ui-overline">{label}</p>
      {changed && annotation && (
        <p className="ui-meta ui-text-warning font-medium leading-tight">{annotation}</p>
      )}
    </div>
  )
}

function Collapsible({ children, title }: { children: React.ReactNode; title: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-[var(--card)] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(value => !value)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="ui-card-title">{title}</span>
        <svg
          className={`ui-icon-inline transition-transform text-[var(--muted-foreground)] ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export function RecipeParametersSection({
  adjustment,
  preferredGrinder,
  recipe,
}: {
  adjustment?: AdjustmentMetadata
  preferredGrinder: GrinderId
  recipe: RecipeWithAdjustment
}) {
  const changedVar = adjustment?.variable_changed
  const grindChanged = changedVar === 'grind'
  const tempChanged = changedVar === 'temperature'
  const ratioChanged = changedVar === 'ratio'

  function annotation(field: 'grind' | 'temp' | 'ratio') {
    if (!adjustment) return undefined
    if (field === 'grind' && grindChanged) return `${adjustment.previous_value} → ${adjustment.new_value} (${adjustment.direction})`
    if (field === 'temp' && tempChanged) return `${adjustment.previous_value} → ${adjustment.new_value} (${adjustment.direction})`
    if (field === 'ratio' && ratioChanged) return `${adjustment.previous_value} → ${adjustment.new_value} (${adjustment.direction})`
    return undefined
  }

  return (
    <div>
      <h3 className="ui-overline mb-2">Parameters</h3>
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-2">
        <ParamCard
          icon={<Droplets size={16} />}
          value={`${recipe.parameters.water_g}ml`}
          label="Water"
          changed={ratioChanged}
          annotation={annotation('ratio')}
        />
        <ParamCard
          icon={<Scale size={16} />}
          value={`${recipe.parameters.coffee_g}g`}
          label="Coffee"
        />
        <ParamCard
          icon={<Thermometer size={16} />}
          value={`${recipe.parameters.temperature_c}°C`}
          label="Temp"
          changed={tempChanged}
          annotation={annotation('temp')}
        />
        <ParamCard
          icon={<Timer size={16} />}
          value={recipe.parameters.total_time}
          label="Brew Time"
        />
        <ParamCard
          icon={<CircleDot size={16} />}
          value={formatGrinderSettingForDisplay(preferredGrinder, recipe.grind[preferredGrinder].starting_point)}
          label="Grind"
          changed={grindChanged}
          annotation={annotation('grind')}
        />
        <ParamCard
          icon={<Ratio size={16} />}
          value={recipe.parameters.ratio}
          label="Ratio"
          changed={ratioChanged}
        />
      </div>
    </div>
  )
}

export function RecipeGrindSettingsCard({
  adjustment,
  preferredGrinder,
  recipe,
}: {
  adjustment?: AdjustmentMetadata
  preferredGrinder: GrinderId
  recipe: RecipeWithAdjustment
}) {
  const [secondaryGrindersOpen, setSecondaryGrindersOpen] = useState(false)
  const grindChanged = adjustment?.variable_changed === 'grind'
  const secondaryGrinders = (['k_ultra', 'q_air', 'baratza_encore_esp', 'timemore_c2'] as GrinderId[])
    .filter(grinder => grinder !== preferredGrinder)
  const primaryData = recipe.grind[preferredGrinder]

  return (
    <div className={`bg-[var(--card)] rounded-2xl p-4 ${grindChanged ? 'ring-1 ring-[var(--warning-border)]' : ''}`}>
      <h3 className="ui-overline mb-3">Grind Settings</h3>

      <div className={`rounded-xl p-3 mb-3 text-[var(--background)] ${grindChanged ? 'bg-amber-700' : 'bg-[var(--foreground)]'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="ui-meta text-[var(--background)]">{GRINDER_DISPLAY_NAMES[preferredGrinder]}</span>
          <span className="ui-badge bg-[var(--background)]/20 text-[var(--background)]">Primary</span>
        </div>
        <p className="text-lg font-bold">{formatGrinderSettingForDisplay(preferredGrinder, primaryData.starting_point)}</p>
        <p className="ui-body-muted text-[var(--background)] mt-0.5">Range: {primaryData.range}</p>
        {grindChanged && adjustment && (
          <p className="ui-body-muted text-[var(--background)] mt-1 font-medium">{adjustment.previous_value} → {adjustment.new_value}</p>
        )}
        {primaryData.description && (
          <p className="ui-body-muted text-[var(--background)] mt-1 italic">{primaryData.description}</p>
        )}
        {primaryData.note && (
          <p className="ui-body-muted text-[var(--background)] mt-1 italic">{primaryData.note}</p>
        )}
      </div>

      <button
        onClick={() => setSecondaryGrindersOpen(value => !value)}
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
            const data = recipe.grind[grinder]
            const isLast = index === secondaryGrinders.length - 1
            return (
              <div
                key={grinder}
                className={`flex items-start justify-between py-2.5 gap-3 ${isLast ? '' : 'border-b border-[var(--border)]'}`}
              >
                <div>
                  <p className="ui-meta font-medium">{GRINDER_DISPLAY_NAMES[grinder]}</p>
                  <p className="ui-meta">Range: {data.range}</p>
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

function RecipeStepCards({
  activeStepIndex,
  adjustment,
  getStepProgress,
  recipe,
}: {
  activeStepIndex: number
  adjustment?: AdjustmentMetadata
  getStepProgress?: (index: number) => number
  recipe: RecipeWithAdjustment
}) {
  const ratioChanged = adjustment?.variable_changed === 'ratio'

  return (
    <div className="flex flex-col gap-2 md:gap-3">
      {recipe.steps.map((step, index) => {
        const isActive = activeStepIndex === index
        const isPast = activeStepIndex > index
        const progress = getStepProgress?.(index) ?? 0

        return (
          <div
            key={step.step}
            className={`relative overflow-hidden rounded-2xl p-4 md:p-6 flex gap-3 transition-all duration-300 ${
              ratioChanged ? 'bg-[var(--warning-bg)]' : 'bg-[var(--card)]'
            } ${isActive ? 'ring-2 ring-[var(--foreground)] scale-[1.01]' : ''} ${isPast ? 'opacity-50' : ''}`}
          >
            {isActive && (
              <div
                className="absolute inset-0 bg-[var(--foreground)]/[0.06] pointer-events-none transition-[width] duration-1000 ease-linear rounded-2xl"
                style={{ width: `${progress * 100}%` }}
              />
            )}

            <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-xs font-bold shrink-0 relative">
              {step.step}
            </div>

            <div className="flex-1 relative">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="ui-card-title">{step.time}</p>
                <p className="ui-body-muted">
                  +{step.water_poured_g}g → <span className="font-bold">{step.water_accumulated_g}g</span>
                </p>
              </div>
              <p className="ui-body-muted leading-relaxed">{step.action}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function StaticRecipeStepsSection({
  adjustment,
  recipe,
}: {
  adjustment?: AdjustmentMetadata
  recipe: RecipeWithAdjustment
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 md:mb-4">
        <h3 className="ui-overline">Brew Steps</h3>
      </div>

      <RecipeStepCards
        activeStepIndex={-1}
        adjustment={adjustment}
        recipe={recipe}
      />
    </div>
  )
}

export function BrewRecipeStepsSection({
  activeStepIndex,
  adjustment,
  elapsedSeconds,
  getStepProgress,
  onToggleTimer,
  recipe,
  timerOverrun,
  timerRunning,
}: {
  activeStepIndex: number
  adjustment?: AdjustmentMetadata
  elapsedSeconds: number
  getStepProgress: (index: number) => number
  onToggleTimer: () => void
  recipe: RecipeWithAdjustment
  timerOverrun: boolean
  timerRunning: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 md:mb-4">
        <h3 className="ui-overline">Brew Steps</h3>
        <div className="flex items-center gap-2">
          {(timerRunning || elapsedSeconds > 0) && (
            <span className={`text-sm font-mono font-semibold tabular-nums ${timerOverrun ? 'ui-text-danger' : 'text-[var(--foreground)]'}`}>
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
          <button
            onClick={onToggleTimer}
            className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center active:opacity-70"
            aria-label={timerRunning ? 'Stop timer' : 'Start timer'}
          >
            {timerRunning
              ? <Square size={12} fill="currentColor" />
              : <Play size={12} fill="currentColor" className="translate-x-px" />}
          </button>
        </div>
      </div>

      <RecipeStepCards
        activeStepIndex={activeStepIndex}
        adjustment={adjustment}
        getStepProgress={getStepProgress}
        recipe={recipe}
      />
    </div>
  )
}

export function RecipeDetailsPanels({ recipe }: { recipe: RecipeWithAdjustment }) {
  return (
    <>
      <Collapsible title="Quick Adjustments">
        <div className="flex flex-col gap-2.5">
          {Object.entries(recipe.quick_adjustments).map(([key, value]) => (
            <div key={key}>
              <p className="ui-overline mb-0.5">
                {key.replace(/_/g, ' ')}
              </p>
              <p className="ui-body leading-relaxed">{value}</p>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="How was this calculated?">
        <div className="flex flex-col gap-2">
          {[
            ['Base Range', recipe.range_logic.base_range],
            ['Process Offset', recipe.range_logic.process_offset],
            ['Roast Offset', recipe.range_logic.roast_offset],
            ['Freshness Offset', recipe.range_logic.freshness_offset],
            ['Density Offset', recipe.range_logic.density_offset],
            ['Final Range', recipe.range_logic.final_operating_range],
            ['Starting Point', recipe.range_logic.starting_point],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <p className="ui-meta shrink-0">{label}</p>
              <p className="ui-meta text-[var(--foreground)] text-right">{value}</p>
            </div>
          ))}
          {recipe.range_logic.compressed && (
            <p className="ui-meta ui-text-warning bg-[var(--warning-bg)] px-2 py-1 rounded-lg mt-1">
              Range was compressed to stay within the 10-click accumulation cap.
            </p>
          )}
        </div>
      </Collapsible>
    </>
  )
}

export function RecipeFeedbackSection({
  adjustError,
  adjusting,
  feedbackRound,
  maxRoundsReached,
  onAdjust,
  onCancelFeedback,
  onOpenFeedback,
  onReset,
  onSelectSymptom,
  onSwitchMethod,
  selectedSymptom,
  showFeedback,
}: {
  adjustError: string | null
  adjusting: boolean
  feedbackRound: number
  maxRoundsReached: boolean
  onAdjust: () => void
  onCancelFeedback: () => void
  onOpenFeedback: () => void
  onReset: () => void
  onSelectSymptom: (symptom: Symptom) => void
  onSwitchMethod: () => void
  selectedSymptom: Symptom | null
  showFeedback: boolean
}) {
  if (maxRoundsReached) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-3">
        <div>
          <p className="ui-card-title">This bean might work better with a different method</p>
          <p className="ui-body-muted mt-1 leading-relaxed">
            You&apos;ve reached the 3-round adjustment limit. Sometimes the bean profile is better served by a different brewing approach.
          </p>
        </div>
        <button onClick={onSwitchMethod} className="w-full ui-button-primary font-semibold rounded-[12px]">
          Try a Different Method
          <svg className="size-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M3 7H11M7.5 3.5L11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button onClick={onReset} className="ui-meta underline text-center">
          Reset recipe to original
        </button>
      </div>
    )
  }

  if (!showFeedback) {
    return (
      <div className="flex flex-col gap-2">
        <button onClick={onOpenFeedback} className="w-full ui-button-secondary">
          <svg className="ui-icon-inline" viewBox="0 0 16 16" fill="none">
            <path d="M8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C11.87 15 15 11.87 15 8C15 4.13 11.87 1 8 1Z" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          How did it taste?
        </button>
        {feedbackRound > 0 && (
          <button onClick={onReset} className="ui-meta underline text-center">
            Reset to original
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="ui-card-title">What was off?</p>
        <p className="ui-meta">Round {feedbackRound + 1} of 3</p>
      </div>

      <div className="flex flex-col gap-2">
        {SYMPTOM_OPTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => onSelectSymptom(option.value)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
              selectedSymptom === option.value
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'bg-[var(--background)] text-[var(--foreground)]'
            }`}
          >
            <span className="text-lg">{option.emoji}</span>
            <span className="text-sm font-medium">{option.label}</span>
          </button>
        ))}
      </div>

      {adjustError && (
        <p className="ui-body-muted ui-text-danger">{adjustError}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancelFeedback}
          className="flex-1 ui-button-secondary bg-[var(--background)] border-transparent text-[var(--muted-foreground)]"
        >
          Cancel
        </button>
        <button
          onClick={onAdjust}
          disabled={!selectedSymptom || adjusting}
          className="flex-1 ui-button-primary font-semibold disabled:opacity-40"
        >
          {adjusting ? (
            <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
          ) : (
            'Adjust'
          )}
        </button>
      </div>
    </div>
  )
}
