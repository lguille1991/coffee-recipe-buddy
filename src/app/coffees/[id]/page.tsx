import { redirect } from 'next/navigation'
import { isSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import SavedCoffeeDetailClient from './SavedCoffeeDetailClient'

type Params = { params: Promise<{ id: string }> }

export default async function SavedCoffeeDetailPage({ params }: Params) {
  const { id } = await params
  if (!isSavedCoffeeProfilesEnabled()) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?returnTo=/coffees/${id}`)
  }

  return <SavedCoffeeDetailClient key={id} profileId={id} />
}
