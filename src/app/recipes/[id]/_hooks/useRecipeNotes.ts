'use client'

import { useEffect, useRef, useState } from 'react'
import { expectOk, runClientMutation } from '@/lib/client-mutation'

export interface UseRecipeNotesOptions {
  recipeId: string
  initialNotes: string | null
}

export interface UseRecipeNotesReturn {
  notes: string
  notesSaving: boolean
  notesError: string | null
  handleNotesChange: (value: string) => void
}

export function useRecipeNotes({
  recipeId,
  initialNotes,
}: UseRecipeNotesOptions): UseRecipeNotesReturn {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) {
        clearTimeout(notesDebounceRef.current)
      }
    }
  }, [])

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesError(null)
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)

    notesDebounceRef.current = setTimeout(async () => {
      setNotesSaving(true)
      await runClientMutation({
        execute: async () => {
          const response = await fetch(`/api/recipes/${recipeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: value || null }),
          })
          return expectOk(response, 'Failed to save notes')
        },
        onError: setNotesError,
        onSettled: () => setNotesSaving(false),
        errorMessage: 'Failed to save notes. Please try again.',
      })
    }, 500)
  }

  return {
    notes,
    notesSaving,
    notesError,
    handleNotesChange,
  }
}
