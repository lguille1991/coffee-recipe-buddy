'use client'

import { usePathname } from 'next/navigation'
import { useNavGuard } from './NavGuardContext'
import { NAV_ITEMS } from './nav-items'

export default function BottomNav() {
  const pathname = usePathname()
  const { requestNavigate } = useNavGuard()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex justify-center pb-2 pt-2 pointer-events-none">
      <div className="pointer-events-auto bg-[var(--card)] rounded-[36px] flex items-center px-3 py-2 gap-1 shadow-sm">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => requestNavigate(item.href)}
              className={`min-w-20 min-h-10 flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-[26px] transition-colors ${
                active
                  ? 'bg-[var(--foreground)] text-[var(--background)]'
                  : 'text-[var(--foreground)] opacity-50'
              }`}
            >
              {item.icon}
              <span className="ui-nav-label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
