'use client'

import { useEffect } from 'react'

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const t = localStorage.getItem('theme') || 'system'
      const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    } catch {
      // Ignore theme initialization errors (e.g., storage unavailable).
    }
  }, [])

  return null
}
