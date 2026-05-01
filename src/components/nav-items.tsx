import type { ReactNode } from 'react'
import { CoffeeIcon, HomeIcon, RecipesIcon, SettingsIcon } from './NavIcons'
import { isSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'

type NavItem = {
  href: string
  label: string
  icon: ReactNode
}

const baseItems: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: <HomeIcon />,
  },
  {
    href: '/recipes',
    label: 'Recipes',
    icon: <RecipesIcon />,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: <SettingsIcon />,
  },
]

export const NAV_ITEMS: NavItem[] = isSavedCoffeeProfilesEnabled()
  ? [
    ...baseItems.slice(0, 2),
    {
      href: '/coffees',
      label: 'Coffees',
      icon: <CoffeeIcon />,
    },
    baseItems[2],
  ]
  : baseItems
