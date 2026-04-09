import { NextResponse } from 'next/server'
import { syncProfileDisplayNameFromAuth } from '@/lib/auth-profile'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const returnTo = searchParams.get('returnTo') ?? '/'
  const pendingRecipe = searchParams.get('pendingRecipe')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      await syncProfileDisplayNameFromAuth(supabase, user)

      const redirectUrl = pendingRecipe === 'true'
        ? `${origin}/auth?returnTo=${encodeURIComponent(returnTo)}&pendingRecipe=true`
        : `${origin}${returnTo}`
      return NextResponse.redirect(redirectUrl)
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=oauth_failed`)
}
