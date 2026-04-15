import type { ReactNode } from 'react'
import { HomeIcon, RecipesIcon, SettingsIcon } from './NavIcons'

type NavItem = {
  href: string
  label: string
  icon: ReactNode
}

export const NAV_ITEMS: NavItem[] = [
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
