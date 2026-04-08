'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg className="ui-icon-nav" viewBox="0 0 20 20" fill="none">
        <path d="M3 8.5L10 2L17 8.5V17H13V12H7V17H3V8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/recipes',
    label: 'Recipes',
    icon: (
      <svg className="ui-icon-nav" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7H13M7 10H13M7 13H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg className="ui-icon-nav" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3V5M10 15V17M3 10H5M15 10H17M4.93 4.93L6.34 6.34M13.66 13.66L15.07 15.07M4.93 15.07L6.34 13.66M13.66 6.34L15.07 4.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function SideNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 bg-[var(--card)] border-r border-[var(--border)] z-40">
      <div className="px-6 py-8 border-b border-[var(--border)]">
        <span className="text-2xl font-bold tracking-tight text-[var(--foreground)]">QAfe</span>
        <p className="ui-body-muted mt-0.5">Coffee Recipe Buddy</p>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-h-11 flex items-center gap-3 px-3 py-3 rounded-[12px] ui-button-text transition-colors ${
                active
                  ? 'bg-[var(--foreground)] text-[var(--background)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--background)]'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
