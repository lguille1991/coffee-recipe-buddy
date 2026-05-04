/** @vitest-environment jsdom */

import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerPushMock = vi.fn()
const routerRefreshMock = vi.fn()
const recommendMethodsMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock, refresh: routerRefreshMock }),
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: { default_volume_ml: 250 },
  }),
}))

vi.mock('@/lib/method-decision-engine', () => ({
  recommendMethods: (...args: unknown[]) => recommendMethodsMock(...args),
}))

import SavedCoffeeDetailClient from './SavedCoffeeDetailClient'

function makeProfileResponse(overrides?: Partial<{ process: string; roast_level: string }>) {
  return {
    profile: {
      id: 'coffee-1',
      label: 'Ethiopia Test Lot',
      bean_profile_json: {
        roaster: 'Luminous',
        origin: 'Ethiopia',
        process: overrides?.process ?? 'thermal_shock',
        roast_level: overrides?.roast_level ?? 'medium-light',
      },
      archived_at: null,
    },
    primary_image: null,
  }
}

function makeRecommendation(method: string, rank: number) {
  return {
    method,
    displayName: method,
    rank,
    score: 10 - rank,
    rationale: 'test',
    reasonBadges: [],
    confidence: 'high' as const,
  }
}

describe('SavedCoffeeDetailClient method grouping and labels', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    routerPushMock.mockReset()
    routerRefreshMock.mockReset()
    recommendMethodsMock.mockReset()
    recommendMethodsMock.mockImplementation((_bean, options) => {
      const goal = (options as { brewGoal?: string } | undefined)?.brewGoal
      if (goal === 'clarity') {
        return [makeRecommendation('v60', 1), makeRecommendation('origami', 2), makeRecommendation('orea_v4', 3)]
      }
      return [makeRecommendation('hario_switch', 1), makeRecommendation('kalita_wave', 2), makeRecommendation('chemex', 3)]
    })

    fetchMock = vi.spyOn(globalThis, 'fetch' as never)
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/coffee-profiles/')) {
        return { ok: true, json: async () => makeProfileResponse() } as Response
      }

      if (url === '/api/recipes/from-profile') {
        return { ok: true, json: async () => ({ recipeId: 'recipe-1' }) } as Response
      }

      if (url.endsWith('/archive') || url.endsWith('/restore')) {
        return { ok: true, json: async () => ({}) } as Response
      }

      throw new Error(`Unexpected fetch call: ${url} ${JSON.stringify(init)}`)
    })

    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('renders recommended methods first, auto-selects top recommendation once, and keeps raw values in payload', async () => {
    await act(async () => {
      root.render(<SavedCoffeeDetailClient profileId="coffee-1" />)
    })

    const methodSelect = container.querySelector('[data-testid="brew-method"]') as HTMLSelectElement
    expect(methodSelect).toBeTruthy()
    expect(methodSelect.value).toBe('hario_switch')

    const groups = Array.from(methodSelect.querySelectorAll('optgroup'))
    expect(groups.map(group => group.label)).toEqual(['Recommended methods', 'Other'])

    const recommendedValues = Array.from(groups[0].querySelectorAll('option')).map(option => option.value)
    const otherValues = Array.from(groups[1].querySelectorAll('option')).map(option => option.value)

    expect(recommendedValues).toEqual(['hario_switch', 'kalita_wave', 'chemex'])
    expect(otherValues).toEqual(['v60', 'origami', 'orea_v4', 'ceado_hoop', 'pulsar', 'aeropress'])

    methodSelect.value = 'aeropress'
    await act(async () => {
      methodSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const goalSelect = container.querySelector('[data-testid="brew-goal"]') as HTMLSelectElement
    goalSelect.value = 'clarity'
    await act(async () => {
      goalSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(methodSelect.value).toBe('aeropress')

    const generateButton = container.querySelector('[data-testid="generate-recipe"]') as HTMLButtonElement
    await act(async () => {
      generateButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const generateCall = fetchMock.mock.calls.find(call => String(call[0]) === '/api/recipes/from-profile')
    expect(generateCall).toBeTruthy()
    const init = generateCall?.[1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.method).toBe('aeropress')
    expect(body.goal).toBe('clarity')
  })

  it('formats bean process and brew goal labels in UI only', async () => {
    await act(async () => {
      root.render(<SavedCoffeeDetailClient profileId="coffee-1" />)
    })

    const processLine = container.querySelector('[data-testid="bean-process"]')
    expect(processLine?.textContent).toContain('Thermal Shock · Medium Light')

    const goalSelect = container.querySelector('[data-testid="brew-goal"]') as HTMLSelectElement
    const goalLabels = Array.from(goalSelect.querySelectorAll('option')).map(option => option.textContent)
    const goalValues = Array.from(goalSelect.querySelectorAll('option')).map(option => option.value)

    expect(goalLabels).toEqual(['Clarity', 'Balanced', 'Sweetness', 'Body', 'Forgiving'])
    expect(goalValues).toEqual(['clarity', 'balanced', 'sweetness', 'body', 'forgiving'])
  })

  it('normalizes legacy process/roast values for recommendation input', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/coffee-profiles/')) {
        return {
          ok: true,
          json: async () => makeProfileResponse({ process: 'Thermal Shock', roast_level: 'Medium-Light' }),
        } as Response
      }

      if (url === '/api/recipes/from-profile') {
        return { ok: true, json: async () => ({ recipeId: 'recipe-1' }) } as Response
      }

      if (url.endsWith('/archive') || url.endsWith('/restore')) {
        return { ok: true, json: async () => ({}) } as Response
      }

      throw new Error(`Unexpected fetch call: ${url} ${JSON.stringify(init)}`)
    })

    await act(async () => {
      root.render(<SavedCoffeeDetailClient profileId="coffee-1" />)
    })

    expect(recommendMethodsMock).toHaveBeenCalled()
    const beanArg = recommendMethodsMock.mock.calls[0]?.[0] as { process: string; roast_level: string }
    expect(beanArg.process).toBe('thermal_shock')
    expect(beanArg.roast_level).toBe('medium-light')
  })
})
