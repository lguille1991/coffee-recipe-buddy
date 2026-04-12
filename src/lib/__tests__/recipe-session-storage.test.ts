import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_RECIPE, WASHED_LIGHT_BEAN } from '@/lib/__tests__/fixtures'

class MemoryStorage {
  private store = new Map<string, string>()

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }

  removeItem(key: string) {
    this.store.delete(key)
  }
}

describe('recipeSessionStorage', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    const sessionStorage = new MemoryStorage()
    const localStorage = new MemoryStorage()

    Object.defineProperty(globalThis, 'window', {
      value: { sessionStorage, localStorage },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()

    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
      return
    }

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    })
  })

  it('restores recipe flow data from localStorage when sessionStorage is lost', async () => {
    const { recipeSessionStorage } = await import('../recipe-session-storage')

    recipeSessionStorage.setConfirmedBean(WASHED_LIGHT_BEAN)
    recipeSessionStorage.setRecipe(BASE_RECIPE)
    recipeSessionStorage.setRecipeFlowSource('generated')

    window.sessionStorage.removeItem('confirmedBean')
    window.sessionStorage.removeItem('recipe')
    window.sessionStorage.removeItem('recipe_flow_source')

    expect(recipeSessionStorage.getConfirmedBean()).toEqual(WASHED_LIGHT_BEAN)
    expect(recipeSessionStorage.getRecipe()).toEqual(BASE_RECIPE)
    expect(recipeSessionStorage.getRecipeFlowSource()).toBe('generated')
    expect(window.sessionStorage.getItem('recipe')).not.toBeNull()
  })

  it('drops expired recovery state so stale recipes are not revived indefinitely', async () => {
    vi.useFakeTimers()
    const { recipeSessionStorage } = await import('../recipe-session-storage')

    recipeSessionStorage.setRecipe(BASE_RECIPE)
    window.sessionStorage.removeItem('recipe')

    vi.advanceTimersByTime(1000 * 60 * 60 * 24 + 1)

    expect(recipeSessionStorage.getRecipe()).toBeNull()
    expect(window.localStorage.getItem('recipe_recovery:recipe')).toBeNull()
  })
})
