import Image from 'next/image'
import Link from 'next/link'
import { Camera, PenLine, LogIn } from 'lucide-react'
import RecipeListCard from '@/components/RecipeListCard'
import { getOrCreateUserProfile } from '@/lib/profile'
import { listRecipesForUser } from '@/lib/recipe-list'
import { createClient } from '@/lib/supabase/server'
import type { RecipeListItem } from '@/types/recipe'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let recipes: RecipeListItem[] = []
  let displayName: string | null = null

  if (user) {
    const profile = await getOrCreateUserProfile(supabase, user)
    displayName = profile.display_name?.trim() ?? null
    const recipeResult = await listRecipesForUser(supabase, { userId: user.id, limit: 6 })
    recipes = recipeResult.recipes
  }

  const greeting = displayName
    ? `Hey there ${displayName}, what coffee beans do you need a recipe for today?`
    : 'Hey there, what coffee beans do you need a recipe for today?'

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Status bar spacer */}
      <div className="h-12" />

      <div className="px-4 sm:px-6 pb-4">
        <h1 className="ui-page-title-hero">Coffee Recipe Buddy</h1>
        <p className="ui-body-muted mt-1">
          {greeting}
        </p>
      </div>

      {/* Hero image */}
      <div className="px-4 sm:px-6">
        <div className="ui-card-interactive group w-full aspect-square sm:aspect-[4/3] xl:aspect-[3/2] rounded-[16px] overflow-hidden bg-[#D4C9B8] ring-1 ring-black/5 relative">
          <Image
            src="/CoffeeBrewing.jpg"
            alt="Illustrated baristas brewing pour-over coffee together"
            fill
            className="object-cover object-top transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.015]"
            sizes="(min-width: 1280px) 960px, (min-width: 640px) 768px, 100vw"
            preload
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
        {!user && (
          <Link
            href="/auth"
            className="ui-button-secondary flex-1"
          >
            <LogIn className="ui-icon-inline" />
            Sign In
          </Link>
        )}
      </div>

      {user && (
        <div className="px-4 sm:px-6 mt-8 ui-animate-enter-soft">
          <div className="flex items-center justify-between mb-3">
            <h2 className="ui-card-title">My Recipes</h2>
            <Link href="/recipes" className="ui-focus-ring rounded-md ui-meta underline underline-offset-4 transition-colors duration-150 hover:text-[var(--foreground)]">See all</Link>
          </div>

          {recipes.length === 0 ? (
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
