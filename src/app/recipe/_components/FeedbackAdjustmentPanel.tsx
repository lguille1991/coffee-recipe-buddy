'use client'

import type {
  AdjustmentMetadata,
  GrinderId,
  RecipeWithAdjustment,
  Symptom,
} from '@/types/recipe'
import {
  RecipeDetailsPanels,
  RecipeFeedbackSection,
  RecipeGrindSettingsCard,
  RecipeParametersSection,
  StaticRecipeStepsSection,
} from './RecipeSessionSections'

interface FeedbackAdjustmentPanelProps {
  recipe: RecipeWithAdjustment
  adjustment: AdjustmentMetadata | undefined
  feedbackRound: number
  showFeedback: boolean
  selectedSymptom: Symptom | null
  adjustError: string | null
  adjusting: boolean
  maxRoundsReached: boolean
  preferredGrinder: GrinderId
  onAdjust: () => void
  onOpenFeedback: () => void
  onCancelFeedback: () => void
  onSelectSymptom: (symptom: Symptom | null) => void
  onReset: () => void
  onSwitchMethod: () => void
}

export function FeedbackAdjustmentPanel({
  recipe,
  adjustment,
  feedbackRound,
  showFeedback,
  selectedSymptom,
  adjustError,
  adjusting,
  maxRoundsReached,
  preferredGrinder,
  onAdjust,
  onOpenFeedback,
  onCancelFeedback,
  onSelectSymptom,
  onReset,
  onSwitchMethod,
}: FeedbackAdjustmentPanelProps) {
  return (
    <div className="flex-1 px-4 sm:px-6 flex flex-col gap-4 pb-24 overflow-y-auto">
      {adjustment && (
        <div className="ui-alert-warning flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="ui-card-title ui-text-warning">Adjustment {feedbackRound} of 3</p>
            <button onClick={onReset} className="ui-meta underline">
              Reset to original
            </button>
          </div>
          <p className="ui-body-muted ui-text-warning">
            {adjustment.variable_changed === 'technique'
              ? adjustment.note
              : `${adjustment.variable_changed.charAt(0).toUpperCase() + adjustment.variable_changed.slice(1)}: ${adjustment.previous_value} → ${adjustment.new_value} (${adjustment.direction})`}
          </p>
          {adjustment.note && adjustment.variable_changed !== 'technique' && (
            <p className="ui-meta ui-text-warning italic">{adjustment.note}</p>
          )}
        </div>
      )}

      <RecipeParametersSection
        adjustment={adjustment}
        preferredGrinder={preferredGrinder}
        recipe={recipe}
      />

      <RecipeGrindSettingsCard
        adjustment={adjustment}
        preferredGrinder={preferredGrinder}
        recipe={recipe}
      />

      <StaticRecipeStepsSection
        adjustment={adjustment}
        recipe={recipe}
      />

      <RecipeDetailsPanels recipe={recipe} />

      <RecipeFeedbackSection
        adjustError={adjustError}
        adjusting={adjusting}
        feedbackRound={feedbackRound}
        maxRoundsReached={maxRoundsReached}
        onAdjust={onAdjust}
        onCancelFeedback={onCancelFeedback}
        onOpenFeedback={onOpenFeedback}
        onReset={onReset}
        onSelectSymptom={onSelectSymptom}
        onSwitchMethod={onSwitchMethod}
        selectedSymptom={selectedSymptom}
        showFeedback={showFeedback}
      />
    </div>
  )
}
