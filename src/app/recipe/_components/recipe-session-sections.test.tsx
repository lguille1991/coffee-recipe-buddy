import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BASE_RECIPE } from '@/lib/__tests__/fixtures'
import {
  BrewRecipeStepsSection,
  StaticRecipeStepsSection,
} from './RecipeSessionSections'

describe('recipe session step sections', () => {
  it('renders static brew steps on /recipe without timer controls', () => {
    const html = renderToStaticMarkup(
      <StaticRecipeStepsSection recipe={BASE_RECIPE} />,
    )

    expect(html).toContain('Brew Steps')
    expect(html).not.toContain('Start timer')
    expect(html).not.toContain('Stop timer')
  })

  it('renders timer controls and active-step progress for brew mode', () => {
    const html = renderToStaticMarkup(
      <BrewRecipeStepsSection
        activeStepIndex={1}
        elapsedSeconds={60}
        getStepProgress={index => index === 1 ? 0.5 : 0}
        onToggleTimer={() => {}}
        recipe={BASE_RECIPE}
        timerOverrun={false}
        timerRunning
      />,
    )

    expect(html).toContain('Stop timer')
    expect(html).toContain('1:00')
    expect(html).toContain('width:50%')
    expect(html).toContain('ring-2 ring-[var(--foreground)] scale-[1.01]')
  })
})
