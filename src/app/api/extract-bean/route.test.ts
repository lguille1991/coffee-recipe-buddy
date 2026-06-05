import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClientMock,
  createCompletionMock,
  createOpenRouterClientMock,
  buildAuthenticatedOpenRouterUserIdMock,
  attachGuestOpenRouterCookieMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createCompletionMock: vi.fn(),
  createOpenRouterClientMock: vi.fn(),
  buildAuthenticatedOpenRouterUserIdMock: vi.fn(),
  attachGuestOpenRouterCookieMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/openrouter', () => ({
  createOpenRouterClient: createOpenRouterClientMock,
  buildAuthenticatedOpenRouterUserId: buildAuthenticatedOpenRouterUserIdMock,
  getGuestOpenRouterUserId: vi.fn(),
  attachGuestOpenRouterCookie: attachGuestOpenRouterCookieMock,
}))

import { POST } from './route'

describe('POST /api/extract-bean', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createCompletionMock.mockReset()
    createOpenRouterClientMock.mockReset()
    buildAuthenticatedOpenRouterUserIdMock.mockReset()
    attachGuestOpenRouterCookieMock.mockReset()
    vi.unstubAllEnvs()

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: '22222222-2222-2222-2222-222222222222' } },
        }),
      },
    })
    createOpenRouterClientMock.mockReturnValue({
      chat: {
        completions: {
          create: createCompletionMock,
        },
      },
    })
    buildAuthenticatedOpenRouterUserIdMock.mockReturnValue('crp:test-user')
    attachGuestOpenRouterCookieMock.mockImplementation((response: Response) => response)
  })

  it('uses the bean extraction model override when configured', async () => {
    vi.stubEnv('OPENROUTER_MODEL_BEAN_EXTRACTION', 'openai/gpt-4.1-mini')
    createCompletionMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            bean: {
              bean_name: 'Test Lot',
              roaster: 'Test Roaster',
              variety: 'Pacas',
              finca: 'Finca Test',
              producer: 'Producer Test',
              process: 'washed',
              origin: 'El Salvador',
              altitude_masl: 1400,
              roast_level: 'light',
              tasting_notes: ['citrus'],
              roast_date: '2026-06-01',
            },
            confidence: { bean_name: 0.98 },
          }),
        },
      }],
    })

    const formData = new FormData()
    formData.set('image', new File(['fake-image'], 'bag.jpg', { type: 'image/jpeg' }))

    const response = await POST(new Request('http://localhost/api/extract-bean', {
      method: 'POST',
      body: formData,
    }) as never)

    expect(response.status).toBe(200)
    expect(createCompletionMock).toHaveBeenCalledWith(expect.objectContaining({
      model: 'openai/gpt-4.1-mini',
    }))
  })
})
