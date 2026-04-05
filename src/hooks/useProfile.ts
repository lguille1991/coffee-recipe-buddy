'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { GrinderId } from '@/types/recipe'

interface Profile {
  display_name: string | null
  default_volume_ml: number
  temp_unit: 'C' | 'F'
  preferred_grinder: GrinderId
}

export function useProfile() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then((data: Profile | null) => {
        if (data) setProfile(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, authLoading])

  return {
    profile,
    loading,
    preferredGrinder: (profile?.preferred_grinder ?? 'k_ultra') as GrinderId,
  }
}
