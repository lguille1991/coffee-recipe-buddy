import { randomUUID } from 'crypto'
import type { User } from '@supabase/supabase-js'
import OpenAI from 'openai'
import type { NextRequest, NextResponse } from 'next/server'
import { getAuthUserDisplayName } from '@/lib/auth-profile'

const OPENROUTER_GUEST_COOKIE = 'crp_openrouter_guest_id'
const OPENROUTER_APP_TITLE = 'Coffee Recipe Buddy'

function getAppUrl(request: Request): string {
  return (
    process.env.OPENROUTER_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(request.url).origin
  )
}

export function createOpenRouterClient(request: Request) {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': getAppUrl(request),
      'X-OpenRouter-Title': OPENROUTER_APP_TITLE,
      'X-Title': OPENROUTER_APP_TITLE,
    },
  })
}

export function buildAuthenticatedOpenRouterUserId(user: User): string {
  const displayName = getAuthUserDisplayName(user)
  const shortId = user.id.slice(0, 8)

  if (!displayName) {
    return `crp:${shortId}`
  }

  const normalizedName = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  return normalizedName
    ? `${normalizedName}:${shortId}`
    : `crp:${shortId}`
}

export function getGuestOpenRouterUserId(request: NextRequest): {
  userId: string
  newGuestId: string | null
} {
  const existingGuestId = request.cookies.get(OPENROUTER_GUEST_COOKIE)?.value
  if (existingGuestId) {
    return { userId: `guest:${existingGuestId}`, newGuestId: null }
  }

  const newGuestId = randomUUID()
  return { userId: `guest:${newGuestId}`, newGuestId }
}

export function attachGuestOpenRouterCookie(
  response: NextResponse,
  guestId: string | null,
) {
  if (!guestId) return response

  response.cookies.set(OPENROUTER_GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return response
}
