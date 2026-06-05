import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(file) {
  const path = resolve(root, file);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

const env = {
  ...loadEnv('.env'),
  ...loadEnv('apps/web/.env.local')
};

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
const bucket = env.SUPABASE_STORAGE_BUCKET || 'launches';

if (!url || !key) {
  console.error('Missing SUPABASE_URL or service role key in apps/web/.env.local');
  process.exit(1);
}

const allowedMimeTypes = [
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
];

const supabase = createClient(url, key);
let { data, error } = await supabase.storage.updateBucket(bucket, {
  public: true,
  allowedMimeTypes
});

if (error?.message?.includes('maximum allowed size')) {
  ({ data, error } = await supabase.storage.updateBucket(bucket, {
    public: true,
    fileSizeLimit: 20971520,
    allowedMimeTypes
  }));
}

if (error) {
  console.error('Failed to update bucket:', error.message);
  process.exit(1);
}

console.log('Bucket updated:', data?.name ?? bucket);
console.log('allowedMimeTypes:', allowedMimeTypes.join(', '));
console.log('fileSizeLimit: 100 MB');
