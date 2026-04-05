import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PublicShareResponse, METHOD_DISPLAY_NAMES, MethodId } from '@/types/recipe'
import ShareRecipeClient from './ShareRecipeClient'

type Props = { params: Promise<{ token: string }> }

async function getShareData(token: string): Promise<PublicShareResponse | null> {
  try {
    // Use absolute URL for server-side fetch; fall back to localhost in dev
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/share/${token}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const data = await getShareData(token)
  if (!data) return { title: 'Recipe not found' }

  const { snapshot } = data
  const methodName = METHOD_DISPLAY_NAMES[snapshot.current_recipe_json.method as MethodId] ?? snapshot.current_recipe_json.method
  const beanName = snapshot.bean_info.bean_name ?? snapshot.bean_info.origin ?? 'a coffee'
  const sharer = snapshot.owner_display_name ? ` by ${snapshot.owner_display_name}` : ''
  const title = `${methodName} — ${beanName}`
  const description = `Coffee recipe shared${sharer} on Brygg. ${snapshot.bean_info.process ?? ''} ${snapshot.bean_info.roast_level ?? ''} — ${snapshot.current_recipe_json.parameters.coffee_g}g at ${snapshot.current_recipe_json.parameters.temperature_c}°C.`.trim()

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(snapshot.image_url ? { images: [snapshot.image_url] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function SharePage({ params }: Props) {
  const { token } = await params
  const data = await getShareData(token)
  if (!data) notFound()

  return <ShareRecipeClient data={data} />
}
