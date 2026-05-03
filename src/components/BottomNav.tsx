'use client'

import { memo } from 'react'
import { usePathname } from 'next/navigation'
import { useNavGuard } from './NavGuardContext'
import { NAV_ITEMS } from './nav-items'

function BottomNav() {
  const pathname = usePathname()
  const { requestNavigate } = useNavGuard()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-center px-3 pb-[var(--mobile-nav-safe-gap)] pt-2 pointer-events-none">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-[36px] border border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--card)_82%,transparent)] px-2 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => requestNavigate(item.href)}
              className={`ui-focus-ring min-h-12 min-w-0 flex-1 rounded-[26px] px-2 py-2 flex flex-col items-center justify-center gap-1 transition-[transform,background-color,color,opacity,box-shadow] duration-150 ease-out ${
                active
                  ? 'bg-[var(--foreground)] text-[var(--background)] shadow-[0_10px_24px_rgba(15,23,42,0.18)]'
                  : 'text-[var(--foreground)] opacity-75 hover:opacity-100 hover:bg-[var(--surface-strong)]'
              }`}
            >
              {item.icon}
              <span className="ui-nav-label block max-w-full truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default memo(BottomNav)
