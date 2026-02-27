/**
 * Client-side image compression using Canvas API.
 *
 * Resizes large camera photos to a max dimension of 1600px
 * and compresses to JPEG ~0.8 quality, keeping file size
 * under ~500KB for fast upload to the AI vision API.
 */

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8

/**
 * Compress an image File to a base64 data URL string.
 * Returns { dataUrl, mimeType } where mimeType is always 'image/jpeg'.
 */
export async function compressImage(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = () => {
      img.onload = () => {
        try {
          // Calculate new dimensions keeping aspect ratio
          let { width, height } = img
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height / width) * MAX_DIMENSION)
              width = MAX_DIMENSION
            } else {
              width = Math.round((width / height) * MAX_DIMENSION)
              height = MAX_DIMENSION
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
          // Strip the data URL prefix to get raw base64
          const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')

          resolve({ base64, mimeType: 'image/jpeg' })
        } catch (err) {
          reject(err)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = reader.result as string
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
