import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(root, '.env') });

const prisma = new PrismaClient();

async function geocode(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Sanova-RWA-Platform/1.0' }
  });

  const results = await response.json();
  const first = results[0];
  if (!first) return null;

  return {
    latitude: Number.parseFloat(first.lat),
    longitude: Number.parseFloat(first.lon)
  };
}

const coords = (await geocode('Añelo, Neuquén, Argentina')) ?? {
  latitude: -38.3554,
  longitude: -68.7889
};

await prisma.project.update({
  where: { id: 'proj-apart-hotel-urban-view' },
  data: coords
});

console.log('Geocoded:', coords);
await prisma.$disconnect();
