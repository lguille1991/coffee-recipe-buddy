'use client'

import { createContext, useContext, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Guard function: receives the attempted href, returns true to block navigation
type GuardFn = (href: string) => boolean

interface NavGuardContextValue {
  requestNavigate: (href: string) => void
  setGuard: (fn: GuardFn | null) => void
}

const NavGuardContext = createContext<NavGuardContextValue>({
  requestNavigate: () => {},
  setGuard: () => {},
})

export function NavGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const guardRef = useRef<GuardFn | null>(null)

  function setGuard(fn: GuardFn | null) {
    guardRef.current = fn
  }

  function requestNavigate(href: string) {
    if (guardRef.current?.(href)) return // blocked
    router.push(href)
  }

  return (
    <NavGuardContext.Provider value={{ requestNavigate, setGuard }}>
      {children}
    </NavGuardContext.Provider>
  )
}

export function useNavGuard() {
  return useContext(NavGuardContext)
}
