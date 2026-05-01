import type { SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const COFFEE_PROFILE_IMAGE_BUCKET = 'coffee-bag-images'
const SIGNED_URL_TTL_SECONDS = 60 * 15
const MAX_IMAGE_BYTES = 500 * 1024
const MAX_DIMENSION_PX = 1600

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export type UploadProfileImageInput = {
  userId: string
  profileId: string
  buffer: Buffer
  mimeType: string
}

type OptimizedImage = {
  buffer: Buffer
  width: number
  height: number
  mimeType: 'image/webp'
}

export function assertSupportedCoffeeImageMimeType(mimeType: string) {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported image type')
  }
}

export async function optimizeCoffeeProfileImage(
  originalBuffer: Buffer,
): Promise<OptimizedImage> {
  const base = sharp(originalBuffer, { failOn: 'none' }).rotate()
  const resized = base.resize({
    width: MAX_DIMENSION_PX,
    height: MAX_DIMENSION_PX,
    fit: 'inside',
    withoutEnlargement: true,
  })

  let chosenBuffer: Buffer | null = null
  let chosenMeta: sharp.OutputInfo | null = null
  for (let quality = 80; quality >= 65; quality -= 5) {
    const { data, info } = await resized
      .clone()
      .webp({ quality })
      .toBuffer({ resolveWithObject: true })

    chosenBuffer = data
    chosenMeta = info
    if (data.byteLength <= MAX_IMAGE_BYTES) {
      break
    }
  }

  if (!chosenBuffer || !chosenMeta?.width || !chosenMeta.height) {
    throw new Error('Failed to optimize image')
  }

  return {
    buffer: chosenBuffer,
    width: chosenMeta.width,
    height: chosenMeta.height,
    mimeType: 'image/webp',
  }
}

export async function uploadCoffeeProfileImage(
  supabase: SupabaseClient,
  input: UploadProfileImageInput,
) {
  assertSupportedCoffeeImageMimeType(input.mimeType)

  const optimized = await optimizeCoffeeProfileImage(input.buffer)
  const imageId = crypto.randomUUID()
  const path = `users/${input.userId}/coffee-profiles/${input.profileId}/${imageId}.webp`

  const { error: uploadError } = await supabase.storage
    .from(COFFEE_PROFILE_IMAGE_BUCKET)
    .upload(path, optimized.buffer, {
      contentType: optimized.mimeType,
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
      mime_type: optimized.mimeType,
      width: optimized.width,
      height: optimized.height,
      size_bytes: optimized.buffer.byteLength,
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

type PrimaryImageRow = {
  id: string
  storage_path: string
}

export async function replaceCoffeeProfilePrimaryImage(
  supabase: SupabaseClient,
  input: UploadProfileImageInput,
) {
  const { data: currentPrimary } = await supabase
    .from('coffee_profile_images')
    .select('id, storage_path')
    .eq('coffee_profile_id', input.profileId)
    .eq('user_id', input.userId)
    .eq('is_primary', true)
    .maybeSingle<PrimaryImageRow>()

  if (currentPrimary) {
    const { error: demoteError } = await supabase
      .from('coffee_profile_images')
      .update({ is_primary: false })
      .eq('id', currentPrimary.id)
      .eq('user_id', input.userId)
    if (demoteError) throw new Error(demoteError.message)
  }

  const uploaded = await uploadCoffeeProfileImage(supabase, input)

  if (currentPrimary) {
    await supabase.storage
      .from(COFFEE_PROFILE_IMAGE_BUCKET)
      .remove([currentPrimary.storage_path])

    await supabase
      .from('coffee_profile_images')
      .delete()
      .eq('id', currentPrimary.id)
      .eq('user_id', input.userId)
  }

  return uploaded
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
