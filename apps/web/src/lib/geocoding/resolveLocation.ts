import { geocodeLocation } from './geocodeLocation';

export type ResolvedLocation = {
  location: string;
  latitude: number | null;
  longitude: number | null;
};

const GOOGLE_MAPS_HOSTS = ['google.com', 'google.com.ar', 'goo.gl', 'maps.app.goo.gl'];

function isGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return GOOGLE_MAPS_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function parseCoordinatesFromText(value: string): { latitude: number; longitude: number } | null {
  const atMatch = value.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { latitude: Number.parseFloat(atMatch[1]), longitude: Number.parseFloat(atMatch[2]) };
  }

  const searchMatch = value.match(/\/search\/(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/);
  if (searchMatch) {
    return { latitude: Number.parseFloat(searchMatch[1]), longitude: Number.parseFloat(searchMatch[2]) };
  }

  const qMatch = value.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/);
  if (qMatch) {
    return { latitude: Number.parseFloat(qMatch[1]), longitude: Number.parseFloat(qMatch[2]) };
  }

  const bangMatch = value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    return { latitude: Number.parseFloat(bangMatch[1]), longitude: Number.parseFloat(bangMatch[2]) };
  }

  return null;
}

async function followGoogleMapsUrl(url: string): Promise<string> {
  const response = await fetch(url.trim(), {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'Sanova-RWA-Platform/1.0' }
  });

  return response.url;
}

async function reverseGeocodeLabel(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Sanova-RWA-Platform/1.0' },
      next: { revalidate: 86400 }
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { display_name?: string };
    return payload.display_name?.trim() || null;
  } catch {
    return null;
  }
}

async function resolveCoordinates(trimmed: string): Promise<{ latitude: number; longitude: number } | null> {
  if (isGoogleMapsUrl(trimmed)) {
    const finalUrl = await followGoogleMapsUrl(trimmed);
    return parseCoordinatesFromText(finalUrl);
  }

  return parseCoordinatesFromText(trimmed) ?? (await geocodeLocation(trimmed));
}

export function locationNeedsResolve(
  location: string,
  latitude: number | null,
  longitude: number | null
): boolean {
  if (latitude == null || longitude == null) {
    return true;
  }

  try {
    const url = new URL(location.trim());
    return ['google.com', 'google.com.ar', 'goo.gl', 'maps.app.goo.gl'].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

/** Normalizes free text or Google Maps URLs into a display label plus coordinates. */
export async function resolveLocationInput(rawLocation: string): Promise<ResolvedLocation | null> {
  const trimmed = rawLocation.trim();
  if (!trimmed) {
    return null;
  }

  const coords = await resolveCoordinates(trimmed);
  if (!coords) {
    return { location: trimmed, latitude: null, longitude: null };
  }

  const label = (await reverseGeocodeLabel(coords.latitude, coords.longitude)) ?? trimmed;

  return {
    location: label,
    latitude: coords.latitude,
    longitude: coords.longitude
  };
}
