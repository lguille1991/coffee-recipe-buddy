'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/hooks/useAuth'
import { RecipeListItem } from '@/types/recipe'
import { METHOD_DISPLAY_NAMES, MethodId } from '@/types/recipe'

function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const displayName = METHOD_DISPLAY_NAMES[recipe.method as MethodId] ?? recipe.method
  const beanName = recipe.bean_info.bean_name ?? recipe.bean_info.origin ?? 'Unknown bean'
  const date = new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="flex items-center gap-3 bg-white rounded-2xl p-3 active:opacity-80 transition-opacity"
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#E1E2E5] shrink-0 flex items-center justify-center">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.image_url} alt={beanName} className="w-full h-full object-cover" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4h12v12H4z" stroke="#9CA3AF" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M7 8h6M7 11h4" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#333333] truncate">{beanName}</p>
        <p className="text-xs text-[#6B6B6B] mt-0.5">{displayName}</p>
      </div>

      {/* Date */}
      <p className="text-[10px] text-[#9CA3AF] shrink-0">{date}</p>
    </Link>
  )
}

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
    <div className="flex flex-col min-h-screen max-w-sm mx-auto relative">
      {/* Status bar spacer */}
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#333333]">Brygg</h1>
          <p className="text-[#5B5F66] text-sm mt-0.5">
            {user ? `Good morning` : 'Good morning'}
          </p>
        </div>
        {!loading && !user && (
          <Link
            href="/auth"
            className="text-xs font-medium text-[#333333] border border-[#E1E2E5] rounded-[10px] px-3 py-1.5"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* Hero image */}
      <div className="px-6">
        <div
          className="w-full aspect-[4/3] rounded-[16px] overflow-hidden bg-[#D4C9B8]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      {/* CTA */}
      <div className="px-6 mt-6 flex flex-col items-center gap-3">
        <Link
          href="/scan"
          className="w-full flex items-center justify-center gap-2 bg-[#333333] text-white text-sm font-medium rounded-[14px] py-4 active:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5.25" stroke="white" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2" fill="white" />
            <path d="M1 8H2.5M13.5 8H15M8 1V2.5M8 13.5V15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Scan Your Coffee Bag
        </Link>
        <Link
          href="/manual"
          className="w-full flex items-center justify-center gap-2 bg-white text-[#333333] text-sm font-medium rounded-[14px] py-3.5 border border-[#E1E2E5] active:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3H13M3 6H10M3 9H13M3 12H8" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Enter Manually
        </Link>
      </div>

      {/* My Recipes section */}
      {!loading && user && (
        <div className="px-6 mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#333333]">My Recipes</h2>
            <Link href="/recipes" className="text-xs text-[#6B6B6B] underline">See all</Link>
          </div>

          {recipesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recipes.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center">
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                No saved recipes yet.
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">Scan your first bag to get started!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recipes.slice(0, 5).map(r => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom nav spacer */}
      <div className="h-24" />
      <BottomNav />
    </div>
  )
}
