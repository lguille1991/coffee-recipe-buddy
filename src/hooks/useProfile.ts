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
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then((data: Profile | null) => {
        if (data) setProfile(data)
      })
      .catch(() => {})
      .finally(() => setLoadedUserId(user.id))
  }, [user, authLoading])

  const loading = authLoading || (!!user && loadedUserId !== user.id)
  const resolvedProfile = !user || loadedUserId !== user.id ? null : profile

  return {
    profile: resolvedProfile,
    loading,
    preferredGrinder: (resolvedProfile?.preferred_grinder ?? 'k_ultra') as GrinderId,
  }
}
