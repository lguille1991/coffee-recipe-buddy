import type { SupabaseClient } from '@supabase/supabase-js'

export async function uploadBagPhotoFromDataUrl(
  supabase: SupabaseClient,
  userId: string,
  imageDataUrl: string,
): Promise<string | null> {
  const base64Data = imageDataUrl.split(',')[1]
  if (!base64Data) return null

  const mimeMatch = imageDataUrl.match(/data:([^;]+);/)
  const mime = mimeMatch?.[1] ?? 'image/jpeg'
  const ext = mime.split('/')[1] ?? 'jpg'
  const buffer = Buffer.from(base64Data, 'base64')

  const filePath = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('bag-photos')
    .upload(filePath, buffer, { contentType: mime, upsert: false })

  if (uploadError) return null

  const { data: signedData } = await supabase.storage
    .from('bag-photos')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365)

  return signedData?.signedUrl ?? null
}
