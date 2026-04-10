'use client'

import { useAuthContext } from '@/components/AuthContext'

export function useAuth() {
  const { user, loading, signOut } = useAuthContext()

  return { user, loading, signOut }
}
