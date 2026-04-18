import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getAuthUserDisplayName } from '@/lib/auth-profile'
import type { UserProfile } from '@/types/recipe'

const PROFILE_SELECT = 'display_name, default_volume_ml, temp_unit, preferred_grinder'

export async function getOrCreateUserProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<UserProfile> {
  const authDisplayName = getAuthUserDisplayName(user)

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        display_name: authDisplayName,
      })
      .select(PROFILE_SELECT)
      .single()

    if (insertError || !created) {
      throw new Error(insertError?.message ?? 'Failed to create profile')
    }

    return created satisfies UserProfile
  }

  if (!data.display_name && authDisplayName) {
    const nextProfile = {
      ...data,
      display_name: authDisplayName,
    } satisfies UserProfile

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: authDisplayName })
      .eq('id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return nextProfile
  }

  return data satisfies UserProfile
}
