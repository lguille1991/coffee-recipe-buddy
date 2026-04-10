'use client'

import { useAuthContext } from '@/components/AuthContext'

export function useProfile() {
  const { user, profile, loading, refreshProfile, setProfile } = useAuthContext()

  return {
    profile,
    loading,
    preferredGrinder: profile?.preferred_grinder ?? 'k_ultra',
    refreshProfile,
    setProfile,
    user,
  }
}
