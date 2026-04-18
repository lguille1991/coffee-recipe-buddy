'use client'

import { useAuthContext } from '@/components/AuthContext'

export function useProfile() {
  const { user, profile, profileLoading, refreshProfile, setProfile } = useAuthContext()

  return {
    profile,
    loading: profileLoading,
    preferredGrinder: profile?.preferred_grinder ?? 'k_ultra',
    refreshProfile,
    setProfile,
    user,
  }
}
