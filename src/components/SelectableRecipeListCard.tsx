'use client'

import { memo } from 'react'
import type { RecipeListItem } from '@/types/recipe'
import { RecipeCardContent } from '@/components/RecipeListCard'

type SelectableRecipeListCardProps = {
  recipe: RecipeListItem
  selected: boolean
  onToggle: (id: string) => void
}

const SelectableRecipeListCard = memo(function SelectableRecipeListCard({
  recipe,
  selected,
  onToggle,
}: SelectableRecipeListCardProps) {
  const beanName = recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Unknown bean'

  return (
    <button
      type="button"
      onClick={() => onToggle(recipe.id)}
      data-testid={`select-recipe-${recipe.id}`}
      aria-label={`Select recipe ${beanName}`}
      aria-pressed={selected}
      className={`ui-card-interactive group flex w-full items-center gap-3 rounded-2xl p-3 text-left ${
        selected
          ? 'bg-[var(--card)] ring-2 ring-[var(--foreground)]/30'
          : 'bg-[var(--card)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          selected
            ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
            : 'border-[var(--border)] bg-transparent text-transparent'
        }`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <RecipeCardContent recipe={recipe} />
    </button>
  )
})

export default SelectableRecipeListCard
