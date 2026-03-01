/**
 * Client-side image compression using Canvas API.
 *
 * Resizes large camera photos to a max dimension of 1600px
 * and compresses to JPEG ~0.8 quality, keeping file size
 * under ~500KB for fast upload to the AI vision API.
 *
 * Supports HEIC/HEIF files (iPhone photos) by converting
 * to JPEG before processing.
 */

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8

/** Check if a file is HEIC/HEIF format by MIME type or extension. */
function isHeic(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return true
  // Some browsers don't set MIME type for HEIC — check extension
  const ext = file.name.toLowerCase().split('.').pop()
  return ext === 'heic' || ext === 'heif'
}

/**
 * Convert a HEIC/HEIF file to a JPEG Blob.
 *
 * heic2any can throw non-Error values (strings, plain objects),
 * so we normalise everything into a real Error with a helpful message.
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    // Robust dynamic import — handle CJS/ESM interop differences in Next.js/Webpack
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heic2anyModule: any = await import('heic2any')
    const heic2any = heic2anyModule.default?.default || heic2anyModule.default || heic2anyModule

    if (typeof heic2any !== 'function') {
      throw new Error('heic2any failed to load as a function')
    }

    // Wrap as a pure Blob to avoid prototype mismatches
    const fileBlob = new Blob([file], { type: file.type })

    const result = await heic2any({
      blob: fileBlob,
      toType: 'image/jpeg',
      quality: JPEG_QUALITY,
    })
    // heic2any can return a single Blob or an array
    const blob = Array.isArray(result) ? result[0] : result
    return new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), {
      type: 'image/jpeg',
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[image-compress] HEIC conversion failed:', err)
    throw new Error(
      `Could not convert this HEIC image (${errorMessage}). Try opening it on your phone and screenshotting it, or share it as a JPEG instead.`,
    )
  }
}

/**
 * Ensure a file is in a browser-renderable image format.
 * Converts HEIC/HEIF to JPEG; passes through everything else.
 * Use this in upload handlers that don't need full compression.
 */
export async function ensureBrowserImage(file: File): Promise<File> {
  return isHeic(file) ? convertHeicToJpeg(file) : file
}

/**
 * Check if a file is an image (including HEIC/HEIF which some browsers
 * don't recognize as image/* MIME type).
 */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return isHeic(file)
}

/**
 * Compress an image File to a base64 data URL string.
 * Returns { base64, mimeType } where mimeType is always 'image/jpeg'.
 *
 * Handles HEIC/HEIF by converting to JPEG first.
 */
export async function compressImage(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  // Convert HEIC to JPEG first if needed
  const inputFile = isHeic(file) ? await convertHeicToJpeg(file) : file

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
    reader.readAsDataURL(inputFile)
  })
}
