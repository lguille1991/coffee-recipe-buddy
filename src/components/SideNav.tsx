'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNavGuard } from './NavGuardContext'
import { NAV_ITEMS } from './nav-items'

export default function SideNav() {
  const pathname = usePathname()
  const { requestNavigate } = useNavGuard()

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
              onNavigate={(event) => {
                event.preventDefault()
                requestNavigate(item.href)
              }}
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
