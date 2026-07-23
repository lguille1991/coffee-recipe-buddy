import type { User } from '@supabase/supabase-js'

type E2eAuthEnvironment = {
  NODE_ENV?: string
  NEXT_PUBLIC_E2E_TEST_AUTH?: string
}

export function isE2eTestAuthEnabled(environment: E2eAuthEnvironment = process.env): boolean {
  return environment.NODE_ENV !== 'production' && environment.NEXT_PUBLIC_E2E_TEST_AUTH === '1'
}

export const E2E_TEST_USER: User = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e-test@local.invalid',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00.000Z',
}
