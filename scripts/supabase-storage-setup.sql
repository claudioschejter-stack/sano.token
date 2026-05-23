-- Run once in Supabase SQL Editor (Dashboard → SQL)
-- Creates public-read bucket for launch media & contract PDFs

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'launches',
  'launches',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for marketplace cards
drop policy if exists "Public read launch assets" on storage.objects;
create policy "Public read launch assets"
on storage.objects for select
using (bucket_id = 'launches');

-- Service role bypasses RLS; admin uploads go through Next.js API with service key only.
