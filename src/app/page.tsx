'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, startTransition } from 'react'
import { Camera, PenLine, LogIn } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { RecipeListItem } from '@/types/recipe'
import RecipeListCard from '@/components/RecipeListCard'

export default function HomePage() {
  const { user, loading } = useAuth()
  const { profile } = useProfile()
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [recipesLoading, setRecipesLoading] = useState(false)
  const displayName = profile?.display_name?.trim()
  const greeting = displayName
    ? `Hey there ${displayName}, what coffee beans do you need a recipe for today?`
    : 'Hey there, what coffee beans do you need a recipe for today?'

  useEffect(() => {
    if (!user) return
    startTransition(() => {
      setRecipesLoading(true)
    })
    fetch('/api/recipes?limit=20', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => setRecipes(data.recipes ?? []))
      .catch(() => {})
      .finally(() => setRecipesLoading(false))
  }, [user])

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Status bar spacer */}
      <div className="h-12" />

      <div className="px-4 sm:px-6 pb-4 ui-animate-enter">
        <h1 className="ui-page-title-hero">Coffee Recipe Buddy</h1>
        <p className="ui-body-muted mt-1">
          {greeting}
        </p>
      </div>

      {/* Hero image */}
      <div className="px-4 sm:px-6 ui-animate-enter-soft">
        <div className="ui-card-interactive group w-full aspect-square sm:aspect-[4/3] xl:aspect-[3/2] rounded-[16px] overflow-hidden bg-[#D4C9B8] ring-1 ring-black/5 relative">
          <Image
            src="/CoffeeBrewing.PNG"
            alt="Illustrated baristas brewing pour-over coffee together"
            fill
            className="object-cover object-top transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.015]"
            sizes="(min-width: 1280px) 960px, (min-width: 640px) 768px, 100vw"
            priority
          />
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ui-animate-enter-soft">
        <Link
          href="/scan"
          className="ui-button-primary flex-1"
        >
          <Camera className="ui-icon-action" />
          Scan Your Coffee Bag
        </Link>
        <Link
          href="/manual"
          className="ui-button-secondary flex-1"
        >
          <PenLine className="ui-icon-inline" />
          Enter Manually
        </Link>
        {!loading && !user && (
          <Link
            href="/auth"
            className="ui-button-secondary flex-1"
          >
            <LogIn className="ui-icon-inline" />
            Sign In
          </Link>
        )}
      </div>

      {!loading && user && (
        <div className="px-4 sm:px-6 mt-8 ui-animate-enter-soft">
          <div className="flex items-center justify-between mb-3">
            <h2 className="ui-card-title">My Recipes</h2>
            <Link href="/recipes" className="ui-focus-ring rounded-md ui-meta underline underline-offset-4 transition-colors duration-150 hover:text-[var(--foreground)]">See all</Link>
          </div>

          {recipesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recipes.length === 0 ? (
            <div className="ui-card-interactive bg-[var(--card)] rounded-2xl p-6 text-center">
              <p className="ui-body-muted leading-relaxed">
                No saved recipes yet.
              </p>
              <p className="ui-body-muted mt-1">Scan your first bag to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
              {recipes.slice(0, 6).map(r => (
                <RecipeListCard key={r.id} recipe={r} />
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
