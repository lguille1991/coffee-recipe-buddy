import type { SupabaseClient, User } from '@supabase/supabase-js'
import { syncProfileDisplayNameFromAuth } from '@/lib/auth-profile'
import type { UserProfile } from '@/types/recipe'

const PROFILE_SELECT = 'display_name, default_volume_ml, temp_unit, preferred_grinder'

export async function getOrCreateUserProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<UserProfile> {
  await syncProfileDisplayNameFromAuth(supabase, user)

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id })
      .select(PROFILE_SELECT)
      .single()

    if (insertError || !created) {
      throw new Error(insertError?.message ?? 'Failed to create profile')
    }

    return created satisfies UserProfile
  }

  return data satisfies UserProfile
}
