'use client'

import { useState, useCallback } from 'react'
import { expectOk, runClientMutation } from '@/lib/client-mutation'

export type UseRecipeSharingOptions = {
  recipeId: string
  initialShareToken: string | null
  initialShareUrl: string
  initialCommentCount: number | null
}

export type UseRecipeSharingReturn = {
  // State
  shareToken: string | null
  shareUrl: string
  commentCount: number | null
  sharing: boolean
  revoking: boolean
  copied: boolean
  showShareSheet: boolean
  showRevokeConfirm: boolean
  actionError: string | null
  // Actions
  handleShare: () => Promise<void>
  handleRevoke: () => Promise<void>
  handleCopy: () => Promise<void>
  setShowShareSheet: (value: boolean) => void
  setShowRevokeConfirm: (value: boolean) => void
}

export function useRecipeSharing({
  recipeId,
  initialShareToken,
  initialShareUrl,
  initialCommentCount,
}: UseRecipeSharingOptions): UseRecipeSharingReturn {
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken)
  const [shareUrl, setShareUrl] = useState(initialShareUrl)
  const [commentCount, setCommentCount] = useState<number | null>(initialCommentCount)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleShare = useCallback(async () => {
    setSharing(true)
    setActionError(null)
    await runClientMutation({
      execute: async () => {
        const response = await fetch(`/api/recipes/${recipeId}/share`, { method: 'POST' })
        await expectOk(response, 'Failed to create share link')
        return response.json()
      },
      onSuccess: (data: { shareToken: string; url: string }) => {
        setShareToken(data.shareToken)
        setShareUrl(data.url)
        setCommentCount(0)
        setShowShareSheet(true)
      },
      onError: setActionError,
      onSettled: () => setSharing(false),
      errorMessage: 'Failed to create share link. Please try again.',
    })
  }, [recipeId])

  const handleRevoke = useCallback(async () => {
    setRevoking(true)
    setActionError(null)
    await runClientMutation({
      execute: async () => {
        const response = await fetch(`/api/recipes/${recipeId}/share`, { method: 'DELETE' })
        return expectOk(response, 'Failed to revoke share link')
      },
      onSuccess: () => {
        setShareToken(null)
        setShareUrl('')
        setCommentCount(null)
        setShowShareSheet(false)
        setShowRevokeConfirm(false)
      },
      onError: setActionError,
      onSettled: () => setRevoking(false),
      errorMessage: 'Failed to revoke share link. Please try again.',
    })
  }, [recipeId])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  return {
    // State
    shareToken,
    shareUrl,
    commentCount,
    sharing,
    revoking,
    copied,
    showShareSheet,
    showRevokeConfirm,
    actionError,
    // Actions
    handleShare,
    handleRevoke,
    handleCopy,
    setShowShareSheet,
    setShowRevokeConfirm,
  }
}
