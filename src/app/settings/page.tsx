'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { GrinderId, GRINDER_DISPLAY_NAMES } from '@/types/recipe'
import { useTheme, Theme } from '@/hooks/useTheme'

interface Profile {
  display_name: string | null
  default_volume_ml: number
  temp_unit: 'C' | 'F'
  preferred_grinder: GrinderId
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [volumeMl, setVolumeMl] = useState('250')
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C')
  const [preferredGrinder, setPreferredGrinder] = useState<GrinderId>('k_ultra')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?returnTo=/settings')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then((data: Profile | null) => {
        if (!data) return
        setProfile(data)
        setDisplayName(data.display_name ?? '')
        setVolumeMl(String(data.default_volume_ml))
        setTempUnit(data.temp_unit)
        setPreferredGrinder(data.preferred_grinder ?? 'k_ultra')
      })
      .catch(() => {})
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName || null,
          default_volume_ml: parseInt(volumeMl, 10),
          temp_unit: tempUnit,
          preferred_grinder: preferredGrinder,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/')
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="h-12" />

      <div className="px-4 sm:px-6 pb-6">
        <h1 className="ui-page-title">Settings</h1>
        {user?.email && (
          <p className="ui-body-muted mt-0.5">{user.email}</p>
        )}
      </div>

      <form onSubmit={handleSave} className="flex-1 px-4 sm:px-6 flex flex-col gap-5 pb-8">
        <div>
          <label className="ui-overline block mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Optional"
            className="ui-input"
          />
        </div>

        <div>
          <label className="ui-overline block mb-1.5">
            Temperature Unit
          </label>
          <div className="flex gap-2">
            {(['C', 'F'] as const).map(unit => (
              <button
                key={unit}
                type="button"
                onClick={() => setTempUnit(unit)}
                className={`flex-1 min-h-11 rounded-[12px] px-4 py-3 ui-button-text transition-colors ${
                  tempUnit === unit
                    ? 'bg-[var(--foreground)] text-[var(--background)]'
                    : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]'
                }`}
              >
                °{unit}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="ui-overline block mb-1.5">
            Preferred Grinder
          </label>
          <div className="flex flex-col gap-2">
            {(['k_ultra', 'q_air', 'baratza_encore_esp', 'timemore_c2'] as const).map(grinder => (
              <button
                key={grinder}
                type="button"
                onClick={() => setPreferredGrinder(grinder)}
                className={`w-full min-h-11 rounded-[12px] px-4 py-3 ui-button-text transition-colors text-left ${
                  preferredGrinder === grinder
                    ? 'bg-[var(--foreground)] text-[var(--background)]'
                    : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]'
                }`}
              >
                {GRINDER_DISPLAY_NAMES[grinder]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="ui-overline block mb-1.5">
            Appearance
          </label>
          <div className="flex gap-2">
            {(['light', 'system', 'dark'] as Theme[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`flex-1 min-h-11 rounded-[12px] px-4 py-3 ui-button-text transition-colors ${
                  theme === t
                    ? 'bg-[var(--foreground)] text-[var(--background)]'
                    : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="ui-overline block mb-1.5">
            Default Volume (ml)
          </label>
          <input
            type="number"
            value={volumeMl}
            onChange={e => setVolumeMl(e.target.value)}
            min={100}
            max={1000}
            step={10}
            className="ui-input"
          />
        </div>

        {saved && (
          <div className="ui-alert-success text-sm font-medium">
            Settings saved.
          </div>
        )}
        {error && (
          <div className="ui-alert-danger text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={saving}
            className="ui-button-primary flex-1 font-semibold"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
            ) : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="ui-button-danger flex-1"
          >
            Sign Out
          </button>
        </div>
      </form>

      <p className="ui-meta text-center pb-4">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </p>

      <div className="h-24" />
    </div>
  )
}
