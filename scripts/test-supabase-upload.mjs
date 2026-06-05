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
  ...loadEnv('.env.local'),
  ...loadEnv('apps/web/.env.local'),
  ...loadEnv('.env.vercel.production'),
  ...loadEnv('apps/web/.env.vercel.test'),
  ...loadEnv('apps/web/.env.local')
};

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
const bucket = env.SUPABASE_STORAGE_BUCKET || 'launches';

if (!url || !key) {
  console.error('Missing SUPABASE_URL or service role key');
  process.exit(1);
}

const supabase = createClient(url, key);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=', 'base64');

const tests = [
  { name: 'probe.png', contentType: 'image/png', buffer: png },
  { name: 'probe.jpg', contentType: 'image/jpeg', buffer: jpeg },
  { name: 'probe-jpg-alias.jpg', contentType: 'image/jpg', buffer: jpeg },
  { name: 'probe.heic', contentType: 'image/heic', buffer: png },
  { name: 'probe.mov', contentType: 'video/quicktime', buffer: png }
];

for (const test of tests) {
  const objectPath = `test-upload-probe/${Date.now()}-${test.name}`;
  const { error } = await supabase.storage.from(bucket).upload(objectPath, test.buffer, {
    contentType: test.contentType,
    upsert: false
  });

  if (error) {
    console.log(`FAIL ${test.contentType}: ${error.message}`);
  } else {
    console.log(`OK ${test.contentType}`);
    await supabase.storage.from(bucket).remove([objectPath]);
  }
}

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.log('LIST_BUCKETS_ERROR:', listError.message);
} else {
  const launchBucket = buckets?.find((b) => b.name === bucket || b.id === bucket);
  console.log('BUCKET:', JSON.stringify(launchBucket, null, 2));
}
