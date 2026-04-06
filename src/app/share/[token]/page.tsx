import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PublicShareResponse, METHOD_DISPLAY_NAMES, MethodId } from '@/types/recipe'
import { createClient } from '@/lib/supabase/server'
import ShareRecipeClient from './ShareRecipeClient'

type Props = { params: Promise<{ token: string }> }

async function getShareData(token: string): Promise<PublicShareResponse | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shared_recipes')
    .select('share_token, title, created_at, snapshot_json')
    .eq('share_token', token)
    .single()

  if (error || !data) return null

  return {
    shareToken: data.share_token,
    title: data.title ?? null,
    createdAt: data.created_at,
    snapshot: data.snapshot_json,
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
