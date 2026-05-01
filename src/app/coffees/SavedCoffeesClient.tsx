'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

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
  const [profiles, setProfiles] = useState<CoffeeProfileListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadProfiles() {
      try {
        const response = await fetch('/api/coffee-profiles?limit=50', { cache: 'no-store' })
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

    void loadProfiles()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="h-12" />
      <div className="px-4 sm:px-6 pb-4">
        <h1 className="ui-page-title">Saved Coffees</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {profiles.map(profile => (
              <Link
                key={profile.id}
                href={`/coffees/${profile.id}`}
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
                  <h2 className="ui-card-title">{profile.label}</h2>
                  <p className="ui-body-muted mt-1">
                    {profile.bean_profile_json.roaster ?? 'Unknown roaster'} · {profile.bean_profile_json.roast_level ?? 'Unknown roast'}
                  </p>
                  {profile.last_used_at && (
                    <p className="ui-meta mt-1 text-[var(--muted-foreground)]">Last used: {new Date(profile.last_used_at).toLocaleDateString()}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="h-24" />
    </div>
  )
}
