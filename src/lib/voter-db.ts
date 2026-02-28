import { getPool } from './db'
import type { VoterRecord, VoteValue } from '@/types'

// =============================================
// DB-backed voter data access layer
// Replaces in-memory getVoterFile() for campaigns
// that have a voter dataset assigned.
// =============================================

/**
 * Geographic filters that scope a dataset to a subset of voters.
 * Used when a statewide dataset is assigned to a campaign with
 * geographic restrictions (e.g., only HD-91 voters).
 */
export interface GeoFilters {
  congressional?: string | null
  stateSenate?: string | null
  stateHouse?: string | null
  city?: string | null
  zip?: string | null
}

export interface DatasetAssignment {
  datasetId: string
  filters: GeoFilters
}

/**
 * Build WHERE clause fragments and params for geographic filters.
 * Returns { clause, params, nextIdx } to append to existing queries.
 */
function buildGeoWhere(filters: GeoFilters | undefined, startIdx: number): {
  clause: string
  params: unknown[]
  nextIdx: number
} {
  if (!filters) return { clause: '', params: [], nextIdx: startIdx }

  const parts: string[] = []
  const params: unknown[] = []
  let idx = startIdx

  if (filters.congressional) {
    const vals = filters.congressional.split(',').map(v => v.trim()).filter(Boolean)
    if (vals.length === 1) {
      parts.push(`AND congressional_district = $${idx++}`)
      params.push(vals[0])
    } else if (vals.length > 1) {
      parts.push(`AND congressional_district = ANY($${idx++})`)
      params.push(vals)
    }
  }
  if (filters.stateSenate) {
    const vals = filters.stateSenate.split(',').map(v => v.trim()).filter(Boolean)
    if (vals.length === 1) {
      parts.push(`AND state_senate_district = $${idx++}`)
      params.push(vals[0])
    } else if (vals.length > 1) {
      parts.push(`AND state_senate_district = ANY($${idx++})`)
      params.push(vals)
    }
  }
  if (filters.stateHouse) {
    const vals = filters.stateHouse.split(',').map(v => v.trim()).filter(Boolean)
    if (vals.length === 1) {
      parts.push(`AND state_house_district = $${idx++}`)
      params.push(vals[0])
    } else if (vals.length > 1) {
      parts.push(`AND state_house_district = ANY($${idx++})`)
      params.push(vals)
    }
  }
  if (filters.city) {
    const vals = filters.city.split(',').map(v => v.trim()).filter(Boolean)
    if (vals.length === 1) {
      parts.push(`AND city = $${idx++}`)
      params.push(vals[0])
    } else if (vals.length > 1) {
      parts.push(`AND city = ANY($${idx++})`)
      params.push(vals)
    }
  }
  if (filters.zip) {
    const vals = filters.zip.split(',').map(v => v.trim()).filter(Boolean)
    if (vals.length === 1) {
      parts.push(`AND zip = $${idx++}`)
      params.push(vals[0])
    } else if (vals.length > 1) {
      parts.push(`AND zip = ANY($${idx++})`)
      params.push(vals)
    }
  }

  return { clause: parts.join(' '), params, nextIdx: idx }
}

/**
 * Get the dataset assignment for a campaign (if any).
 * Returns dataset ID + geographic filters, or null.
 */
export async function getDatasetForCampaign(campaignId: string): Promise<DatasetAssignment | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT cvd.dataset_id,
            cvd.filter_congressional,
            cvd.filter_state_senate,
            cvd.filter_state_house,
            cvd.filter_city,
            cvd.filter_zip
     FROM campaign_voter_datasets cvd
     JOIN voter_datasets vd ON vd.id = cvd.dataset_id
     WHERE cvd.campaign_id = $1 AND vd.status = 'ready'
     LIMIT 1`,
    [campaignId]
  )
  if (!rows[0]) return null

  const row = rows[0]
  return {
    datasetId: row.dataset_id,
    filters: {
      congressional: row.filter_congressional || null,
      stateSenate: row.filter_state_senate || null,
      stateHouse: row.filter_state_house || null,
      city: row.filter_city || null,
      zip: row.filter_zip || null,
    },
  }
}

/**
 * Map a DB row to VoterRecord shape.
 */
function rowToVoterRecord(row: Record<string, unknown>): VoterRecord {
  return {
    voter_id: row.voter_id as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    date_of_birth: (row.date_of_birth as string) || '',
    gender: (row.gender as 'M' | 'F' | 'U') || 'U',
    residential_address: (row.residential_address as string) || '',
    city: (row.city as string) || '',
    state: (row.state as string) || '',
    zip: (row.zip as string) || '',
    party_affiliation: (row.party_affiliation as VoterRecord['party_affiliation']) || 'UNR',
    registration_date: (row.registration_date as string) || '',
    voter_status: (row.voter_status as 'Active' | 'Inactive' | 'Purged') || 'Active',
    VH2024G: ((row.vh2024g as string) || '') as VoteValue,
    VH2022G: ((row.vh2022g as string) || '') as VoteValue,
    VH2020G: ((row.vh2020g as string) || '') as VoteValue,
    VH2024P: ((row.vh2024p as string) || '') as VoteValue,
    VH2022P: ((row.vh2022p as string) || '') as VoteValue,
    VH2020P: ((row.vh2020p as string) || '') as VoteValue,
    lat: row.lat as number | null | undefined,
    lng: row.lng as number | null | undefined,
    congressional_district: (row.congressional_district as string) || null,
    state_senate_district: (row.state_senate_district as string) || null,
    state_house_district: (row.state_house_district as string) || null,
  }
}

const VOTER_SELECT = `voter_id, first_name, last_name, date_of_birth, gender,
  residential_address, city, state, zip, party_affiliation, registration_date,
  voter_status, vh2024g, vh2022g, vh2020g, vh2024p, vh2022p, vh2020p, lat, lng,
  congressional_district, state_senate_district, state_house_district`

/**
 * Pass 1: Exact last name lookup.
 * Returns voters matching any of the given normalized last names.
 */
export async function queryVotersForMatch(
  datasetId: string,
  lastNames: string[],
  filters?: GeoFilters
): Promise<VoterRecord[]> {
  if (lastNames.length === 0) return []
  const pool = getPool()
  const geo = buildGeoWhere(filters, 3)
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1 AND last_name_normalized = ANY($2) ${geo.clause}`,
    [datasetId, lastNames, ...geo.params]
  )
  return rows.map(rowToVoterRecord)
}

/**
 * Pass 1.5: Phonetic last name lookup via pre-computed metaphone codes.
 */
export async function queryVotersByMetaphone(
  datasetId: string,
  codes: string[],
  filters?: GeoFilters
): Promise<VoterRecord[]> {
  if (codes.length === 0) return []
  const pool = getPool()
  const geo = buildGeoWhere(filters, 3)
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1 AND last_name_metaphone = ANY($2) ${geo.clause}`,
    [datasetId, codes.filter(Boolean), ...geo.params]
  )
  return rows.map(rowToVoterRecord)
}

/**
 * Pass 2: Fuzzy trigram matching on last name + optional zip fallback.
 * Uses pg_trgm similarity operator (%).
 * Returns up to 5000 candidates for Fuse.js scoring.
 */
export async function queryVotersFuzzy(
  datasetId: string,
  lastName: string,
  zip?: string,
  filters?: GeoFilters
): Promise<VoterRecord[]> {
  const pool = getPool()
  const results = new Map<string, VoterRecord>()

  // Trigram similarity on last name
  const geo1 = buildGeoWhere(filters, 3)
  const { rows: trigramRows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1
       AND similarity(last_name_normalized, $2) > 0.3
       ${geo1.clause}
     ORDER BY similarity(last_name_normalized, $2) DESC
     LIMIT 3000`,
    [datasetId, lastName, ...geo1.params]
  )
  for (const row of trigramRows) {
    const vr = rowToVoterRecord(row)
    results.set(vr.voter_id, vr)
  }

  // Also add same-zip voters for coverage
  if (zip && results.size < 5000) {
    const cleanZip = zip.trim().slice(0, 5)
    const geo2 = buildGeoWhere(filters, 4)
    const { rows: zipRows } = await pool.query(
      `SELECT ${VOTER_SELECT} FROM voters
       WHERE dataset_id = $1 AND zip = $2
       ${geo2.clause}
       LIMIT $${geo2.nextIdx}`,
      [datasetId, cleanZip, ...geo2.params, 5000 - results.size]
    )
    for (const row of zipRows) {
      const vr = rowToVoterRecord(row)
      if (!results.has(vr.voter_id)) {
        results.set(vr.voter_id, vr)
      }
    }
  }

  return Array.from(results.values())
}

/**
 * Nearby: Get active voters in a specific zip code.
 */
export async function queryVotersByZip(
  datasetId: string,
  zip: string,
  activeOnly = true,
  filters?: GeoFilters
): Promise<VoterRecord[]> {
  const pool = getPool()
  const cleanZip = zip.trim().slice(0, 5)
  const statusFilter = activeOnly ? `AND voter_status = 'Active'` : ''
  const geo = buildGeoWhere(filters, 3)
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1 AND zip = $2 ${statusFilter} ${geo.clause}`,
    [datasetId, cleanZip, ...geo.params]
  )
  return rows.map(rowToVoterRecord)
}

/**
 * Nearby: Get active voters matching a zip prefix (neighboring zips),
 * excluding a specific zip.
 */
export async function queryVotersByZipPrefix(
  datasetId: string,
  zipPrefix: string,
  excludeZip: string,
  activeOnly = true,
  filters?: GeoFilters
): Promise<VoterRecord[]> {
  const pool = getPool()
  const statusFilter = activeOnly ? `AND voter_status = 'Active'` : ''
  const geo = buildGeoWhere(filters, 4)
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1
       AND zip LIKE $2
       AND zip != $3
       ${statusFilter}
       ${geo.clause}`,
    [datasetId, `${zipPrefix}%`, excludeZip, ...geo.params]
  )
  return rows.map(rowToVoterRecord)
}

/**
 * Dataset stats: record count + unique city list.
 */
export async function getDatasetStats(
  datasetId: string
): Promise<{ recordCount: number; cities: string[] }> {
  const pool = getPool()
  const [countResult, citiesResult] = await Promise.all([
    pool.query(`SELECT count(*)::int as cnt FROM voters WHERE dataset_id = $1`, [datasetId]),
    pool.query(`SELECT DISTINCT city FROM voters WHERE dataset_id = $1 AND city IS NOT NULL ORDER BY city`, [datasetId]),
  ])
  return {
    recordCount: countResult.rows[0]?.cnt ?? 0,
    cities: citiesResult.rows.map(r => r.city as string),
  }
}

/**
 * Get distinct values for geographic columns within a dataset.
 * Used by the admin UI to show available filter options.
 */
export async function getDatasetGeoOptions(datasetId: string): Promise<{
  congressionalDistricts: string[]
  stateSenateDistricts: string[]
  stateHouseDistricts: string[]
  cities: string[]
  zips: string[]
}> {
  const pool = getPool()
  const [cd, ss, sh, cities, zips] = await Promise.all([
    pool.query(`SELECT DISTINCT congressional_district FROM voters WHERE dataset_id = $1 AND congressional_district IS NOT NULL ORDER BY congressional_district`, [datasetId]),
    pool.query(`SELECT DISTINCT state_senate_district FROM voters WHERE dataset_id = $1 AND state_senate_district IS NOT NULL ORDER BY state_senate_district`, [datasetId]),
    pool.query(`SELECT DISTINCT state_house_district FROM voters WHERE dataset_id = $1 AND state_house_district IS NOT NULL ORDER BY state_house_district`, [datasetId]),
    pool.query(`SELECT DISTINCT city FROM voters WHERE dataset_id = $1 AND city IS NOT NULL ORDER BY city`, [datasetId]),
    pool.query(`SELECT DISTINCT zip FROM voters WHERE dataset_id = $1 AND zip IS NOT NULL ORDER BY zip`, [datasetId]),
  ])
  return {
    congressionalDistricts: cd.rows.map(r => r.congressional_district as string),
    stateSenateDistricts: ss.rows.map(r => r.state_senate_district as string),
    stateHouseDistricts: sh.rows.map(r => r.state_house_district as string),
    cities: cities.rows.map(r => r.city as string),
    zips: zips.rows.map(r => r.zip as string),
  }
}
