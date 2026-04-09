import { describe, expect, it } from 'vitest'
import { shouldGuardBrewExit } from './brew-session'

describe('shouldGuardBrewExit', () => {
  it('does not guard before brewing starts', () => {
    expect(shouldGuardBrewExit(false, 0)).toBe(false)
  })

  it('guards while the timer is actively running', () => {
    expect(shouldGuardBrewExit(true, 0)).toBe(true)
  })

  it('guards once elapsed time is non-zero', () => {
    expect(shouldGuardBrewExit(false, 12)).toBe(true)
  })

  it('does not guard after a manual stop resets elapsed time', () => {
    expect(shouldGuardBrewExit(false, 0)).toBe(false)
  })
})
