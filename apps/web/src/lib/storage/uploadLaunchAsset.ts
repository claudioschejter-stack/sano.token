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
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
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

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf'
};

const GENERIC_BROWSER_MIME = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function resolveKind(mimeType: string): UploadLaunchAssetResult['kind'] {
  if (mimeType.startsWith('video/')) return 'reel';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'image';
}

export function resolveLaunchUploadKind(mimeType: string): UploadLaunchAssetResult['kind'] {
  return resolveKind(mimeType);
}

export function resolveLaunchUploadMimeType(mimeType: string, originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
  const fromExt = ext ? MIME_BY_EXTENSION[ext] : undefined;
  const normalized = mimeType?.trim().toLowerCase() ?? '';

  if (fromExt && (GENERIC_BROWSER_MIME.has(normalized) || normalized === 'image/jpg')) {
    return fromExt;
  }

  if (normalized === 'image/jpg') {
    return 'image/jpeg';
  }

  if (fromExt && !ALLOWED_TYPES.has(normalized)) {
    return fromExt;
  }

  return normalized || fromExt || mimeType;
}

export function validateLaunchUpload(mimeType: string, size: number, originalName = ''): string | null {
  const resolved = resolveLaunchUploadMimeType(mimeType, originalName);
  if (!ALLOWED_TYPES.has(resolved)) {
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
  const normalizedInput = {
    ...input,
    mimeType: resolveLaunchUploadMimeType(input.mimeType, input.originalName)
  };

  if (isSupabaseStorageConfigured()) {
    return uploadToSupabase(normalizedInput);
  }

  if (process.env.VERCEL) {
    throw new Error('STORAGE_NOT_CONFIGURED');
  }

  return uploadToLocalDisk(normalizedInput);
}

export { isSupabaseStorageConfigured, MAX_BYTES as LAUNCH_UPLOAD_MAX_BYTES };
