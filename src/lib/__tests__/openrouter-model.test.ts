import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('getOpenRouterModel', () => {
  it('uses a feature override before the shared default', async () => {
    vi.stubEnv('OPENROUTER_MODEL', 'openai/gpt-4.1-mini')
    vi.stubEnv('OPENROUTER_MODEL_RECIPE_GENERATION', 'anthropic/claude-3.7-sonnet')

    const { getOpenRouterModel } = await import('@/lib/openrouter-model')

    expect(getOpenRouterModel('recipe_generation')).toBe('anthropic/claude-3.7-sonnet')
  })

  it('uses the shared default when no feature override is set', async () => {
    vi.stubEnv('OPENROUTER_MODEL', 'openai/gpt-4.1-mini')

    const { getOpenRouterModel } = await import('@/lib/openrouter-model')

    expect(getOpenRouterModel('bean_extraction')).toBe('openai/gpt-4.1-mini')
  })

  it('falls back to the existing hardcoded default when no env vars are set', async () => {
    const { getOpenRouterModel } = await import('@/lib/openrouter-model')

    expect(getOpenRouterModel('auto_adjust')).toBe('google/gemini-2.5-flash')
  })

  it('treats empty env values as unset', async () => {
    vi.stubEnv('OPENROUTER_MODEL', '   ')
    vi.stubEnv('OPENROUTER_MODEL_AUTO_ADJUST', '')

    const { getOpenRouterModel } = await import('@/lib/openrouter-model')

    expect(getOpenRouterModel('auto_adjust')).toBe('google/gemini-2.5-flash')
  })
})
