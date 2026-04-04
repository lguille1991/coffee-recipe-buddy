'use client'

/**
 * Client-side image compression using canvas.
 * Targets < 1 MB for Claude vision API upload.
 */
export async function compressImage(
  file: File,
  maxSizeKb = 900,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }

      // Scale down if image is very large
      let { width, height } = img
      const maxDim = 1600
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      // Try progressively lower quality until we're under maxSizeKb
      const tryCompress = (quality: number) => {
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }
            if (blob.size <= maxSizeKb * 1024 || quality <= 0.3) {
              resolve(blob)
            } else {
              tryCompress(quality - 0.1)
            }
          },
          'image/jpeg',
          quality,
        )
      }

      tryCompress(0.85)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
