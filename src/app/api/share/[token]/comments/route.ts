import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateCommentRequestSchema } from '@/types/recipe'

type Params = { params: Promise<{ token: string }> }

const PAGE_SIZE = 50

// ─── GET /api/share/:token/comments ──────────────────────────────────────────
// Public endpoint — no auth required.
// Returns paginated comments ordered by created_at ASC.
// Query params: page (1-based, default 1)

export async function GET(request: Request, { params }: Params) {
  const { token } = await params
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  // Verify share token exists
  const { data: share, error: shareError } = await supabase
    .from('shared_recipes')
    .select('share_token')
    .eq('share_token', token)
    .single()

  if (shareError || !share) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error, count } = await supabase
    .from('recipe_comments')
    .select('id, share_token, author_id, body, created_at, author:profiles!author_id(display_name)', { count: 'exact' })
    .eq('share_token', token)
    .order('created_at', { ascending: true })
    .range(from, to)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }

  const comments = (data ?? []).map(c => ({
    id: c.id,
    share_token: c.share_token,
    author_id: c.author_id,
    body: c.body,
    created_at: c.created_at,
    author_display_name: (c.author as unknown as { display_name: string | null } | null)?.display_name ?? null,
  }))

  return NextResponse.json({ comments, total: count ?? 0, page, pageSize: PAGE_SIZE })
}

// ─── POST /api/share/:token/comments ─────────────────────────────────────────
// Auth required. Inserts a new comment for the given share token.

export async function POST(request: Request, { params }: Params) {
  const { token } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateCommentRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 })
  }

  // Verify share token exists
  const { data: share, error: shareError } = await supabase
    .from('shared_recipes')
    .select('share_token')
    .eq('share_token', token)
    .single()

  if (shareError || !share) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: inserted, error } = await supabase
    .from('recipe_comments')
    .insert({ share_token: token, author_id: user.id, body: parsed.data.body })
    .select('id, share_token, author_id, body, created_at, author:profiles!author_id(display_name)')
    .single()

  if (error || !inserted) {
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }

  return NextResponse.json({
    id: inserted.id,
    share_token: inserted.share_token,
    author_id: inserted.author_id,
    body: inserted.body,
    created_at: inserted.created_at,
    author_display_name: (inserted.author as unknown as { display_name: string | null } | null)?.display_name ?? null,
  }, { status: 201 })
}
