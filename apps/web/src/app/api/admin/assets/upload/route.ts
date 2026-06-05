import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { uploadLaunchAsset, validateLaunchUpload } from '../../../../../lib/storage/uploadLaunchAsset';

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = String(formData.get('folder') ?? 'general');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const validationError = validateLaunchUpload(file.type, file.size, file.name);
    if (validationError === 'unsupported_type') {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    if (validationError === 'too_large') {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadLaunchAsset({
      buffer,
      mimeType: file.type,
      originalName: file.name,
      folder
    });

    return NextResponse.json({
      url: result.url,
      kind: result.kind,
      name: file.name,
      storage: result.storage
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    console.error('[admin/assets/upload]', error);

    if (code === 'STORAGE_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'STORAGE_NOT_CONFIGURED' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
