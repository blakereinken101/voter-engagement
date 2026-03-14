import { NextRequest, NextResponse } from 'next/server'
import { getVoterFile, NoVoterDataError } from '@/lib/mock-data'
import { SafeVoterRecord, VoterRecord } from '@/types'
import { geocodeAddress, geocodeZip } from '@/lib/geocode'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { getCampaignConfig } from '@/lib/campaign-config.server'
import { getDatasetForCampaign, queryVotersByZip, queryVotersByZipPrefix, queryVotersByGeo, queryVotersByCity } from '@/lib/voter-db'

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
function parseAddress(input: string): { number: string; streetName: string; zip: string | null; city: string | null } {
  const cleaned = input.trim()

  const zipMatch = cleaned.match(/\b(\d{5})\b/)
  const zip = zipMatch ? zipMatch[1] : null

  // Try to extract city from comma-separated parts (e.g., "123 Main St, Springfield")
  const commaParts = cleaned.split(',').map(s => s.trim())
  let city: string | null = null
  if (commaParts.length >= 2) {
    // City is typically the part after the first comma, before state/zip
    const cityCandidate = commaParts[1]
      .replace(/\b[A-Z]{2}\b/, '')  // remove state abbreviation
      .replace(/\d{5}/, '')          // remove zip
      .trim()
    if (cityCandidate.length >= 2) {
      city = cityCandidate
    }
  }

  const streetMatch = cleaned.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#|suite|ste)|\s+\d{5}|$)/i)
  if (streetMatch) {
    const number = streetMatch[1]
    const streetName = streetMatch[2]
      .replace(/,.*$/, '')
      .replace(/\b(st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|ct|court|way|rd|road|pl|place|cir|circle|ter|terrace|trl|trail|pkwy|parkway|hwy|highway|loop)\b\.?\s*$/i, '')
      .trim()
    return { number, streetName: streetName.toLowerCase(), zip, city }
  }

  // No street number — might be just a city or street name
  const remaining = cleaned.replace(/\d{5}/, '').replace(/,.*$/, '').trim()
  return { number: '', streetName: remaining.toLowerCase(), zip, city: city || remaining }
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
 * Simple fuzzy street name match using Levenshtein-like comparison.
 * Returns true if the edit distance is small relative to the string length.
 */
function fuzzyStreetMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return true
  if (Math.abs(a.length - b.length) > 3) return false

  // Simple edit distance (optimized for short strings)
  const la = a.length, lb = b.length
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  const dist = dp[la][lb]
  // Allow up to 2 edits for short names, scale for longer ones
  const threshold = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3
  return dist <= threshold
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

  // Try DB-backed dataset first, fall back to file
  const assignment = await getDatasetForCampaign(ctx.campaignId)
  let voterFile: VoterRecord[] | null = null
  if (!assignment) {
    const campaignConfig = await getCampaignConfig(ctx.campaignId)
    voterFile = await getVoterFile(cleanState, campaignConfig.voterFile)
  }

  // ─── ADDRESS-BASED SEARCH ────────────────────────────────────────────
  if (address && typeof address === 'string' && address.trim().length > 2) {
    const parsed = parseAddress(address.trim().slice(0, 200))
    const searchZip = parsed.zip || (zip ? zip.replace(/[^0-9]/g, '').slice(0, 5) : null)

    if (!searchZip && !parsed.streetName && !parsed.city) {
      return NextResponse.json({ error: 'Could not parse address. Try including a city name or zip code.' }, { status: 400 })
    }

    // Geocode the search address (single Nominatim call)
    // Append state for better geocoding results (e.g. "123 Main St, Easton" → "123 Main St, Easton, CT")
    const geoQuery = address.trim().slice(0, 200) + (cleanState ? `, ${cleanState}` : '')
    const searchGeo = await geocodeAddress(geoQuery)

    // Get active voters — strategy depends on what info we have
    let candidates: VoterRecord[] = []

    if (searchZip) {
      // Zip code available: use zip-based queries
      if (assignment) {
        const [sameZip, neighborZip] = await Promise.all([
          queryVotersByZip(assignment.datasetId, searchZip, true, assignment.filters),
          queryVotersByZipPrefix(assignment.datasetId, searchZip.slice(0, 3), searchZip, true, assignment.filters),
        ])
        candidates = [...sameZip, ...neighborZip]
      } else {
        const sameZip = voterFile!.filter(v =>
          v.zip.slice(0, 5) === searchZip && v.voter_status === 'Active'
        )
        const neighborZip = voterFile!.filter(v =>
          v.zip.slice(0, 3) === searchZip.slice(0, 3) &&
          v.zip.slice(0, 5) !== searchZip &&
          v.voter_status === 'Active'
        )
        candidates = [...sameZip, ...neighborZip]
      }
    } else if (searchGeo && assignment) {
      // No zip but geocoding succeeded: use geographic bounding box query
      candidates = await queryVotersByGeo(
        assignment.datasetId, searchGeo.lat, searchGeo.lng, 0.02, true, assignment.filters
      )
      // If too few results, widen the search radius
      if (candidates.length < 10) {
        candidates = await queryVotersByGeo(
          assignment.datasetId, searchGeo.lat, searchGeo.lng, 0.05, true, assignment.filters
        )
      }
    } else if (parsed.city && assignment) {
      // No zip, no geocode: try city-based search
      candidates = await queryVotersByCity(
        assignment.datasetId, parsed.city, true, assignment.filters
      )
    } else if (!assignment && voterFile) {
      // File-based fallback: filter by city name (fuzzy)
      const searchCity = (parsed.city || '').toLowerCase()
      const searchStreet = parsed.streetName.toLowerCase()
      if (searchGeo) {
        // Use geo sort on file-based voters with coordinates
        candidates = voterFile.filter(v =>
          v.voter_status === 'Active' && v.lat != null && v.lng != null
        )
      } else if (searchCity) {
        candidates = voterFile.filter(v =>
          v.voter_status === 'Active' && v.city.toLowerCase().includes(searchCity)
        )
      } else if (searchStreet) {
        candidates = voterFile.filter(v =>
          v.voter_status === 'Active' &&
          extractStreetName(v.residential_address).includes(searchStreet)
        )
      }
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
      // Fallback: no geocode for search address — use fuzzy street-name matching
      sorted = candidates.map(v => {
        const voterStreet = extractStreetName(v.residential_address)
        let proximity = 0

        if (parsed.streetName) {
          if (voterStreet === parsed.streetName) {
            proximity = 10000
          } else if (voterStreet.includes(parsed.streetName) || parsed.streetName.includes(voterStreet)) {
            // Partial match (handles misspellings where one is a substring of the other)
            proximity = 5000
          } else if (fuzzyStreetMatch(parsed.streetName, voterStreet)) {
            // Fuzzy match for misspellings
            proximity = 3000
          } else {
            proximity = 1
          }

          // Boost by house number proximity
          const searchNum = parsed.number ? parseInt(parsed.number) : NaN
          const voterNum = parseInt(v.residential_address)
          if (!isNaN(searchNum) && !isNaN(voterNum) && proximity >= 3000) {
            proximity += Math.max(0, 5000 - Math.abs(voterNum - searchNum) * 10)
          }
        }

        return { voter: v, distance: -proximity }
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

  let combined: VoterRecord[]
  if (assignment) {
    const [sameZip, samePrefix] = await Promise.all([
      queryVotersByZip(assignment.datasetId, cleanZip, true, assignment.filters),
      queryVotersByZipPrefix(assignment.datasetId, cleanZip.slice(0, 3), cleanZip, true, assignment.filters),
    ])
    combined = [...sameZip, ...samePrefix]
  } else {
    const sameZip = voterFile!.filter(v => v.zip.slice(0, 5) === cleanZip && v.voter_status === 'Active')
    const samePrefix = voterFile!.filter(v =>
      v.zip.slice(0, 3) === cleanZip.slice(0, 3) &&
      v.zip.slice(0, 5) !== cleanZip &&
      v.voter_status === 'Active'
    )
    combined = [...sameZip, ...samePrefix]
  }

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
    if (error instanceof NoVoterDataError) {
      console.error('[nearby]', error.message)
      return NextResponse.json({
        error: 'No voter data configured for this campaign. An admin needs to upload a voter dataset in the platform admin.',
        code: error.code,
      }, { status: 422 })
    }
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[nearby] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
