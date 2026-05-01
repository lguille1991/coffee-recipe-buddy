import { redirect } from 'next/navigation'
import { isSavedCoffeeProfilesEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import SavedCoffeesClient from './SavedCoffeesClient'

export default async function SavedCoffeesPage() {
  if (!isSavedCoffeeProfilesEnabled()) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?returnTo=/coffees')
  }

  return <SavedCoffeesClient />
}
