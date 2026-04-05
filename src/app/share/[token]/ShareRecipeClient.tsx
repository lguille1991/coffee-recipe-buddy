'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PublicShareResponse, METHOD_DISPLAY_NAMES, MethodId, GrinderId, GRINDER_DISPLAY_NAMES, RecipeComment } from '@/types/recipe'
import { useAuth } from '@/hooks/useAuth'

function normalizeClickSetting(value: string): string {
  return value.replace(/^clicks?\s+(\d+)$/i, '$1 clicks')
}

export default function ShareRecipeClient({ data }: { data: PublicShareResponse }) {
  const router = useRouter()
  const { user } = useAuth()
  const [cloning, setCloning] = useState(false)
  const [cloned, setCloned] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)

  // Comments state
  const [comments, setComments] = useState<RecipeComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentBody, setCommentBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  const { snapshot } = data
  const r = snapshot.current_recipe_json
  const displayName = METHOD_DISPLAY_NAMES[r.method as MethodId] ?? r.method
  const beanName = snapshot.bean_info.bean_name ?? snapshot.bean_info.origin ?? 'Unknown bean'

  // Default to K-Ultra for public view (viewer's grinder preference unknown)
  const primaryGrinder: GrinderId = 'k_ultra'
  const secondaryGrinders = (['q_air', 'baratza_encore_esp', 'timemore_c2'] as GrinderId[])
  const primaryData = r.grind[primaryGrinder]

  useEffect(() => {
    fetch(`/api/share/${data.shareToken}/comments`)
      .then(r => r.ok ? r.json() : null)
      .then(res => { if (res) setComments(res.comments) })
      .finally(() => setCommentsLoading(false))
  }, [data.shareToken])

  async function handleClone() {
    if (!user) {
      router.push(`/auth?returnTo=/share/${data.shareToken}&action=clone`)
      return
    }

    setCloning(true)
    setCloneError(null)
    try {
      const res = await fetch(`/api/share/${data.shareToken}/clone`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to clone recipe')
      const { id } = await res.json()
      setCloned(true)
      setTimeout(() => router.push(`/recipes/${id}`), 800)
    } catch {
      setCloneError('Something went wrong. Please try again.')
    } finally {
      setCloning(false)
    }
  }

  async function handlePostComment() {
    if (!user) {
      router.push(`/auth?returnTo=/share/${data.shareToken}`)
      return
    }
    if (!commentBody.trim()) return

    setPosting(true)
    setPostError(null)
    try {
      const res = await fetch(`/api/share/${data.shareToken}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody.trim() }),
      })
      if (!res.ok) throw new Error('Failed to post comment')
      const newComment: RecipeComment = await res.json()
      setComments(prev => [...prev, newComment])
      setCommentBody('')
    } catch {
      setPostError('Failed to post. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    setDeletingId(commentId)
    try {
      await fetch(`/api/share/${data.shareToken}/comments/${commentId}`, { method: 'DELETE' })
      setComments(prev => prev.filter(c => c.id !== commentId))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <button onClick={() => router.push('/')} className="p-2 -ml-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">Shared Recipe</h2>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-4 pb-28 overflow-y-auto">

        {/* Bag photo */}
        {snapshot.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshot.image_url}
            alt={beanName}
            className="w-full aspect-[4/3] rounded-2xl object-cover"
          />
        )}

        {/* Title + sharer info */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{displayName}</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{beanName}</p>
          {snapshot.bean_info.roaster && (
            <p className="text-xs text-[#9CA3AF] mt-0.5">{snapshot.bean_info.roaster}</p>
          )}
          <p className="text-xs text-[#9CA3AF] mt-1">
            Shared by{' '}
            <span className="font-medium text-[var(--muted-foreground)]">
              {snapshot.owner_display_name ?? 'a Brygg user'}
            </span>
            {' · '}
            {new Date(data.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Parameters</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: `${r.parameters.water_g}ml`, label: 'Water' },
              { value: `${r.parameters.coffee_g}g`, label: 'Coffee' },
              { value: `${r.parameters.temperature_c}°C`, label: 'Temp' },
              { value: r.parameters.total_time, label: 'Time' },
              { value: normalizeClickSetting(r.grind[primaryGrinder].starting_point), label: 'Grind' },
              { value: r.parameters.ratio, label: 'Ratio' },
            ].map(p => (
              <div key={p.label} className="rounded-xl p-3 flex flex-col items-start gap-1 bg-[var(--background)]">
                <p className="text-sm font-semibold text-[var(--foreground)]">{p.value}</p>
                <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{p.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Grinder Settings */}
        <div className="bg-[var(--card)] rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Grind Settings</h3>

          {/* Primary grinder (K-Ultra) */}
          <div className="rounded-xl p-3 mb-3 bg-[var(--foreground)] text-[var(--background)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium opacity-70">{GRINDER_DISPLAY_NAMES[primaryGrinder]}</span>
              <span className="text-[10px] opacity-50 bg-[var(--background)]/10 px-2 py-0.5 rounded-full">Primary</span>
            </div>
            <p className="text-lg font-bold">{normalizeClickSetting(primaryData.starting_point)}</p>
            <p className="text-xs opacity-60 mt-0.5">Range: {primaryData.range}</p>
            {primaryData.description && (
              <p className="text-xs opacity-50 mt-1 italic">{primaryData.description}</p>
            )}
            {primaryData.note && (
              <p className="text-xs opacity-50 mt-1 italic">{primaryData.note}</p>
            )}
          </div>

          {/* Secondary grinders */}
          {secondaryGrinders.map((grinder, i) => {
            const gdata = r.grind[grinder]
            const isLast = i === secondaryGrinders.length - 1
            return (
              <div key={grinder} className={`flex items-start justify-between py-2.5 gap-3 ${isLast ? '' : 'border-b border-[var(--border)]'}`}>
                <div>
                  <p className="text-xs font-medium text-[var(--muted-foreground)]">{GRINDER_DISPLAY_NAMES[grinder]}</p>
                  <p className="text-xs text-[#9CA3AF]">Range: {gdata.range}</p>
                  {gdata.note && (
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5 italic">{gdata.note}</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-[var(--foreground)] shrink-0">{normalizeClickSetting(gdata.starting_point)}</p>
              </div>
            )
          })}
        </div>

        {/* Brew steps */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Brew Steps</h3>
          <div className="flex flex-col gap-2">
            {r.steps.map(step => (
              <div key={step.step} className="rounded-2xl p-4 flex gap-3 bg-[var(--card)]">
                <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-xs font-bold shrink-0">
                  {step.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-[var(--foreground)]">{step.time}</p>
                    <p className="text-[10px] text-[#9CA3AF]">+{step.water_poured_g}g → {step.water_accumulated_g}g</p>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{step.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sharer's notes */}
        {snapshot.notes && (
          <div className="bg-[var(--card)] rounded-2xl px-4 py-3">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Sharer&apos;s Notes</h3>
            <p className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{snapshot.notes}</p>
          </div>
        )}

        {/* Comments */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
            Comments {!commentsLoading && comments.length > 0 && `· ${comments.length}`}
          </h3>

          {/* Comment list */}
          {commentsLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] py-2">No comments yet. Be the first!</p>
          ) : (
            <div className="flex flex-col gap-3 mb-4">
              {comments.map(comment => (
                <div key={comment.id} className="bg-[var(--card)] rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                          {comment.author_display_name ?? 'Brygg user'}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF] shrink-0">
                          {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                    </div>
                    {user && comment.author_id === user.id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deletingId === comment.id}
                        className="shrink-0 p-1 text-[#9CA3AF] active:opacity-60 disabled:opacity-40"
                        aria-label="Delete comment"
                      >
                        {deletingId === comment.id ? (
                          <div className="w-3.5 h-3.5 border border-[#9CA3AF] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 3.5H12M4.5 3.5V2.5C4.5 2.22 4.72 2 5 2H9C9.28 2 9.5 2.22 9.5 2.5V3.5M5.5 6.5V10.5M8.5 6.5V10.5M3.5 3.5L4 11.5H10L10.5 3.5H3.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment input */}
          {user ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={commentInputRef}
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                maxLength={500}
                placeholder="Add a comment…"
                rows={2}
                className="w-full rounded-xl px-3 py-2.5 text-xs text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/20"
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#9CA3AF]">{commentBody.length}/500</p>
                <button
                  onClick={handlePostComment}
                  disabled={posting || !commentBody.trim()}
                  className="px-4 py-1.5 bg-[var(--foreground)] text-[var(--background)] text-xs font-semibold rounded-[10px] active:opacity-80 disabled:opacity-40 flex items-center gap-1.5"
                >
                  {posting ? (
                    <div className="w-3 h-3 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                  ) : 'Post'}
                </button>
              </div>
              {postError && <p className="text-xs text-red-500">{postError}</p>}
            </div>
          ) : (
            <button
              onClick={() => router.push(`/auth?returnTo=/share/${data.shareToken}`)}
              className="w-full py-3 rounded-xl border border-[var(--border)] text-xs text-[var(--muted-foreground)] active:opacity-60"
            >
              Sign in to comment
            </button>
          )}
        </div>

      </div>

      {/* Sticky Clone CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 pb-8 pt-3 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/90 to-transparent">
        {cloneError && (
          <p className="text-xs text-red-500 text-center mb-2">{cloneError}</p>
        )}
        <button
          onClick={handleClone}
          disabled={cloning || cloned}
          className="w-full flex items-center justify-center gap-2 bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold rounded-[14px] py-4 active:opacity-80 transition-opacity disabled:opacity-60"
        >
          {cloning ? (
            <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
          ) : cloned ? (
            'Added to your library!'
          ) : user ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M5.5 2H10.5C10.78 2 11 2.22 11 2.5V4H5V2.5C5 2.22 5.22 2 5.5 2ZM3 4V13.5C3 13.78 3.22 14 3.5 14H12.5C12.78 14 13 13.78 13 13.5V4H3ZM8 6.5V11.5M5.5 9H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save to My Library
            </>
          ) : (
            'Sign in to Save'
          )}
        </button>
      </div>
    </div>
  )
}
