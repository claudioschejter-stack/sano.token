import { createHash } from 'crypto';
import type { KycMediaKind } from '@prisma/client';
import { prisma } from '@sanova/database';
import { firstIdVerification } from './extractDiditIdentity';
import {
  getAvatarStorageBucket,
  getKycDocumentStorageBucket,
  getPublicStorageUrl,
  getSupabaseAdmin,
  isSupabaseStorageConfigured
} from '../storage/supabaseAdmin';

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 400;

type MediaField = {
  kind: KycMediaKind;
  keys: string[];
  bucket: () => string;
  publicUrl: boolean;
};

const MEDIA_FIELDS: MediaField[] = [
  {
    kind: 'PORTRAIT',
    keys: ['portrait_image', 'portraitImage'],
    bucket: getAvatarStorageBucket,
    publicUrl: true
  },
  {
    kind: 'DOCUMENT_FRONT',
    keys: ['document_front', 'documentFront', 'front_image', 'frontImage'],
    bucket: getKycDocumentStorageBucket,
    publicUrl: false
  },
  {
    kind: 'DOCUMENT_BACK',
    keys: ['document_back', 'documentBack', 'back_image', 'backImage'],
    bucket: getKycDocumentStorageBucket,
    publicUrl: false
  },
  {
    kind: 'SELFIE',
    keys: ['selfie_image', 'selfieImage', 'selfie', 'liveness_image', 'livenessImage'],
    bucket: getKycDocumentStorageBucket,
    publicUrl: false
  }
];

function readMediaUrl(verification: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = verification[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) {
    return 'jpg';
  }

  if (contentType.includes('png')) {
    return 'png';
  }

  if (contentType.includes('webp')) {
    return 'webp';
  }

  return 'jpg';
}

function checksumFor(buffer: ArrayBuffer): string {
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadWithRetry(
  url: string
): Promise<{ buffer: ArrayBuffer; contentType: string | null } | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (response.ok) {
        const buffer = await response.arrayBuffer();

        if (buffer.byteLength > 0 && buffer.byteLength <= MAX_MEDIA_BYTES) {
          return { buffer, contentType: response.headers.get('content-type') };
        }

        return null;
      }
    } catch (error) {
      console.warn(
        '[diditMedia] download failed',
        attempt + 1,
        error instanceof Error ? error.message : error
      );
    }

    if (attempt < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  return null;
}

async function upsertKycDocument(input: {
  kycVerificationId: string;
  kind: KycMediaKind;
  bucket: string;
  storagePath: string;
  mimeType: string | null;
  checksum: string;
  sourceUrl: string;
}) {
  const existing = await prisma.kycDocument.findFirst({
    where: {
      kycVerificationId: input.kycVerificationId,
      kind: input.kind
    }
  });

  if (existing) {
    await prisma.kycDocument.update({
      where: { id: existing.id },
      data: {
        storageBucket: input.bucket,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        checksum: input.checksum,
        sourceUrl: input.sourceUrl
      }
    });
    return;
  }

  await prisma.kycDocument.create({
    data: {
      kycVerificationId: input.kycVerificationId,
      kind: input.kind,
      storageBucket: input.bucket,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      checksum: input.checksum,
      sourceUrl: input.sourceUrl
    }
  });
}

export async function persistDiditMedia(input: {
  userId: string;
  kycVerificationId: string;
  payload: Record<string, unknown>;
}): Promise<{ portraitPath: string | null; portraitUrl: string | null }> {
  if (!isSupabaseStorageConfigured()) {
    return { portraitPath: null, portraitUrl: null };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { portraitPath: null, portraitUrl: null };
  }

  const verification = firstIdVerification(input.payload);
  if (!verification) {
    return { portraitPath: null, portraitUrl: null };
  }

  let portraitPath: string | null = null;
  let portraitUrl: string | null = null;

  for (const field of MEDIA_FIELDS) {
    const sourceUrl = readMediaUrl(verification, field.keys);
    if (!sourceUrl) {
      continue;
    }

    const downloaded = await downloadWithRetry(sourceUrl);
    if (!downloaded) {
      continue;
    }

    const bucket = field.bucket();
    const extension = extensionFromContentType(downloaded.contentType);
    const storagePath = `${input.userId}/${input.kycVerificationId}/${field.kind.toLowerCase()}.${extension}`;
    const checksum = checksumFor(downloaded.buffer);

    const { error } = await supabase.storage.from(bucket).upload(storagePath, Buffer.from(downloaded.buffer), {
      contentType: downloaded.contentType ?? 'image/jpeg',
      upsert: true,
      cacheControl: field.publicUrl ? '3600' : 'private'
    });

    if (error) {
      console.error('[diditMedia] upload failed', field.kind, error.message);
      continue;
    }

    await upsertKycDocument({
      kycVerificationId: input.kycVerificationId,
      kind: field.kind,
      bucket,
      storagePath,
      mimeType: downloaded.contentType,
      checksum,
      sourceUrl
    });

    if (field.kind === 'PORTRAIT') {
      portraitPath = `${bucket}/${storagePath}`;

      if (field.publicUrl) {
        portraitUrl = getPublicStorageUrl(storagePath, bucket);
      }
    }
  }

  if (portraitPath) {
    await prisma.user.update({
      where: { id: input.userId },
      data: { kycPortraitPath: portraitPath }
    });

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { investorId: true }
    });

    if (user?.investorId) {
      await prisma.investor.update({
        where: { id: user.investorId },
        data: { portraitPath }
      });
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { image: true }
  });

  if (portraitUrl && !existingUser?.image) {
    await prisma.user.update({
      where: { id: input.userId },
      data: { image: portraitUrl }
    });
  }

  return { portraitPath, portraitUrl };
}
