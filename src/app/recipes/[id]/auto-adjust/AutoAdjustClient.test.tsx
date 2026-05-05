/** @vitest-environment jsdom */

import React from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'
import type { SavedRecipeDetail } from '@/types/recipe'

const replaceMock = vi.fn()
const backMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, back: backMock, push: vi.fn() }),
}))

vi.mock('@/components/NavGuardContext', () => ({
  useNavGuard: () => ({ setGuard: vi.fn(), requestNavigate: vi.fn() }),
}))

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ profile: { temp_unit: 'C', preferred_grinder: 'k_ultra' }, preferredGrinder: 'k_ultra' }),
}))

vi.mock('@/components/ConfirmSheet', () => ({
  default: () => null,
}))

import AutoAdjustClient from './AutoAdjustClient'

const SOURCE_RECIPE: SavedRecipeDetail = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: '22222222-2222-2222-2222-222222222222',
  schema_version: 1,
  bean_info: {
    ...WASHED_LIGHT_BEAN,
    bean_name: 'Timeout Bean',
  },
  method: 'v60',
  original_recipe_json: BASE_RECIPE,
  current_recipe_json: BASE_RECIPE,
  feedback_history: [],
  image_url: null,
  notes: null,
  creator_display_name: null,
  created_at: '2026-04-08T00:00:00.000Z',
  archived: false,
  live_snapshot_id: null,
  parent_recipe_id: null,
  scale_factor: null,
  coffee_profile_id: null,
  is_favorite: false,
  snapshots: [],
}

describe('AutoAdjustClient timeouts', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.restoreAllMocks()
    replaceMock.mockReset()
    backMock.mockReset()
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

  it('clears loading and shows timeout error when auto-adjust fetch aborts', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(
      ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
        const signal = init?.signal
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })) as never
    )

    await act(async () => {
      root.render(<AutoAdjustClient id={SOURCE_RECIPE.id} sourceRecipe={SOURCE_RECIPE} />)
    })

    const scaleBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('1.25x')) as HTMLButtonElement
    await act(async () => {
      scaleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const generateBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate')) as HTMLButtonElement
    await act(async () => {
      generateBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('Generating...')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })

    expect(container.textContent).toContain('Auto-adjust timed out. Please try again.')
    expect(container.textContent).not.toContain('Generating...')
  })
})
