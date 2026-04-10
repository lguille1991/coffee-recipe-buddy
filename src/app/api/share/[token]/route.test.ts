import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET as getShare } from './route'
import { GET as getComments } from './comments/route'

function createSingleResultQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.single.mockResolvedValue(result)

  return query
}

function createCommentsQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockResolvedValue({
    data: [
      {
        id: 'comment-1',
        share_token: 'share-token',
        author_id: 'user-1',
        body: 'Nice recipe',
        created_at: '2026-04-09T00:00:00.000Z',
        author: { display_name: 'Guillermo' },
      },
    ],
    error: null,
    count: 1,
  })

  return query
}

describe('public share route cache headers', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('sets shared-cache headers on the public share payload route', async () => {
    const sharedRecipeQuery = createSingleResultQuery({
      data: {
        share_token: 'share-token',
        title: 'Sweet and bright',
        created_at: '2026-04-09T00:00:00.000Z',
        snapshot_json: { bean_info: { bean_name: 'Test Lot' } },
      },
      error: null,
    })

    createClientMock.mockResolvedValue({
      from: vi.fn().mockReturnValue(sharedRecipeQuery),
    })

    const response = await getShare(new Request('http://localhost/api/share/share-token'), {
      params: Promise.resolve({ token: 'share-token' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    )
  })

  it('sets shared-cache headers on public share comments responses', async () => {
    const sharedRecipeQuery = createSingleResultQuery({
      data: { share_token: 'share-token' },
      error: null,
    })
    const commentsQuery = createCommentsQuery()

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'shared_recipes') return sharedRecipeQuery
        if (table === 'recipe_comments') return commentsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const response = await getComments(
      new Request('http://localhost/api/share/share-token/comments?page=1'),
      {
        params: Promise.resolve({ token: 'share-token' }),
      },
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=30, stale-while-revalidate=120',
    )
    expect(body.total).toBe(1)
    expect(body.comments).toHaveLength(1)
  })
})
