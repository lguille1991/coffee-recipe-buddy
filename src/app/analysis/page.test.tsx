/** @vitest-environment jsdom */

import React from 'react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import type { ExtractionResponse } from '@/types/recipe'

const pushMock = vi.fn()
const replaceMock = vi.fn()
const backMock = vi.fn()
const setGuardMock = vi.fn()
const getExtractionResultMock = vi.fn<() => ExtractionResponse | null>()
const featureFlagMock = vi.fn(() => true)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: backMock }),
}))

vi.mock('@/components/NavGuardContext', () => ({
  useNavGuard: () => ({ setGuard: setGuardMock }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ profile: null }),
}))

vi.mock('@/lib/feature-flags', () => ({
  isSavedCoffeeProfilesEnabled: () => featureFlagMock(),
}))

vi.mock('@/lib/method-decision-engine', () => ({
  recommendMethods: () => [],
}))

vi.mock('@/lib/recipe-session-storage', () => ({
  recipeSessionStorage: {
    getExtractionResult: () => getExtractionResultMock(),
    getScannedBagImageDataUrl: () => null,
    clearSelectedCoffeeProfileId: vi.fn(),
    setSelectedBrewGoal: vi.fn(),
    setSelectedCoffeeProfileId: vi.fn(),
    clearConfirmedBean: vi.fn(),
    clearMethodRecommendations: vi.fn(),
    clearRecipeFlowSource: vi.fn(),
    clearSelectedMethod: vi.fn(),
    clearTargetVolumeMl: vi.fn(),
    clearRecipe: vi.fn(),
    clearRecipeOriginal: vi.fn(),
    clearPendingSaveRecipe: vi.fn(),
    clearFeedbackRound: vi.fn(),
    clearAdjustmentHistory: vi.fn(),
    clearExtractionResult: vi.fn(),
    clearScannedBagImageDataUrl: vi.fn(),
    clearSelectedBrewGoal: vi.fn(),
    setConfirmedBean: vi.fn(),
    setRecipeFlowSource: vi.fn(),
    setTargetVolumeMl: vi.fn(),
    setMethodRecommendations: vi.fn(),
    clearManualRecipeDraft: vi.fn(),
    getSelectedCoffeeProfileId: vi.fn(() => null),
  },
}))

import AnalysisPage from './page'

function buildExtraction(partial?: Partial<ExtractionResponse>): ExtractionResponse {
  return {
    bean: {
      bean_name: 'Test Bean',
      roaster: 'Test Roaster',
      variety: null,
      finca: null,
      producer: null,
      process: 'washed',
      origin: 'Ethiopia',
      altitude_masl: 1800,
      roast_level: 'light',
      tasting_notes: ['berry'],
      roast_date: null,
    },
    confidence: {
      origin: 0.7,
      roast_level: 0.7,
      process: 0.7,
      altitude_masl: 0.7,
    },
    ...partial,
  }
}

describe('AnalysisPage editability and validation', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.restoreAllMocks()
    pushMock.mockReset()
    replaceMock.mockReset()
    backMock.mockReset()
    setGuardMock.mockReset()
    featureFlagMock.mockReturnValue(true)
    getExtractionResultMock.mockReturnValue(buildExtraction())
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({ ok: true, json: async () => ({ profile: { id: 'p-1' } }) } as Response)

    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('renders editable cues and section hint', async () => {
    await act(async () => {
      root.render(<AnalysisPage />)
    })

    expect(container.textContent).toContain('Review and edit extracted values before continuing.')
    expect(container.textContent?.match(/Editable/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })

  it('renders full process option set with friendly labels', async () => {
    await act(async () => {
      root.render(<AnalysisPage />)
    })

    const process = container.querySelector('[data-testid="bean-process"]') as HTMLSelectElement
    const labels = Array.from(process.options).map(option => option.textContent)

    expect(labels).toEqual([
      'Washed',
      'Natural',
      'Honey',
      'Anaerobic',
      'Carbonic',
      'Thermal Shock',
      'Experimental',
      'Unknown',
    ])
  })

  it('blocks both submit paths for invalid altitude and over-limit name', async () => {
    getExtractionResultMock.mockReturnValue(buildExtraction({ bean: { ...buildExtraction().bean, altitude_masl: 250, bean_name: 'x'.repeat(151) } }))

    await act(async () => {
      root.render(<AnalysisPage />)
    })

    expect(container.textContent).toContain('Enter altitude as a whole number between 300 and 3000, or leave blank.')
    expect(container.textContent).toContain('Coffee name must be 150 characters or fewer.')

    const saveCoffee = container.querySelector('[data-testid="save-coffee-profile"]') as HTMLButtonElement
    const saveGenerate = container.querySelector('[data-testid="save-and-generate-recipe"]') as HTMLButtonElement

    await act(async () => {
      saveCoffee.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      saveGenerate.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('updates roast and process through dropdown values', async () => {
    await act(async () => {
      root.render(<AnalysisPage />)
    })

    const roast = container.querySelector('[data-testid="roast-level-input"]') as HTMLSelectElement
    const process = container.querySelector('[data-testid="bean-process"]') as HTMLSelectElement

    await act(async () => {
      roast.value = 'medium-dark'
      roast.dispatchEvent(new Event('change', { bubbles: true }))
      process.value = 'thermal_shock'
      process.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(roast.value).toBe('medium-dark')
    expect(process.value).toBe('thermal_shock')
  })
})
