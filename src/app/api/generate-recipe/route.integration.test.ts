import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_RECIPE } from '@/lib/__tests__/fixtures'

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

function createSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '22222222-2222-2222-2222-222222222222' } },
      }),
    },
  }
}

describe('POST /api/generate-recipe (integration validator path)', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createCompletionMock.mockReset()
    createOpenRouterClientMock.mockReset()
    buildAuthenticatedOpenRouterUserIdMock.mockReset()
    attachGuestOpenRouterCookieMock.mockReset()

    createClientMock.mockResolvedValue(createSupabaseClient())
    buildAuthenticatedOpenRouterUserIdMock.mockReturnValue('crp:test-user')
    attachGuestOpenRouterCookieMock.mockImplementation((response: Response) => response)
    createOpenRouterClientMock.mockReturnValue({
      chat: {
        completions: {
          create: createCompletionMock,
        },
      },
    })
  })

  it('returns 200 with real validateRecipe after deterministic grind override', async () => {
    createCompletionMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(BASE_RECIPE) } }],
    })

    const request = new Request('http://localhost/api/generate-recipe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        method: 'v60',
        bean: {
          process: 'washed',
          roast_level: 'medium-light',
          altitude_masl: 1400,
          variety: 'Pacas',
          origin: 'El Salvador, Finca Potrerito',
          tasting_notes: ['floral', 'orange', 'honey'],
        },
      }),
    })

    const response = await POST(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.grind.k_ultra.starting_point).toBe('0.7.1')
    expect(body.grind.k_ultra.range).toBe('66–76 clicks')
    expect(body.range_logic.final_operating_range).toBe('66–76 clicks')
    expect(body.parameters.temperature_c).toBe(94)
  })

  it('returns 200 in four_six mode with real validateRecipe', async () => {
    createCompletionMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(BASE_RECIPE) } }],
    })

    const request = new Request('http://localhost/api/generate-recipe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        method: 'v60',
        recipe_mode: 'four_six',
        bean: {
          process: 'washed',
          roast_level: 'light',
          altitude_masl: 1600,
          variety: 'Gesha',
          origin: 'Panama',
          tasting_notes: ['floral', 'tea-like'],
        },
      }),
    })

    const response = await POST(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.recipe_mode).toBe('four_six')
    expect(body.parameters.coffee_g).toBe(20)
    expect(body.parameters.water_g).toBe(300)
    expect(body.parameters.ratio).toBe('1:15')
    expect(body.parameters.temperature_c).toBe(94)
    expect(body.steps).toHaveLength(5)
  })
})
