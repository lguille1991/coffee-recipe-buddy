function normalizeBooleanEnv(value: string | undefined): boolean {
  if (!value) return false
  return value === '1' || value.toLowerCase() === 'true'
}

export function isSavedCoffeeProfilesEnabled() {
  return normalizeBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES)
}

export function assertSavedCoffeeProfilesEnabled() {
  return isSavedCoffeeProfilesEnabled()
}
