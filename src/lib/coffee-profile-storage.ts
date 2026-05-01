import type { SupabaseClient } from '@supabase/supabase-js'

const COFFEE_PROFILE_IMAGE_BUCKET = 'coffee-bag-images'
const SIGNED_URL_TTL_SECONDS = 60 * 15

export type UploadProfileImageInput = {
  userId: string
  profileId: string
  imageDataUrl: string
  width: number
  height: number
  mimeType?: string
}

export async function uploadCoffeeProfileImage(
  supabase: SupabaseClient,
  input: UploadProfileImageInput,
) {
  const base64Data = input.imageDataUrl.split(',')[1]
  if (!base64Data) {
    throw new Error('Invalid image data URL')
  }

  const mimeMatch = input.imageDataUrl.match(/data:([^;]+);/)
  const mime = input.mimeType ?? mimeMatch?.[1] ?? 'image/jpeg'
  const ext = mime === 'image/webp' ? 'webp' : 'jpg'
  const buffer = Buffer.from(base64Data, 'base64')
  const imageId = crypto.randomUUID()
  const path = `users/${input.userId}/coffee-profiles/${input.profileId}/${imageId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(COFFEE_PROFILE_IMAGE_BUCKET)
    .upload(path, buffer, {
      contentType: mime,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data, error } = await supabase
    .from('coffee_profile_images')
    .insert({
      coffee_profile_id: input.profileId,
      user_id: input.userId,
      storage_bucket: COFFEE_PROFILE_IMAGE_BUCKET,
      storage_path: path,
      mime_type: mime,
      width: input.width,
      height: input.height,
      size_bytes: buffer.byteLength,
      is_primary: true,
    })
    .select()
    .single()

  if (error || !data) {
    await supabase.storage.from(COFFEE_PROFILE_IMAGE_BUCKET).remove([path])
    throw new Error(error?.message ?? 'Failed to save image metadata')
  }

  return data
}

export async function createCoffeeProfileSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(COFFEE_PROFILE_IMAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (error) return null
  return data?.signedUrl ?? null
}
