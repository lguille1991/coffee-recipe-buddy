import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BeanProfile } from '@/types/recipe'

const TEST_BEAN: BeanProfile = {
  bean_name: 'Test Lot',
  roaster: 'Test Roaster',
  variety: 'Bourbon',
  finca: null,
  producer: null,
  process: 'washed',
  origin: 'El Salvador',
  altitude_masl: 1600,
  roast_level: 'light',
  tasting_notes: ['citrus'],
  roast_date: null,
}

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('fs')
})

describe('prompt-builder', () => {
  it('loads recipe prompt docs once at module scope', async () => {
    const readFileSyncMock = vi.fn((filePath: string) => `[doc:${filePath}]`)

    vi.doMock('fs', () => ({
      default: {
        readFileSync: readFileSyncMock,
      },
    }))

    const { buildRecipePrompt } = await import('@/lib/prompt-builder')

    buildRecipePrompt(TEST_BEAN, 'v60')
    buildRecipePrompt(TEST_BEAN, 'v60', 250)

    expect(readFileSyncMock).toHaveBeenCalledTimes(7)
  })
})
