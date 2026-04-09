import type { SupabaseClient, User } from '@supabase/supabase-js'

function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function getAuthUserDisplayName(user: User | null): string | null {
  if (!user) return null

  const fullName = normalizeDisplayName(user.user_metadata?.full_name)
  if (fullName) return fullName

  const name = normalizeDisplayName(user.user_metadata?.name)
  if (name) return name

  const givenName = normalizeDisplayName(user.user_metadata?.given_name)
  const familyName = normalizeDisplayName(user.user_metadata?.family_name)
  const combined = normalizeDisplayName([givenName, familyName].filter(Boolean).join(' '))
  if (combined) return combined

  return null
}

export async function syncProfileDisplayNameFromAuth(
  supabase: SupabaseClient,
  user: User | null,
) {
  const displayName = getAuthUserDisplayName(user)
  if (!user || !displayName) return

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.warn('[profile] failed to load profile for display name sync', error)
    return
  }

  if (normalizeDisplayName(profile?.display_name)) return

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, display_name: displayName },
      { onConflict: 'id' },
    )

  if (upsertError) {
    console.warn('[profile] failed to sync display name from auth metadata', upsertError)
  }
}
