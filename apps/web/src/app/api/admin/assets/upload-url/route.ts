import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import {
  getLaunchStorageBucket,
  getPublicStorageUrl,
  getSupabaseAdmin,
  isSupabaseStorageConfigured
} from '../../../../../lib/storage/supabaseAdmin';
import {
  LAUNCH_UPLOAD_MAX_BYTES,
  resolveLaunchUploadMimeType,
  resolveLaunchUploadKind,
  validateLaunchUpload
} from '../../../../../lib/storage/uploadLaunchAsset';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function sanitizeFolder(folder: string): string {
  return folder.replace(/[^a-zA-Z0-9._/-]/g, '_').slice(0, 80);
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ error: 'STORAGE_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      fileName?: string;
      mimeType?: string;
      size?: number;
      folder?: string;
    };

    const fileName = body.fileName?.trim();
    const folder = body.folder?.trim() || 'general';
    const size = Number(body.size ?? 0);
    const mimeType = resolveLaunchUploadMimeType(body.mimeType ?? '', fileName ?? '');

    if (!fileName) {
      return NextResponse.json({ error: 'Missing file name' }, { status: 400 });
    }

    const validationError = validateLaunchUpload(body.mimeType ?? '', size, fileName);
    if (validationError === 'unsupported_type') {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    if (validationError === 'too_large') {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(LAUNCH_UPLOAD_MAX_BYTES / (1024 * 1024))} MB)` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'STORAGE_NOT_CONFIGURED' }, { status: 503 });
    }

    const bucket = getLaunchStorageBucket();
    const safeFolder = sanitizeFolder(folder);
    const objectPath = `${safeFolder}/${Date.now()}-${sanitizeFilename(fileName)}`;

    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectPath);

    if (error || !data?.signedUrl) {
      console.error('[admin/assets/upload-url]', error);
      return NextResponse.json(
        { error: 'Upload failed', detail: error?.message ?? 'Could not create signed upload URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      url: getPublicStorageUrl(objectPath),
      kind: resolveLaunchUploadKind(mimeType),
      mimeType,
      storage: 'supabase'
    });
  } catch (error) {
    console.error('[admin/assets/upload-url]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
