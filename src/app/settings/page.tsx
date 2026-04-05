'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/hooks/useAuth'

interface Profile {
  display_name: string | null
  default_volume_ml: number
  temp_unit: 'C' | 'F'
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [volumeMl, setVolumeMl] = useState('250')
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C')
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
        <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto relative">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#333333]">Settings</h1>
        {user?.email && (
          <p className="text-xs text-[#9CA3AF] mt-0.5">{user.email}</p>
        )}
      </div>

      <form onSubmit={handleSave} className="flex-1 px-6 flex flex-col gap-5 pb-8">
        {/* Display name */}
        <div>
          <label className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wider block mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Optional"
            className="w-full bg-white border border-[#E1E2E5] rounded-[12px] px-4 py-3 text-sm text-[#333333] placeholder:text-[#9CA3AF] outline-none focus:border-[#333333] transition-colors"
          />
        </div>

        {/* Temperature unit */}
        <div>
          <label className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wider block mb-1.5">
            Temperature Unit
          </label>
          <div className="flex gap-2">
            {(['C', 'F'] as const).map(unit => (
              <button
                key={unit}
                type="button"
                onClick={() => setTempUnit(unit)}
                className={`flex-1 py-3 rounded-[12px] text-sm font-medium transition-colors ${
                  tempUnit === unit
                    ? 'bg-[#333333] text-white'
                    : 'bg-white border border-[#E1E2E5] text-[#6B6B6B]'
                }`}
              >
                °{unit}
              </button>
            ))}
          </div>
        </div>

        {/* Default volume */}
        <div>
          <label className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wider block mb-1.5">
            Default Volume (ml)
          </label>
          <input
            type="number"
            value={volumeMl}
            onChange={e => setVolumeMl(e.target.value)}
            min={100}
            max={1000}
            step={10}
            className="w-full bg-white border border-[#E1E2E5] rounded-[12px] px-4 py-3 text-sm text-[#333333] outline-none focus:border-[#333333] transition-colors"
          />
        </div>

        {/* Feedback */}
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-xs font-medium text-green-800">
            Settings saved.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#333333] text-white text-sm font-semibold rounded-[14px] py-4 active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : 'Save'}
        </button>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-3.5 text-sm font-medium text-red-500 border border-red-200 rounded-[14px] bg-white active:opacity-80"
        >
          Sign Out
        </button>
      </form>

      <div className="h-24" />
      <BottomNav />
    </div>
  )
}
