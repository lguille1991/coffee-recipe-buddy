'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types/recipe'

type AuthContextValue = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<UserProfile | null>
  setProfile: (profile: UserProfile | null) => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => null,
  setProfile: () => {},
})

async function fetchProfile() {
  const response = await fetch('/api/profile')
  if (!response.ok) return null
  return response.json() as Promise<UserProfile>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const nextProfile = await fetchProfile()
    setProfile(nextProfile)
    return nextProfile
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function syncState(nextUser: User | null) {
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      const nextProfile = await fetchProfile()
      if (!active) return

      setProfile(nextProfile)
      setLoading(false)
    }

    supabase.auth.getUser()
      .then(({ data }) => syncState(data.user ?? null))
      .catch(() => {
        if (!active) return
        setUser(null)
        setProfile(null)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncState(session?.user ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
    setProfile,
  }), [loading, profile, refreshProfile, signOut, user])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
