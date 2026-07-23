'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types/recipe'
import { E2E_TEST_USER, isE2eTestAuthEnabled } from '@/lib/e2e-test-auth'

type AuthContextValue = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<UserProfile | null>
  setProfile: (profile: UserProfile | null) => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  signOut: async () => {},
  refreshProfile: async () => null,
  setProfile: () => {},
})

async function fetchProfile() {
  try {
    const response = await fetch('/api/profile')
    if (!response.ok) return null
    return response.json() as Promise<UserProfile>
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const testAuthEnabled = isE2eTestAuthEnabled({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_E2E_TEST_AUTH: process.env.NEXT_PUBLIC_E2E_TEST_AUTH,
  })
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const refreshProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const nextProfile = await fetchProfile()
      setProfile(nextProfile)
      return nextProfile
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    if (testAuthEnabled) {
      const activationTimer = window.setTimeout(() => {
        setUser(E2E_TEST_USER)
        setLoading(false)
      }, 0)
      return () => window.clearTimeout(activationTimer)
    }

    const supabase = createClient()
    let active = true

    async function syncState(nextUser: User | null) {
      setUser(nextUser)
      setLoading(false)

      if (!nextUser) {
        setProfile(null)
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)
      const nextProfile = await fetchProfile()
      if (!active) return

      setProfile(nextProfile)
      setProfileLoading(false)
    }

    const initialProfilePromise = fetchProfile()

    supabase.auth.getUser()
      .then(async ({ data }) => {
        const nextUser = data.user ?? null
        setUser(nextUser)
        setLoading(false)

        if (!nextUser) {
          setProfile(null)
          setProfileLoading(false)
          return
        }

        setProfileLoading(true)
        const nextProfile = await initialProfilePromise
        if (!active) return

        setProfile(nextProfile)
        setProfileLoading(false)
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setProfile(null)
        setLoading(false)
        setProfileLoading(false)
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
  }, [testAuthEnabled])

  const signOut = useCallback(async () => {
    if (testAuthEnabled) {
      setUser(null)
      setProfile(null)
      setProfileLoading(false)
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileLoading(false)
  }, [testAuthEnabled])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    profileLoading,
    signOut,
    refreshProfile,
    setProfile,
  }), [loading, profile, profileLoading, refreshProfile, signOut, user])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
