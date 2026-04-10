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
        timeout: 45_000,
      }),
    )
  })
})
