import { afterEach, describe, expect, it, vi } from 'vitest'

const { openAIConstructorMock } = vi.hoisted(() => ({
  openAIConstructorMock: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class OpenAI {
    constructor(options: unknown) {
      openAIConstructorMock(options)
    }
  },
}))

afterEach(() => {
  vi.resetModules()
  openAIConstructorMock.mockReset()
})

describe('openrouter client', () => {
  it('sets a shared request timeout on the central OpenRouter client', async () => {
    const { createOpenRouterClient } = await import('@/lib/openrouter')

    createOpenRouterClient(new Request('https://coffee.example/api/test'))

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 8_000,
      }),
    )
  })

  it('builds readable authenticated tracking IDs with the crp prefix', async () => {
    const { buildAuthenticatedOpenRouterUserId } = await import('@/lib/openrouter')

    const user = {
      id: '12345678-1234-1234-1234-123456789abc',
      user_metadata: { full_name: 'Guillermo Abrego' },
    }

    expect(buildAuthenticatedOpenRouterUserId(user as never)).toBe(
      'crp:guillermo-abrego:12345678',
    )
  })

  it('falls back to the short user id when no display name is present', async () => {
    const { buildAuthenticatedOpenRouterUserId } = await import('@/lib/openrouter')

    const user = {
      id: '12345678-1234-1234-1234-123456789abc',
      user_metadata: {},
    }

    expect(buildAuthenticatedOpenRouterUserId(user as never)).toBe('crp:12345678')
  })
})
