'use client'

import { memo } from 'react'

export const HomeIcon = memo(function HomeIcon() {
  return (
    <svg className="ui-icon-nav" viewBox="0 0 20 20" fill="none">
      <path d="M3 8.5L10 2L17 8.5V17H13V12H7V17H3V8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
})

export const RecipesIcon = memo(function RecipesIcon() {
  return (
    <svg className="ui-icon-nav" viewBox="0 0 20 20" fill="none">
      <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7H13M7 10H13M7 13H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
})

export const SettingsIcon = memo(function SettingsIcon() {
  return (
    <svg className="ui-icon-nav" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 3V5M10 15V17M3 10H5M15 10H17M4.93 4.93L6.34 6.34M13.66 13.66L15.07 15.07M4.93 15.07L6.34 13.66M13.66 6.34L15.07 4.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
})
