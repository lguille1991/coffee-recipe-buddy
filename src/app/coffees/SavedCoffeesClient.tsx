'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import ConfirmSheet from '@/components/ConfirmSheet'

type CoffeeProfileListItem = {
  id: string
  label: string
  bean_profile_json: {
    roaster?: string | null
    roast_level?: string | null
  }
  last_used_at: string | null
  primary_image: {
    id: string
    signed_url: string | null
  } | null
}

export default function SavedCoffeesClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const archived = searchParams.get('archived') === 'true'
  const [profiles, setProfiles] = useState<CoffeeProfileListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showActionConfirm, setShowActionConfirm] = useState(false)
  const [bulkMutating, setBulkMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const initialViewportHeightRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true

    async function loadProfiles() {
      try {
        const response = await fetch(`/api/coffee-profiles?limit=50${archived ? '&archived=true' : ''}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load saved coffees')
        const data = await response.json() as { profiles?: CoffeeProfileListItem[] }
        if (active) setProfiles(data.profiles ?? [])
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load saved coffees')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    void loadProfiles()
    return () => {
      active = false
    }
  }, [archived])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const viewport = window.visualViewport

    if (initialViewportHeightRef.current === null) {
      initialViewportHeightRef.current = viewport.height
    }

    const handleViewportResize = () => {
      const baselineHeight = initialViewportHeightRef.current ?? viewport.height
      const open = baselineHeight - viewport.height > 120
      setKeyboardOpen(open)
    }

    viewport.addEventListener('resize', handleViewportResize)
    handleViewportResize()

    return () => viewport.removeEventListener('resize', handleViewportResize)
  }, [])

  function handleArchivedToggle(nextArchived: boolean) {
    setSelectionMode(false)
    setSelectedIds(new Set())
    const params = new URLSearchParams(searchParams.toString())
    if (nextArchived) params.set('archived', 'true')
    else params.delete('archived')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function toggleSelectionMode() {
    setSelectionMode(prev => !prev)
    setSelectedIds(new Set())
    setError(null)
  }

  function toggleProfileSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectVisible() {
    setSelectedIds(new Set(profiles.map(profile => profile.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function confirmBulkAction() {
    if (selectedIds.size === 0) return
    setBulkMutating(true)
    setError(null)
    const endpoint = archived ? '/api/coffee-profiles/bulk-restore' : '/api/coffee-profiles/bulk-archive'
    const successKey = archived ? 'restored_ids' : 'archived_ids'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile_ids: Array.from(selectedIds) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? `Failed to ${archived ? 'restore' : 'archive'} selected profiles`)

      const affectedIds = new Set((data?.[successKey] ?? []) as string[])
      setProfiles(prev => prev.filter(profile => !affectedIds.has(profile.id)))
      setSelectionMode(false)
      setSelectedIds(new Set())
      setShowActionConfirm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${archived ? 'restore' : 'archive'} selected profiles`)
    } finally {
      setBulkMutating(false)
    }
  }

  return (
    <div className="ui-page-shell">
      <div className="ui-top-spacer" />
      <div className="px-4 sm:px-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="ui-page-title">Saved Coffees</h1>
          <button
            type="button"
            onClick={toggleSelectionMode}
            data-testid="toggle-coffee-selection-mode"
            className="ui-button-secondary px-4 py-2 text-sm"
          >
            {selectionMode ? 'Done' : 'Select'}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 mb-4">
        <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden" role="group" aria-label="Coffee status">
          <button
            type="button"
            data-testid="coffee-status-active"
            className={`min-h-11 px-4 py-2 text-sm ${!archived ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--card)] text-[var(--muted-foreground)]'}`}
            onClick={() => handleArchivedToggle(false)}
            aria-pressed={!archived}
          >
            Active
          </button>
          <button
            type="button"
            data-testid="coffee-status-archived"
            className={`min-h-11 px-4 py-2 text-sm ${archived ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--card)] text-[var(--muted-foreground)]'}`}
            onClick={() => handleArchivedToggle(true)}
            aria-pressed={archived}
          >
            Archived
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 pb-8">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="ui-card-interactive bg-[var(--card)] rounded-2xl p-5 text-center">
            <p className="ui-body-muted">{error}</p>
          </div>
        )}

        {!loading && !error && profiles.length === 0 && (
          <div className="ui-card-interactive bg-[var(--card)] rounded-2xl p-6 text-center">
            <p className="ui-body-muted">No saved coffees yet.</p>
            <Link href="/scan" className="ui-meta text-[var(--foreground)] font-medium underline mt-2 block">
              Scan your first bag
            </Link>
          </div>
        )}

        {!loading && !error && profiles.length > 0 && (
          <>
            {selectionMode && (
              <div className="mb-3 flex items-center justify-between">
                <div className="ui-meta">
                  {selectedIds.size} selected
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectVisible}
                    data-testid="select-all-visible-coffees"
                    className="ui-button-secondary px-3 py-1.5 text-sm"
                  >
                    Select all visible
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    data-testid="clear-coffee-selection"
                    className="ui-button-secondary px-3 py-1.5 text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ${selectionMode ? 'pb-44' : ''}`}>
            {profiles.map(profile => (
              <div key={profile.id} className="space-y-2">
                {selectionMode ? (
                  <button
                    type="button"
                    onClick={() => toggleProfileSelected(profile.id)}
                    data-testid={`select-coffee-${profile.id}`}
                    className={`ui-card-interactive w-full rounded-2xl p-4 flex flex-col gap-3 text-left border-2 ${
                      selectedIds.has(profile.id)
                        ? 'border-[var(--foreground)] bg-[var(--card)]'
                        : 'border-transparent bg-[var(--card)]'
                    }`}
                  >
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-[var(--surface-strong)]">
                      {profile.primary_image?.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.primary_image.signed_url} alt={profile.label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center ui-body-muted">No image</div>
                      )}
                    </div>
                    <div>
                      <h2 className="ui-card-title" data-testid={`coffee-name-${profile.id}`}>{profile.label}</h2>
                      <p className="ui-body-muted mt-1" data-testid={`roaster-${profile.id}`}>
                        {profile.bean_profile_json.roaster ?? 'Unknown roaster'} · {profile.bean_profile_json.roast_level ?? 'Unknown roast'}
                      </p>
                      {profile.last_used_at && (
                        <p className="ui-meta mt-1 text-[var(--muted-foreground)]">Last used: {new Date(profile.last_used_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </button>
                ) : (
                  <Link
                    href={`/coffees/${profile.id}`}
                    data-testid={`open-coffee-${profile.id}`}
                    className="ui-card-interactive bg-[var(--card)] rounded-2xl p-4 flex flex-col gap-3"
                  >
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-[var(--surface-strong)]">
                      {profile.primary_image?.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.primary_image.signed_url} alt={profile.label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center ui-body-muted">No image</div>
                      )}
                    </div>
                    <div>
                      <h2 className="ui-card-title" data-testid={`coffee-name-${profile.id}`}>{profile.label}</h2>
                      <p className="ui-body-muted mt-1" data-testid={`roaster-${profile.id}`}>
                        {profile.bean_profile_json.roaster ?? 'Unknown roaster'} · {profile.bean_profile_json.roast_level ?? 'Unknown roast'}
                      </p>
                      {profile.last_used_at && (
                        <p className="ui-meta mt-1 text-[var(--muted-foreground)]">Last used: {new Date(profile.last_used_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </Link>
                )}
              </div>
            ))}
            </div>
          </>
        )}
      </div>

      {selectionMode && profiles.length > 0 && !keyboardOpen && (
        <div className="ui-floating-safe-bottom fixed inset-x-0 z-20 px-4 sm:px-6 lg:pl-56">
          <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-lg">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowActionConfirm(true)}
                data-testid="bulk-coffee-action"
                disabled={selectedIds.size === 0 || bulkMutating}
                className={`${archived ? 'ui-button-primary' : 'ui-button-danger-solid'} w-full disabled:opacity-40`}
              >
                {archived ? `Restore (${selectedIds.size})` : `Archive (${selectedIds.size})`}
              </button>
              <button
                type="button"
                onClick={toggleSelectionMode}
                data-testid="cancel-coffee-selection-mode"
                disabled={bulkMutating}
                className="ui-button-secondary w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={showActionConfirm}
        title={archived
          ? `Restore ${selectedIds.size} coffee bag${selectedIds.size === 1 ? '' : 's'}?`
          : `Archive ${selectedIds.size} coffee bag${selectedIds.size === 1 ? '' : 's'}?`}
        message={archived
          ? 'This will restore selected coffee bags back to your active list.'
          : 'This will archive selected coffee bags and hide them from your active list.'}
        confirmLabel={archived ? `Restore ${selectedIds.size}` : `Archive ${selectedIds.size}`}
        destructive={!archived}
        loading={bulkMutating}
        onConfirm={confirmBulkAction}
        onCancel={() => setShowActionConfirm(false)}
      />

      <div className="ui-bottom-spacer" />
    </div>
  )
}
