import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
})

describe('NAV_ITEMS feature flag gating', () => {
  it('hides coffees nav item when saved profiles feature is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'false'
    const { NAV_ITEMS } = await import('./nav-items')
    expect(NAV_ITEMS.some(item => item.href === '/coffees')).toBe(false)
  })

  it('shows coffees nav item when saved profiles feature is enabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES = 'true'
    const { NAV_ITEMS } = await import('./nav-items')
    expect(NAV_ITEMS.some(item => item.href === '/coffees')).toBe(true)
  })
})
