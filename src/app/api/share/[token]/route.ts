import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ token: string }> }
const SHARE_RESPONSE_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'

// ─── GET /api/share/:token ────────────────────────────────────────────────────
// Public endpoint — no auth required.
// Returns snapshot + metadata for the shared recipe.

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('shared_recipes')
    .select('share_token, title, created_at, snapshot_json')
    .eq('share_token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    shareToken: data.share_token,
    title: data.title ?? null,
    createdAt: data.created_at,
    snapshot: data.snapshot_json,
  }, {
    headers: {
      'Cache-Control': SHARE_RESPONSE_CACHE_CONTROL,
    },
  })
}
