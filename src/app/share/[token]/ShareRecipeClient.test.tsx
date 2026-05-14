/** @vitest-environment jsdom */

import React from 'react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import type { PublicShareResponse } from '@/types/recipe'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'

const routerPushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '11111111-1111-1111-1111-111111111111' } }),
}))

import ShareRecipeClient from './ShareRecipeClient'

const SHARE_DATA: PublicShareResponse = {
  shareToken: 'share-token',
  title: 'Bright and sweet',
  createdAt: '2026-05-14T00:00:00.000Z',
  snapshot: {
    bean_info: {
      ...WASHED_LIGHT_BEAN,
      bean_name: 'Ethiopia Worka',
      roaster: 'Luminous',
      origin: 'Ethiopia',
    },
    current_recipe_json: BASE_RECIPE,
    image_url: null,
    owner_display_name: 'Sharer',
    notes: 'Tasty.',
  },
}

describe('ShareRecipeClient mobile footer layout', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    routerPushMock.mockReset()
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [] }),
    } as Response)

    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('uses the shared mobile-safe bottom offset for the save CTA and page body', async () => {
    await act(async () => {
      root.render(<ShareRecipeClient data={SHARE_DATA} />)
    })

    const scrollRegion = container.querySelector('[data-testid="share-recipe-scroll-region"]')
    const ctaWrapper = container.querySelector('[data-testid="share-recipe-cta-wrapper"]')

    expect(scrollRegion?.className).toContain('pb-[calc(var(--mobile-nav-reserved-space)+5.5rem)]')
    expect(ctaWrapper?.className).toContain('fixed')
    expect(ctaWrapper?.className).toContain('bottom-0')
    expect(ctaWrapper?.className).toContain('left-0')
    expect(ctaWrapper?.className).toContain('right-0')
  })

  it('matches the recipe detail footer width contract on larger screens', async () => {
    await act(async () => {
      root.render(<ShareRecipeClient data={SHARE_DATA} />)
    })

    const scrollRegion = container.querySelector('[data-testid="share-recipe-scroll-region"]')
    const ctaShell = container.querySelector('[data-testid="share-recipe-cta-shell"]')

    expect(scrollRegion?.className).toContain('md:max-w-2xl')
    expect(scrollRegion?.className).toContain('md:mx-auto')
    expect(scrollRegion?.className).toContain('lg:max-w-3xl')
    expect(scrollRegion?.className).toContain('xl:max-w-5xl')
    expect(scrollRegion?.className).toContain('xl:px-8')
    expect(ctaShell?.className).toContain('ui-sticky-footer')
    expect(ctaShell?.className).toContain('px-4')
    expect(ctaShell?.className).toContain('sm:px-6')
    expect(ctaShell?.className).toContain('md:max-w-2xl')
    expect(ctaShell?.className).toContain('md:mx-auto')
    expect(ctaShell?.className).toContain('lg:max-w-3xl')
    expect(ctaShell?.className).toContain('xl:max-w-5xl')
    expect(ctaShell?.className).toContain('xl:px-8')
    expect(ctaShell?.className).toContain('pb-[calc(env(safe-area-inset-bottom)+5.5rem)]')
  })
})
