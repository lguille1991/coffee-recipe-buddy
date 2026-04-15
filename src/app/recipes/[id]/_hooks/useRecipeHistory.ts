'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { runClientMutation } from '@/lib/client-mutation'
import type { SavedRecipeDetail } from '@/types/recipe'

export type UseRecipeHistoryOptions = {
  recipeId: string
  recipe: SavedRecipeDetail
  onRecipeUpdate: (recipe: SavedRecipeDetail) => void
}

export type UseRecipeHistoryReturn = {
  // State
  showEditHistorySheet: boolean
  selectedSnapshotIndex: number
  selectedSnapshot: SavedRecipeDetail['snapshots'][number] | null
  isSavingSnapshotAsNew: boolean
  isUsingSnapshotVersion: boolean
  actionError: string | null

  // Actions
  setShowEditHistorySheet: (show: boolean) => void
  handleNavigateSnapshot: (direction: 'prev' | 'next') => void
  handleSaveSnapshotAsNew: () => Promise<void>
  handleUseSnapshotVersion: () => Promise<void>
}

export function useRecipeHistory({
  recipeId,
  recipe,
  onRecipeUpdate,
}: UseRecipeHistoryOptions): UseRecipeHistoryReturn {
  const router = useRouter()

  const [showEditHistorySheet, setShowEditHistorySheet] = useState(false)
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState(0)
  const [isSavingSnapshotAsNew, setIsSavingSnapshotAsNew] = useState(false)
  const [isUsingSnapshotVersion, setIsUsingSnapshotVersion] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const snapshots = recipe.snapshots

  // Determine the live snapshot index (currently active version)
  const liveSnapshotIndex = useMemo(() => {
    if (!recipe.live_snapshot_id) return Math.max(snapshots.length - 1, 0)
    const index = snapshots.findIndex(
      (snapshot) => snapshot.id === recipe.live_snapshot_id
    )
    return index >= 0 ? index : Math.max(snapshots.length - 1, 0)
  }, [recipe.live_snapshot_id, snapshots])

  // Derive the currently selected snapshot
  const selectedSnapshot = snapshots[selectedSnapshotIndex] ?? null

  // Sync selectedSnapshotIndex to liveSnapshotIndex when opening the sheet
  useEffect(() => {
    if (showEditHistorySheet) {
      setSelectedSnapshotIndex(liveSnapshotIndex)
    }
  }, [liveSnapshotIndex, showEditHistorySheet])

  // Navigate between snapshots (prev/next)
  const handleNavigateSnapshot = useCallback(
    (direction: 'prev' | 'next') => {
      setSelectedSnapshotIndex((currentIndex) => {
        if (direction === 'prev') {
          return Math.max(0, currentIndex - 1)
        }
        return Math.min(snapshots.length - 1, currentIndex + 1)
      })
    },
    [snapshots.length]
  )

  // Save the selected snapshot as a new recipe
  const handleSaveSnapshotAsNew = useCallback(async () => {
    if (!selectedSnapshot) return

    await runClientMutation({
      execute: async () => {
        setIsSavingSnapshotAsNew(true)
        setActionError(null)

        const response = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: selectedSnapshot.snapshot_recipe_json.method,
            bean_info: recipe.bean_info,
            original_recipe_json: selectedSnapshot.snapshot_recipe_json,
            current_recipe_json: selectedSnapshot.snapshot_recipe_json,
            feedback_history: [],
            parent_recipe_id: recipeId,
            scale_factor: recipe.scale_factor ?? null,
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to save snapshot')
        }

        return data
      },
      onSuccess: (data: { id: string }) => {
        router.push(`/recipes/${data.id}`)
      },
      onError: (message) => {
        setActionError(message)
      },
      onSettled: () => {
        setIsSavingSnapshotAsNew(false)
      },
      errorMessage: 'Failed to save snapshot. Please try again.',
    })
  }, [selectedSnapshot, recipe.bean_info, recipe.scale_factor, recipeId, router])

  // Switch to the selected snapshot version
  const handleUseSnapshotVersion = useCallback(async () => {
    if (!selectedSnapshot || selectedSnapshot.id === recipe.live_snapshot_id) {
      return
    }

    await runClientMutation({
      execute: async () => {
        setIsUsingSnapshotVersion(true)
        setActionError(null)

        const response = await fetch(`/api/recipes/${recipeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            live_snapshot_id: selectedSnapshot.id,
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to switch recipe version')
        }

        return data as SavedRecipeDetail
      },
      onSuccess: (updatedRecipe) => {
        onRecipeUpdate(updatedRecipe)
        setShowEditHistorySheet(false)
      },
      onError: (message) => {
        setActionError(message)
      },
      onSettled: () => {
        setIsUsingSnapshotVersion(false)
      },
      errorMessage: 'Failed to switch recipe version. Please try again.',
    })
  }, [selectedSnapshot, recipe.live_snapshot_id, recipeId, onRecipeUpdate])

  return {
    // State
    showEditHistorySheet,
    selectedSnapshotIndex,
    selectedSnapshot,
    isSavingSnapshotAsNew,
    isUsingSnapshotVersion,
    actionError,

    // Actions
    setShowEditHistorySheet,
    handleNavigateSnapshot,
    handleSaveSnapshotAsNew,
    handleUseSnapshotVersion,
  }
}
