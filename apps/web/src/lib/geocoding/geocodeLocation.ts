export async function geocodeLocation(
  location: string
): Promise<{ latitude: number; longitude: number } | null> {
  const query = location.trim();
  if (!query) return null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Sanova-RWA-Platform/1.0' },
      next: { revalidate: 86400 }
    });

    if (!response.ok) return null;

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    const latitude = Number.parseFloat(first.lat);
    const longitude = Number.parseFloat(first.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  } catch {
    return null;
  }
}
