import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { POST } from './route'

function authedSupabaseClient({ ids = [], error = null }: { ids?: string[]; error?: { message: string } | null } = {}) {
  const select = vi.fn().mockResolvedValue({
    data: ids.map(id => ({ id })),
    error,
  })
  const eqSecond = vi.fn(() => ({ select }))
  const inFn = vi.fn(() => ({ eq: eqSecond }))
  const eqFirst = vi.fn(() => ({ in: inFn }))
  const update = vi.fn(() => ({ eq: eqFirst }))

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '11111111-1111-1111-1111-111111111111' } },
      }),
    },
    from: vi.fn(() => ({ update })),
    _mocks: { update, eqFirst, inFn, eqSecond, select },
  }
}

describe('POST /api/recipes/bulk-delete', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const response = await POST(new Request('http://localhost/api/recipes/bulk-delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipe_ids: ['11111111-1111-1111-1111-111111111111'] }),
    }))

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid payload', async () => {
    createClientMock.mockResolvedValue(authedSupabaseClient())

    const response = await POST(new Request('http://localhost/api/recipes/bulk-delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipe_ids: ['not-a-uuid'] }),
    }))

    expect(response.status).toBe(400)
  })

  it('archives only matched active rows and returns archived ids plus counts', async () => {
    const supabase = authedSupabaseClient({
      ids: [
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ],
    })
    createClientMock.mockResolvedValue(supabase)

    const response = await POST(new Request('http://localhost/api/recipes/bulk-delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipe_ids: [
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          'cccccccc-cccc-cccc-cccc-cccccccccccc',
        ],
      }),
    }))

    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.archived_ids).toEqual([
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ])
    expect(payload.archived_count).toBe(2)
    expect(payload.requested_count).toBe(3)

    expect(supabase._mocks.update).toHaveBeenCalledWith({ archived: true })
    expect(supabase._mocks.eqFirst).toHaveBeenCalledWith('user_id', '11111111-1111-1111-1111-111111111111')
    expect(supabase._mocks.inFn).toHaveBeenCalledWith('id', [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ])
    expect(supabase._mocks.eqSecond).toHaveBeenCalledWith('archived', false)
  })

  it('accepts large visible selections within the configured high cap', async () => {
    const ids = Array.from({ length: 300 }, (_, index) => {
      const suffix = String(index + 1).padStart(12, '0')
      return `00000000-0000-0000-0000-${suffix}`
    })
    const supabase = authedSupabaseClient({ ids })
    createClientMock.mockResolvedValue(supabase)

    const response = await POST(new Request('http://localhost/api/recipes/bulk-delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipe_ids: ids }),
    }))

    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.requested_count).toBe(300)
    expect(payload.archived_count).toBe(300)
    expect(payload.archived_ids).toHaveLength(300)
  })
})
