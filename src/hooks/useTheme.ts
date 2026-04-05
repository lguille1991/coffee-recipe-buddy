'use client'

import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (theme === 'dark' || (theme === 'system' && prefersDark)) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    const initial = stored ?? 'system'
    setThemeState(initial)
    applyTheme(initial)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      const current = (localStorage.getItem('theme') as Theme | null) ?? 'system'
      if (current === 'system') applyTheme('system')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  function setTheme(t: Theme) {
    localStorage.setItem('theme', t)
    setThemeState(t)
    applyTheme(t)
  }

  return { theme, setTheme }
}
