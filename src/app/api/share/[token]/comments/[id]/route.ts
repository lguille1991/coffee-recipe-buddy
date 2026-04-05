import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ token: string; id: string }> }

// ─── DELETE /api/share/:token/comments/:id ────────────────────────────────────
// Auth required. Authors can delete only their own comments.
// RLS enforces ownership; we also check in-route for a clear 403 response.

export async function DELETE(_request: Request, { params }: Params) {
  const { token, id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch comment to verify ownership before delete
  const { data: comment, error: fetchError } = await supabase
    .from('recipe_comments')
    .select('author_id')
    .eq('id', id)
    .eq('share_token', token)
    .single()

  if (fetchError || !comment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (comment.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('recipe_comments')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
