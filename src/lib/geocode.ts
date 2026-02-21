export interface GeoResult {
  lat: number
  lng: number
  displayName: string
}

export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VoteCircle/1.0' },
    })
    if (!res.ok) return null

    const data = await res.json()
    if (!data || data.length === 0) return null

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    }
  } catch {
    return null
  }
}

export async function geocodeZip(zip: string, state?: string): Promise<GeoResult | null> {
  const query = state ? `${zip}, ${state}, USA` : `${zip}, USA`
  return geocodeAddress(query)
}
