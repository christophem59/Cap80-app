// Traitement d'image côté client (§5.5). Navigateur uniquement (canvas + createImageBitmap).

const MAX_BYTES = 300 * 1024

function drawToBlob(
  bitmap: ImageBitmap,
  maxSide: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, width, height }) : reject(new Error('toBlob a échoué'))),
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Redimensionne à 1200 px sur le plus grand côté puis boucle jusqu'à passer sous
 * 300 Ko : baisse la qualité de 0,8 vers 0,5, puis réduit le grand côté à 1000 puis
 * 900 px. Corrige l'orientation EXIF via createImageBitmap({imageOrientation}).
 */
export async function processPhoto(
  input: Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' })
  try {
    for (const maxSide of [1200, 1000, 900]) {
      let q = 0.8
      let result = await drawToBlob(bitmap, maxSide, q)
      while (result.blob.size > MAX_BYTES && q > 0.5) {
        q = Math.round((q - 0.05) * 100) / 100
        result = await drawToBlob(bitmap, maxSide, q)
      }
      if (result.blob.size <= MAX_BYTES) return result
      // Sinon on retente avec un grand côté plus petit.
    }
    // Dernier recours : le plus petit rendu obtenu (900 px, q 0,5).
    return await drawToBlob(bitmap, 900, 0.5)
  } finally {
    bitmap.close()
  }
}

/** Vignette ≤ 200 px, encodée en data URL JPEG légère (≤ ~20 Ko), pour les listes. */
export async function makeThumbnail(input: Blob): Promise<string> {
  const bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' })
  try {
    const { blob } = await drawToBlob(bitmap, 200, 0.6)
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } finally {
    bitmap.close()
  }
}
