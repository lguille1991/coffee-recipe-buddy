'use client'

import { useEffect } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Re-apply on mount in case SSR missed it, and keep system pref in sync
    const stored = localStorage.getItem('theme') ?? 'system'
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (stored === 'dark' || (stored === 'system' && prefersDark)) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [])

  return <>{children}</>
}
