/** @vitest-environment jsdom */

import React from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import type { MethodRecommendation } from '@/types/recipe'

const {
  pushMock,
  replaceMock,
  backMock,
  routerMock,
  sampleRecs,
  storageMock,
} = vi.hoisted(() => {
  const pushMock = vi.fn()
  const replaceMock = vi.fn()
  const backMock = vi.fn()
  const routerMock = { push: pushMock, replace: replaceMock, back: backMock }

  const sampleRecs: MethodRecommendation[] = [
    {
      method: 'v60',
      displayName: 'V60',
      rank: 1,
      score: 0.9,
      rationale: 'Balanced extraction',
      reasonBadges: ['clarity'],
      confidence: 'high',
      confidenceNote: 'Good pick',
    },
  ]

  const storageMock = {
    getMethodRecommendations: vi.fn(() => sampleRecs),
    shouldRestoreMethodSelection: vi.fn(() => false),
    clearRestoreMethodSelection: vi.fn(),
    getSelectedMethod: vi.fn(() => null),
    getRecipeFlowSource: vi.fn(() => 'generated' as const),
    getConfirmedBean: vi.fn(() => ({ bean_name: 'Bean', process: 'washed', roast_level: 'light' })),
    getTargetVolumeMl: vi.fn(() => 250),
    getSelectedCoffeeProfileId: vi.fn(() => 'profile-1'),
    getSelectedBrewGoal: vi.fn(() => 'balanced' as const),
    setRecipe: vi.fn(),
    setRecipeFlowSource: vi.fn(),
    clearManualRecipeDraft: vi.fn(),
    clearRecipeOriginal: vi.fn(),
    clearFeedbackRound: vi.fn(),
    clearAdjustmentHistory: vi.fn(),
    setSelectedMethod: vi.fn(),
    setRestoreMethodSelection: vi.fn(),
    clearSelectedCoffeeProfileId: vi.fn(),
    clearSelectedBrewGoal: vi.fn(),
    setManualRecipeDraft: vi.fn(),
    clearRecipe: vi.fn(),
    clearManualEditHistory: vi.fn(),
  }

  return {
    pushMock,
    replaceMock,
    backMock,
    routerMock,
    sampleRecs,
    storageMock,
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}))

vi.mock('@/lib/recipe-session-storage', () => ({
  recipeSessionStorage: storageMock,
}))

vi.mock('@/lib/manual-recipe', () => ({
  createManualRecipeDraft: vi.fn(() => ({ steps: [] })),
}))

import MethodsPage from './page'

describe('MethodsPage generation safeguards', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.restoreAllMocks()
    pushMock.mockReset()
    replaceMock.mockReset()
    backMock.mockReset()

    Object.values(storageMock).forEach(value => {
      if (typeof value === 'function' && 'mockReset' in value) value.mockReset()
    })

    storageMock.getMethodRecommendations.mockReturnValue(sampleRecs)
    storageMock.shouldRestoreMethodSelection.mockReturnValue(false)
    storageMock.getRecipeFlowSource.mockReturnValue('generated')
    storageMock.getConfirmedBean.mockReturnValue({ bean_name: 'Bean', process: 'washed', roast_level: 'light' })
    storageMock.getSelectedCoffeeProfileId.mockReturnValue('profile-1')

    vi.useFakeTimers()

    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('uses /api/generate-recipe when no selected coffee profile id exists', async () => {
    storageMock.getSelectedCoffeeProfileId.mockReturnValue(null)

    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({ ok: true, json: async () => ({ recipe_name: 'ok' }) } as Response)

    await act(async () => {
      root.render(<MethodsPage />)
    })

    const pickButton = Array.from(container.querySelectorAll('button[aria-pressed]'))[0] as HTMLButtonElement
    await act(async () => {
      pickButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const continueBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Continue with')) as HTMLButtonElement
    await act(async () => {
      continueBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/generate-recipe', expect.objectContaining({ method: 'POST' }))
  })

  it('shows unknown-outcome timeout recovery with check recipes action', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(
      ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
        const signal = init?.signal
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })) as never
    )

    await act(async () => {
      root.render(<MethodsPage />)
    })

    const pickButton = Array.from(container.querySelectorAll('button[aria-pressed]'))[0] as HTMLButtonElement
    await act(async () => {
      pickButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const continueBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Continue with')) as HTMLButtonElement
    await act(async () => {
      continueBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      vi.advanceTimersByTime(13000)
    })

    expect(container.textContent).toContain('may still finish in the background')

    const checkRecipesBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Check Recipes')) as HTMLButtonElement
    await act(async () => {
      checkRecipesBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(pushMock).toHaveBeenCalledWith('/recipes')
  })

  it('does not show check recipes for timeout on session-only generation branch', async () => {
    storageMock.getSelectedCoffeeProfileId.mockReturnValue(null)
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(
      ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
        const signal = init?.signal
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })) as never
    )

    await act(async () => {
      root.render(<MethodsPage />)
    })

    const pickButton = Array.from(container.querySelectorAll('button[aria-pressed]'))[0] as HTMLButtonElement
    await act(async () => {
      pickButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const continueBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Continue with')) as HTMLButtonElement
    await act(async () => {
      continueBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      vi.advanceTimersByTime(13000)
    })

    expect(container.textContent).toContain('timed out before this session could load your recipe')
    const checkRecipesBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Check Recipes'))
    expect(checkRecipesBtn).toBeUndefined()
  })

  it('retries generation from timeout recovery', async () => {
    let attempt = 0
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(async () => {
      attempt += 1
      if (attempt === 1) {
        throw new DOMException('Aborted', 'AbortError')
      }
      return { ok: true, json: async () => ({ recipe: { id: 'r1' }, recipeId: 'recipe-1' }) } as Response
    })

    await act(async () => {
      root.render(<MethodsPage />)
    })

    const pickButton = Array.from(container.querySelectorAll('button[aria-pressed]'))[0] as HTMLButtonElement
    await act(async () => {
      pickButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const continueBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Continue with')) as HTMLButtonElement
    await act(async () => {
      continueBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const retryBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Retry')) as HTMLButtonElement
    await act(async () => {
      retryBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(pushMock).toHaveBeenCalledWith('/recipes/recipe-1')
  })

  it('disables back navigation while generation is in flight', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(
      () => new Promise(() => {}) as Promise<Response>
    )

    await act(async () => {
      root.render(<MethodsPage />)
    })

    const pickButton = Array.from(container.querySelectorAll('button[aria-pressed]'))[0] as HTMLButtonElement
    await act(async () => {
      pickButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const continueBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Continue with')) as HTMLButtonElement
    await act(async () => {
      continueBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const backBtn = container.querySelector('button[aria-label="Go back"]') as HTMLButtonElement
    await act(async () => {
      backBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(backMock).not.toHaveBeenCalled()
  })
})
