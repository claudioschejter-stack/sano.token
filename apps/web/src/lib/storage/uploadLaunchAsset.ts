import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getLaunchStorageBucket,
  getPublicStorageUrl,
  getSupabaseAdmin,
  isSupabaseStorageConfigured
} from './supabaseAdmin';

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf'
]);

export type UploadLaunchAssetInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  folder: string;
};

export type UploadLaunchAssetResult = {
  url: string;
  kind: 'image' | 'reel' | 'pdf';
  storage: 'supabase' | 'local';
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function sanitizeFolder(folder: string): string {
  return folder.replace(/[^a-zA-Z0-9._/-]/g, '_').slice(0, 80);
}

function resolveKind(mimeType: string): UploadLaunchAssetResult['kind'] {
  if (mimeType.startsWith('video/')) return 'reel';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'image';
}

export function validateLaunchUpload(mimeType: string, size: number): string | null {
  if (!ALLOWED_TYPES.has(mimeType)) {
    return 'unsupported_type';
  }

  if (size > MAX_BYTES) {
    return 'too_large';
  }

  return null;
}

async function uploadToSupabase(input: UploadLaunchAssetInput): Promise<UploadLaunchAssetResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const bucket = getLaunchStorageBucket();
  const safeFolder = sanitizeFolder(input.folder);
  const objectPath = `${safeFolder}/${Date.now()}-${sanitizeFilename(input.originalName)}`;

  const { error } = await supabase.storage.from(bucket).upload(objectPath, input.buffer, {
    contentType: input.mimeType,
    upsert: false,
    cacheControl: '3600'
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    url: getPublicStorageUrl(objectPath),
    kind: resolveKind(input.mimeType),
    storage: 'supabase'
  };
}

async function uploadToLocalDisk(input: UploadLaunchAssetInput): Promise<UploadLaunchAssetResult> {
  const safeFolder = sanitizeFolder(input.folder);
  const safeName = `${Date.now()}-${sanitizeFilename(input.originalName)}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'launches', safeFolder);
  await mkdir(uploadDir, { recursive: true });

  const diskPath = path.join(uploadDir, safeName);
  await writeFile(diskPath, input.buffer);

  return {
    url: `/uploads/launches/${safeFolder}/${safeName}`,
    kind: resolveKind(input.mimeType),
    storage: 'local'
  };
}

export async function uploadLaunchAsset(input: UploadLaunchAssetInput): Promise<UploadLaunchAssetResult> {
  if (isSupabaseStorageConfigured()) {
    try {
      return await uploadToSupabase(input);
    } catch (error) {
      console.error('[uploadLaunchAsset] Supabase failed, falling back to local disk:', error);
    }
  }

  return uploadToLocalDisk(input);
}

export { isSupabaseStorageConfigured, MAX_BYTES as LAUNCH_UPLOAD_MAX_BYTES };
