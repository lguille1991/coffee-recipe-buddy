import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import {
  assertSupportedCoffeeImageMimeType,
  optimizeCoffeeProfileImage,
} from '@/lib/coffee-profile-storage'

describe('coffee-profile-storage', () => {
  it('rejects unsupported mime types', () => {
    expect(() => assertSupportedCoffeeImageMimeType('image/gif')).toThrow('Unsupported image type')
  })

  it('optimizes and resizes image to webp <= 1600 max edge', async () => {
    const source = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: { r: 120, g: 80, b: 60 },
      },
    }).jpeg({ quality: 95 }).toBuffer()

    const optimized = await optimizeCoffeeProfileImage(source)

    expect(optimized.mimeType).toBe('image/webp')
    expect(optimized.width).toBeLessThanOrEqual(1600)
    expect(optimized.height).toBeLessThanOrEqual(1600)
    expect(optimized.buffer.byteLength).toBeGreaterThan(0)
  })
})
