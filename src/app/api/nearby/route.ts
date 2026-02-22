import { NextRequest, NextResponse } from 'next/server'
import { getVoterFile } from '@/lib/mock-data'
import { SafeVoterRecord, VoterRecord } from '@/types'
import { geocodeAddress, geocodeZip } from '@/lib/geocode'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { getCampaignConfig } from '@/lib/campaign-config.server'

function sanitizeVoterRecord(record: VoterRecord): SafeVoterRecord {
  const { voter_id, date_of_birth, ...rest } = record
  return {
    ...rest,
    birth_year: date_of_birth ? date_of_birth.slice(0, 4) : undefined,
  }
}

/**
 * Parse a street address into components.
 */
function parseAddress(input: string): { number: string; streetName: string; zip: string | null } {
  const cleaned = input.trim()

  const zipMatch = cleaned.match(/\b(\d{5})\b/)
  const zip = zipMatch ? zipMatch[1] : null

  const streetMatch = cleaned.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#|suite|ste)|\s+\d{5}|$)/i)
  if (streetMatch) {
    const number = streetMatch[1]
    const streetName = streetMatch[2]
      .replace(/,.*$/, '')
      .replace(/\b(st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|ct|court|way|rd|road|pl|place|cir|circle|ter|terrace|trl|trail|pkwy|parkway|hwy|highway|loop)\b\.?\s*$/i, '')
      .trim()
    return { number, streetName: streetName.toLowerCase(), zip }
  }

  return { number: '', streetName: cleaned.replace(/\d{5}/, '').replace(/,.*$/, '').toLowerCase().trim(), zip }
}

/**
 * Extract street name from a voter record address.
 */
function extractStreetName(address: string): string {
  if (!address) return ''
  return address
    .replace(/^\d+\s+/, '')
    .replace(/\b(st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|ct|court|way|rd|road|pl|place|cir|circle|ter|terrace|trl|trail|pkwy|parkway|hwy|highway|loop)\b\.?\s*$/i, '')
    .toLowerCase()
    .trim()
}

/**
 * Haversine distance between two lat/lng points in meters.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Sort voters by distance from a center point using pre-stored lat/lng.
 * Voters without coordinates are placed at the end, grouped by street.
 */
function sortByDistance(
  voters: VoterRecord[],
  centerLat: number,
  centerLng: number
): { voter: VoterRecord; distance: number }[] {
  return voters
    .map(v => ({
      voter: v,
      distance: (v.lat != null && v.lng != null)
        ? haversineDistance(centerLat, centerLng, v.lat, v.lng)
        : 999999999, // No coords → end of list
    }))
    .sort((a, b) => {
      // Primary: distance
      if (Math.abs(a.distance - b.distance) > 5) return a.distance - b.distance
      // Secondary: same street grouped, then by house number
      const streetA = extractStreetName(a.voter.residential_address)
      const streetB = extractStreetName(b.voter.residential_address)
      if (streetA !== streetB) return streetA.localeCompare(streetB)
      const numA = parseInt(a.voter.residential_address) || 0
      const numB = parseInt(b.voter.residential_address) || 0
      return numA - numB
    })
}

/**
 * POST /api/nearby
 * Returns voter records near a given address or zip code, sorted by geographic distance.
 * Uses pre-stored lat/lng from geocoded voter file for instant distance calculation.
 */
export async function POST(request: NextRequest) {
  try {
  const ctx = await getRequestContext()

  let body: { address?: string; zip?: string; state: string; limit?: number; offset?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { address, zip, state, limit = 50, offset = 0 } = body

  if (!state || typeof state !== 'string' || !/^[A-Za-z]{2}$/.test(state)) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  if (!address && !zip) {
    return NextResponse.json({ error: 'Provide an address or zip code' }, { status: 400 })
  }

  const cleanState = state.toUpperCase()
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200)
  const safeOffset = Math.max(0, Number(offset) || 0)

  // Load campaign config to get campaign-specific voter file
  const campaignConfig = await getCampaignConfig(ctx.campaignId)
  const voterFile = getVoterFile(cleanState, campaignConfig.voterFile)

  // ─── ADDRESS-BASED SEARCH ────────────────────────────────────────────
  if (address && typeof address === 'string' && address.trim().length > 2) {
    const parsed = parseAddress(address.trim().slice(0, 200))
    const searchZip = parsed.zip || (zip ? zip.replace(/[^0-9]/g, '').slice(0, 5) : null)

    if (!searchZip && !parsed.streetName) {
      return NextResponse.json({ error: 'Could not parse address. Try including a zip code.' }, { status: 400 })
    }

    // Geocode the search address (single Nominatim call)
    const searchGeo = await geocodeAddress(address.trim().slice(0, 200))

    // Get active voters in same zip + neighboring zips
    let candidates: VoterRecord[] = []
    if (searchZip) {
      const sameZip = voterFile.filter(v =>
        v.zip.slice(0, 5) === searchZip && v.voter_status === 'Active'
      )
      const neighborZip = voterFile.filter(v =>
        v.zip.slice(0, 3) === searchZip.slice(0, 3) &&
        v.zip.slice(0, 5) !== searchZip &&
        v.voter_status === 'Active'
      )
      candidates = [...sameZip, ...neighborZip]
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        voters: [],
        total: 0,
        hasMore: false,
        address: address.trim().slice(0, 200),
        zip: searchZip || undefined,
      })
    }

    // Sort by distance using pre-stored coordinates
    let sorted: { voter: VoterRecord; distance: number }[]

    if (searchGeo) {
      sorted = sortByDistance(candidates, searchGeo.lat, searchGeo.lng)
    } else {
      // Fallback: no geocode for search address — use street-name matching
      sorted = candidates.map(v => {
        const voterStreet = extractStreetName(v.residential_address)
        let proximity = 0

        if (parsed.streetName && voterStreet === parsed.streetName) {
          proximity = 10000
          const searchNum = parsed.number ? parseInt(parsed.number) : NaN
          const voterNum = parseInt(v.residential_address)
          if (!isNaN(searchNum) && !isNaN(voterNum)) {
            proximity += Math.max(0, 5000 - Math.abs(voterNum - searchNum) * 10)
          }
        } else if (parsed.streetName && (voterStreet.includes(parsed.streetName) || parsed.streetName.includes(voterStreet))) {
          proximity = 5000
        } else {
          proximity = 1
        }

        return { voter: v, distance: -proximity } // Negative so higher proximity = lower distance
      }).sort((a, b) => a.distance - b.distance)
    }

    // Deduplicate
    const seen = new Set<string>()
    const deduped = sorted.filter(s => {
      const key = `${s.voter.first_name}-${s.voter.last_name}-${s.voter.residential_address}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const total = deduped.length
    const results = deduped.slice(safeOffset, safeOffset + safeLimit).map(s => sanitizeVoterRecord(s.voter))

    return NextResponse.json({
      voters: results,
      total,
      hasMore: safeOffset + safeLimit < total,
      address: address.trim().slice(0, 200),
      zip: searchZip || undefined,
      centerLat: searchGeo?.lat,
      centerLng: searchGeo?.lng,
    })
  }

  // ─── ZIP-BASED SEARCH ────────────────────────────────────────────────
  if (!zip || typeof zip !== 'string' || !/^\d{5}$/.test(zip.trim())) {
    return NextResponse.json({ error: 'Invalid zip code (must be 5 digits)' }, { status: 400 })
  }

  const cleanZip = zip.trim()

  // Geocode the zip center
  const zipGeo = await geocodeZip(cleanZip, cleanState)

  const sameZip = voterFile.filter(v => v.zip.slice(0, 5) === cleanZip && v.voter_status === 'Active')
  const samePrefix = voterFile.filter(v =>
    v.zip.slice(0, 3) === cleanZip.slice(0, 3) &&
    v.zip.slice(0, 5) !== cleanZip &&
    v.voter_status === 'Active'
  )
  const combined = [...sameZip, ...samePrefix]

  let sorted: { voter: VoterRecord; distance: number }[]

  if (zipGeo && combined.length > 0) {
    sorted = sortByDistance(combined, zipGeo.lat, zipGeo.lng)
  } else {
    // Fallback: group by street
    sorted = combined.map(v => ({ voter: v, distance: 0 }))
    sorted.sort((a, b) => {
      const streetA = extractStreetName(a.voter.residential_address)
      const streetB = extractStreetName(b.voter.residential_address)
      if (streetA !== streetB) return streetA.localeCompare(streetB)
      return (parseInt(a.voter.residential_address) || 0) - (parseInt(b.voter.residential_address) || 0)
    })
  }

  // Deduplicate
  const seen = new Set<string>()
  const deduped = sorted.filter(s => {
    const key = `${s.voter.first_name}-${s.voter.last_name}-${s.voter.residential_address}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const total = deduped.length
  const paged = deduped.slice(safeOffset, safeOffset + safeLimit).map(s => sanitizeVoterRecord(s.voter))

  return NextResponse.json({
    voters: paged,
    total,
    hasMore: safeOffset + safeLimit < total,
    zip: cleanZip,
    centerLat: zipGeo?.lat,
    centerLng: zipGeo?.lng,
  })

  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[nearby] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
