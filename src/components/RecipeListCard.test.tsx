/** @vitest-environment jsdom */
/* eslint-disable @next/next/no-img-element */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import RecipeListCard from '@/components/RecipeListCard'
import type { RecipeListItem } from '@/types/recipe'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href} {...props}>{children}</a>,
}))

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string }) => <img alt={alt} {...props} />,
}))

function buildRecipe(overrides: Partial<RecipeListItem> = {}): RecipeListItem {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    owner_user_id: '22222222-2222-2222-2222-222222222222',
    method: 'v60',
    bean_info: { bean_name: 'Los Pirineos', process: 'washed', roast_level: 'light' },
    image_url: null,
    created_at: '2026-05-14T00:00:00.000Z',
    schema_version: 1,
    archived: false,
    is_favorite: false,
    source: 'owned',
    can_delete: true,
    can_archive: true,
    can_remove_from_list: false,
    is_manual_created: false,
    has_manual_edits: false,
    has_feedback_adjustments: false,
    is_scaled: false,
    ...overrides,
  }
}

describe('RecipeListCard', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('renders a humanized goal badge when the saved recipe includes one', async () => {
    await act(async () => {
      root.render(<RecipeListCard recipe={buildRecipe({ goal: 'sweetness' })} />)
    })

    expect(container.querySelector('[data-testid="recipe-goal-11111111-1111-1111-1111-111111111111"]')?.textContent).toBe('Sweetness')
  })

  it('does not render a goal badge when the saved recipe has no goal', async () => {
    await act(async () => {
      root.render(<RecipeListCard recipe={buildRecipe()} />)
    })

    expect(container.textContent).not.toContain('Sweetness')
    expect(container.querySelector('[data-testid^="recipe-goal-"]')).toBeNull()
  })
})
