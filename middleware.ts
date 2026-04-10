import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function isPublicShareGetRequest(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method.toUpperCase()

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return false
  }

  if (/^\/share\/[^/]+$/.test(pathname)) {
    return true
  }

  if (/^\/api\/share\/[^/]+$/.test(pathname)) {
    return true
  }

  if (/^\/api\/share\/[^/]+\/comments$/.test(pathname)) {
    return true
  }

  return false
}

export async function middleware(request: NextRequest) {
  if (isPublicShareGetRequest(request)) {
    return NextResponse.next({ request })
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
