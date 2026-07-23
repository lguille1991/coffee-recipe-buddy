import { describe, expect, it } from 'vitest'
import { isE2eTestAuthEnabled } from '../e2e-test-auth'

describe('isE2eTestAuthEnabled', () => {
  it('requires the explicit E2E flag outside production', () => {
    expect(isE2eTestAuthEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_E2E_TEST_AUTH: '1' })).toBe(true)
    expect(isE2eTestAuthEnabled({ NODE_ENV: 'development' })).toBe(false)
  })

  it('never enables the test identity in production', () => {
    expect(isE2eTestAuthEnabled({ NODE_ENV: 'production', NEXT_PUBLIC_E2E_TEST_AUTH: '1' })).toBe(false)
  })
})
