import { prisma } from '@sanova/database';
import { firstIdVerification } from './extractDiditIdentity';
import {
  getAvatarStorageBucket,
  getPublicStorageUrl,
  getSupabaseAdmin,
  isSupabaseStorageConfigured
} from '../storage/supabaseAdmin';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function readPortraitUrl(payload: Record<string, unknown>): string | undefined {
  const verification = firstIdVerification(payload);
  const value = verification?.portrait_image ?? verification?.portraitImage;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

/**
 * Best-effort: Didit's `id_verifications[0].portrait_image` is a short-lived signed URL
 * ("download promptly, never persist the URL"). This downloads it once at KYC-approval
 * time and re-hosts it in our own storage, saving the stable URL to `User.image`.
 * Never throws — profile photo is a nice-to-have, not a blocker for KYC approval.
 */
export async function storeDiditProfilePhoto(
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    if (!isSupabaseStorageConfigured()) {
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
    if (existing?.image) {
      // Don't overwrite an existing avatar (e.g. one already set via OAuth).
      return;
    }

    const portraitUrl = readPortraitUrl(payload);
    if (!portraitUrl) {
      return;
    }

    const response = await fetch(portraitUrl);
    if (!response.ok) {
      return;
    }

    const contentType = response.headers.get('content-type');
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_PHOTO_BYTES) {
      return;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return;
    }

    const bucket = getAvatarStorageBucket();
    const objectPath = `${userId}/${Date.now()}.${extensionFromContentType(contentType)}`;

    const { error } = await supabase.storage.from(bucket).upload(objectPath, Buffer.from(arrayBuffer), {
      contentType: contentType ?? 'image/jpeg',
      upsert: true,
      cacheControl: '3600'
    });

    if (error) {
      console.error('[diditPhoto] upload failed', error.message);
      return;
    }

    const url = getPublicStorageUrl(objectPath, bucket);
    await prisma.user.update({ where: { id: userId }, data: { image: url } });
  } catch (error) {
    console.error('[diditPhoto] unexpected error', error instanceof Error ? error.message : error);
  }
}
