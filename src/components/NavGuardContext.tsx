'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Guard function: receives the attempted href, returns true to block navigation
type GuardFn = (href: string) => boolean

export function useNavGuard() {
  const router = useRouter()
  // Use a ref instead of module-level variable to ensure proper React lifecycle management
  // This prevents race conditions and stale closure issues
  const activeGuardRef = useRef<GuardFn | null>(null)

  const requestNavigate = useCallback((href: string) => {
    if (activeGuardRef.current?.(href)) return
    router.push(href)
  }, [router])

  const setGuard = useCallback((fn: GuardFn | null) => {
    activeGuardRef.current = fn
  }, [])

  return { requestNavigate, setGuard }
}
