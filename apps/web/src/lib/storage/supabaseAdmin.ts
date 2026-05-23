import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ugdmfewgxohbwggdiahp.supabase.co';

let adminClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL).trim().replace(/\/$/, '');
}

/** Server-side key: prefer service_role; accepts SUPABASE_KEY (dashboard quickstart name). */
export function getSupabaseServiceKey(): string | null {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_KEY?.trim() ||
    null;

  return key || null;
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();

  if (!url || !key) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClient;
}

/** Matches Supabase dashboard quickstart — server-only, same client as admin uploads. */
export function createSupabaseClient(): SupabaseClient | null {
  return getSupabaseAdmin();
}

export function getLaunchStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'launches';
}

export function getPublicStorageUrl(objectPath: string): string {
  const base = getSupabaseUrl();
  const bucket = getLaunchStorageBucket();
  return `${base}/storage/v1/object/public/${bucket}/${objectPath}`;
}
