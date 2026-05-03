'use client'

import { memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { RecipeListItem, METHOD_DISPLAY_NAMES, MethodId } from '@/types/recipe'
import MethodIcon from '@/components/MethodIcon'

export const RecipeCardContent = memo(function RecipeCardContent({ recipe }: { recipe: RecipeListItem }) {
  const displayName = METHOD_DISPLAY_NAMES[recipe.method as MethodId] ?? recipe.method
  const beanName = recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Unknown bean'
  const beanProcess = recipe.bean_info.process?.trim()
  const roaster = recipe.bean_info.roaster
  const date = new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const badges = [
    recipe.is_manual_created ? 'manual' : null,
    recipe.has_manual_edits ? 'edited' : null,
    recipe.has_feedback_adjustments ? 'auto-adjusted' : null,
    recipe.is_scaled ? 'scaled' : null,
  ].filter(Boolean) as string[]

  return (
    <>
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--border)] shrink-0 flex items-center justify-center transition-transform duration-200 ease-out group-hover:scale-[1.03]">
        {recipe.image_url ? (
          <Image src={recipe.image_url} alt={beanName} width={56} height={56} className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
        ) : (
          <MethodIcon method={recipe.method} size={28} className="text-[var(--muted-foreground)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="ui-card-title truncate">{beanName}</p>
        {beanProcess && <p className="ui-meta mt-0.5 truncate capitalize">{beanProcess}</p>}
        {roaster && <p className="ui-meta truncate">{roaster}</p>}
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="ui-meta">{displayName}</p>
          {badges.map(badge => (
            <span
              key={badge}
              className={`ui-meta font-medium px-2 py-1 rounded-full ${
                badge === 'edited'
                  ? 'ui-badge-info'
                  : badge === 'scaled'
                    ? 'ui-badge-neutral'
                    : badge === 'manual'
                      ? 'bg-[var(--foreground)]/10 text-[var(--foreground)]'
                      : 'ui-badge-warning'
              }`}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right shrink-0">
        {recipe.is_favorite && (
          <div className="flex justify-end mb-1 text-amber-500" aria-label="Favorite recipe">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2.6L12.4 7.4L17.7 8.1L13.9 11.8L14.8 17.1L10 14.5L5.2 17.1L6.1 11.8L2.3 8.1L7.6 7.4L10 2.6Z" />
            </svg>
          </div>
        )}
        <p className="ui-meta">{date}</p>
        <svg className="ui-icon-inline mt-1.5 ml-auto text-[var(--muted-foreground)] transition-transform duration-200 ease-out group-hover:translate-x-0.5" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </>
  )
})

const RecipeListCard = memo(function RecipeListCard({
  recipe,
  disableLink = false,
}: {
  recipe: RecipeListItem
  disableLink?: boolean
}) {
  if (disableLink) {
    return (
      <div className="ui-card-interactive group flex items-center gap-3 bg-[var(--card)] rounded-2xl p-3">
        <RecipeCardContent recipe={recipe} />
      </div>
    )
  }

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="ui-card-interactive group flex items-center gap-3 bg-[var(--card)] rounded-2xl p-3"
    >
      <RecipeCardContent recipe={recipe} />
    </Link>
  )
})

export default RecipeListCard
