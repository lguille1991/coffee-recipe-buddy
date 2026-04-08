'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, memo } from 'react'
import { Camera, PenLine, LogIn } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { RecipeListItem } from '@/types/recipe'
import { METHOD_DISPLAY_NAMES, MethodId } from '@/types/recipe'
import MethodIcon from '@/components/MethodIcon'

const RecipeCard = memo(function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const displayName = METHOD_DISPLAY_NAMES[recipe.method as MethodId] ?? recipe.method
  const beanName = recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Unknown bean'
  const date = new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="flex items-center gap-3 bg-[var(--card)] rounded-2xl p-3 active:opacity-80 transition-opacity"
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--border)] shrink-0 flex items-center justify-center">
        {recipe.image_url ? (
          <Image src={recipe.image_url} alt={beanName} width={56} height={56} className="w-full h-full object-cover" />
        ) : (
          <MethodIcon method={recipe.method} size={28} className="text-[var(--muted-foreground)]" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">{beanName}</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{displayName}</p>
      </div>

      {/* Date */}
      <p className="text-[10px] text-[var(--muted-foreground)] shrink-0">{date}</p>
    </Link>
  )
})

export default function HomePage() {
  const { user, loading } = useAuth()
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [recipesLoading, setRecipesLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setRecipesLoading(true)
    fetch('/api/recipes?limit=20')
      .then(r => r.json())
      .then(data => setRecipes(data.recipes ?? []))
      .catch(() => {})
      .finally(() => setRecipesLoading(false))
  }, [user])

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Status bar spacer */}
      <div className="h-12" />

      {/* Header */}
      <div className="px-4 sm:px-6 pb-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--foreground)]">Coffee Recipe Buddy</h1>
        <p className="text-[var(--muted-foreground)] text-sm sm:text-base mt-0.5">
          Hey there, what coffee beans do you need a recipe for today?
        </p>
      </div>

      {/* Hero image */}
      <div className="px-4 sm:px-6">
        <div className="w-full xl:w-4/5 xl:mx-0 aspect-[4/3] xl:aspect-[16/9] rounded-[16px] overflow-hidden bg-[#D4C9B8] relative">
          <Image
            src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80"
            alt="Coffee brewing"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 sm:px-6 mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Link
          href="/scan"
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--foreground)] text-[var(--background)] text-base font-medium rounded-[14px] py-4 active:opacity-80 transition-opacity"
        >
          <Camera size={20} />
          Scan Your Coffee Bag
        </Link>
        <Link
          href="/manual"
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--card)] text-[var(--foreground)] text-base font-medium rounded-[14px] py-3.5 border border-[var(--border)] active:opacity-80 transition-opacity"
        >
          <PenLine size={16} />
          Enter Manually
        </Link>
        {!loading && !user && (
          <Link
            href="/auth"
            className="flex-1 flex items-center justify-center gap-2 bg-[var(--card)] text-[var(--foreground)] text-base font-medium rounded-[14px] py-3.5 border border-[var(--border)] active:opacity-80 transition-opacity"
          >
            <LogIn size={16} />
            Sign In
          </Link>
        )}
      </div>

      {/* My Recipes section */}
      {!loading && user && (
        <div className="px-4 sm:px-6 mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">My Recipes</h2>
            <Link href="/recipes" className="text-xs text-[var(--muted-foreground)] underline">See all</Link>
          </div>

          {recipesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recipes.length === 0 ? (
            <div className="bg-[var(--card)] rounded-2xl p-6 text-center">
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                No saved recipes yet.
              </p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Scan your first bag to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
              {recipes.slice(0, 6).map(r => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom nav spacer */}
      <div className="h-24" />
    </div>
  )
}
