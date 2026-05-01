import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_RECIPE } from '@/lib/__tests__/fixtures'

const {
  createClientMock,
  createCompletionMock,
  createOpenRouterClientMock,
  buildAuthenticatedOpenRouterUserIdMock,
  attachGuestOpenRouterCookieMock,
  validateRecipeMock,
  buildRetryPromptMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createCompletionMock: vi.fn(),
  createOpenRouterClientMock: vi.fn(),
  buildAuthenticatedOpenRouterUserIdMock: vi.fn(),
  attachGuestOpenRouterCookieMock: vi.fn(),
  validateRecipeMock: vi.fn(),
  buildRetryPromptMock: vi.fn(),
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

vi.mock('@/lib/recipe-validator', () => ({
  validateRecipe: validateRecipeMock,
  buildRetryPrompt: buildRetryPromptMock,
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

describe('POST /api/generate-recipe', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createCompletionMock.mockReset()
    createOpenRouterClientMock.mockReset()
    buildAuthenticatedOpenRouterUserIdMock.mockReset()
    attachGuestOpenRouterCookieMock.mockReset()
    validateRecipeMock.mockReset()
    buildRetryPromptMock.mockReset()

    createClientMock.mockResolvedValue(createSupabaseClient())
    buildAuthenticatedOpenRouterUserIdMock.mockReturnValue('crp:test-user')
    attachGuestOpenRouterCookieMock.mockImplementation((response: Response) => response)
    validateRecipeMock.mockReturnValue({ valid: true, errors: [] })
    buildRetryPromptMock.mockReturnValue('retry')
    createOpenRouterClientMock.mockReturnValue({
      chat: {
        completions: {
          create: createCompletionMock,
        },
      },
    })
  })

  it('overrides model grind output with deterministic skill grind settings for a Pacas washed profile', async () => {
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
    expect(body.grind.k_ultra.starting_point).not.toBe(BASE_RECIPE.grind.k_ultra.starting_point)
  })

  it('supports recipe_mode=four_six with deterministic 4:6 output structure', async () => {
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
    expect(body.steps).toHaveLength(5)
  })

  it('returns 422 when deterministic override fails post-validation', async () => {
    validateRecipeMock
      .mockReturnValueOnce({ valid: true, errors: [] })
      .mockReturnValueOnce({ valid: false, errors: ['range_logic.final_operating_range invalid'] })

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

    expect(response.status).toBe(422)
    expect(body.error).toBe('Deterministic grind override failed validation')
    expect(body.validationErrors).toContain('range_logic.final_operating_range invalid')
  })
})
