'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

// Guard function: receives the attempted href, returns true to block navigation
type GuardFn = (href: string) => boolean

let activeGuard: GuardFn | null = null

export function useNavGuard() {
  const router = useRouter()

  const requestNavigate = useCallback((href: string) => {
    if (activeGuard?.(href)) return
    router.push(href)
  }, [router])

  const setGuard = useCallback((fn: GuardFn | null) => {
    activeGuard = fn
  }, [])

  return { requestNavigate, setGuard }
}
