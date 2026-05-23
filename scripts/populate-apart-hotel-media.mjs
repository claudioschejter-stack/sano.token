import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(root, '.env') });

const prisma = new PrismaClient();
const projectId = 'proj-apart-hotel-urban-view';
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'launches';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STOCK_IMAGES = [
  {
    name: 'fachada-apart-hotel.jpg',
    source:
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80',
    caption: 'Fachada Apart Hotel Urban View'
  },
  {
    name: 'living-departamento.jpg',
    source:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80',
    caption: 'Living departamento amoblado'
  },
  {
    name: 'habitacion-suite.jpg',
    source:
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&q=80',
    caption: 'Suite corporativa'
  }
];

function publicUrl(objectPath) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
}

async function geocodeLocation(location) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', location);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Sanova-RWA-Platform/1.0' }
  });

  if (!response.ok) return null;
  const results = await response.json();
  const first = results[0];
  if (!first) return null;

  return {
    latitude: Number.parseFloat(first.lat),
    longitude: Number.parseFloat(first.lon)
  };
}

async function uploadImage(name, sourceUrl) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${sourceUrl}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const objectPath = `${projectId}/${name}`;

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600'
  });

  if (error) {
    throw new Error(error.message);
  }

  return publicUrl(objectPath);
}

const project = await prisma.project.findUnique({ where: { id: projectId } });
if (!project) {
  throw new Error('Project not found');
}

const mediaGallery = [];

for (const image of STOCK_IMAGES) {
  const url = await uploadImage(image.name, image.source);
  mediaGallery.push({ type: 'image', url, caption: image.caption });
  console.log('Uploaded', image.name);
}

const coords =
  (await geocodeLocation(project.location)) ??
  (await geocodeLocation('Añelo, Neuquén, Argentina'));
const primaryImage = mediaGallery[0]?.url ?? null;

await prisma.project.update({
  where: { id: projectId },
  data: {
    image: primaryImage,
    mediaGallery,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    contractTrustUrl: null,
    contractPurchaseUrl: null,
    contractLeaseUrl: null,
    contractSmartUrl: null
  }
});

console.log('Updated project', {
  image: primaryImage,
  galleryCount: mediaGallery.length,
  latitude: coords?.latitude,
  longitude: coords?.longitude
});

await prisma.$disconnect();
