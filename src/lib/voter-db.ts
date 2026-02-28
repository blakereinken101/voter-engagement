import { getPool } from './db'
import type { VoterRecord, VoteValue } from '@/types'

// =============================================
// DB-backed voter data access layer
// Replaces in-memory getVoterFile() for campaigns
// that have a voter dataset assigned.
// =============================================

/**
 * Get the dataset_id linked to a campaign (if any).
 * Returns the first assigned dataset or null.
 */
export async function getDatasetForCampaign(campaignId: string): Promise<string | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT cvd.dataset_id FROM campaign_voter_datasets cvd
     JOIN voter_datasets vd ON vd.id = cvd.dataset_id
     WHERE cvd.campaign_id = $1 AND vd.status = 'ready'
     LIMIT 1`,
    [campaignId]
  )
  return rows[0]?.dataset_id ?? null
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
  lastNames: string[]
): Promise<VoterRecord[]> {
  if (lastNames.length === 0) return []
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1 AND last_name_normalized = ANY($2)`,
    [datasetId, lastNames]
  )
  return rows.map(rowToVoterRecord)
}

/**
 * Pass 1.5: Phonetic last name lookup via pre-computed metaphone codes.
 */
export async function queryVotersByMetaphone(
  datasetId: string,
  codes: string[]
): Promise<VoterRecord[]> {
  if (codes.length === 0) return []
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1 AND last_name_metaphone = ANY($2)`,
    [datasetId, codes.filter(Boolean)]
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
  zip?: string
): Promise<VoterRecord[]> {
  const pool = getPool()
  const results = new Map<string, VoterRecord>()

  // Trigram similarity on last name
  const { rows: trigramRows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1
       AND similarity(last_name_normalized, $2) > 0.3
     ORDER BY similarity(last_name_normalized, $2) DESC
     LIMIT 3000`,
    [datasetId, lastName]
  )
  for (const row of trigramRows) {
    const vr = rowToVoterRecord(row)
    results.set(vr.voter_id, vr)
  }

  // Also add same-zip voters for coverage
  if (zip && results.size < 5000) {
    const cleanZip = zip.trim().slice(0, 5)
    const { rows: zipRows } = await pool.query(
      `SELECT ${VOTER_SELECT} FROM voters
       WHERE dataset_id = $1 AND zip = $2
       LIMIT $3`,
      [datasetId, cleanZip, 5000 - results.size]
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
  activeOnly = true
): Promise<VoterRecord[]> {
  const pool = getPool()
  const cleanZip = zip.trim().slice(0, 5)
  const statusFilter = activeOnly ? `AND voter_status = 'Active'` : ''
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1 AND zip = $2 ${statusFilter}`,
    [datasetId, cleanZip]
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
  activeOnly = true
): Promise<VoterRecord[]> {
  const pool = getPool()
  const statusFilter = activeOnly ? `AND voter_status = 'Active'` : ''
  const { rows } = await pool.query(
    `SELECT ${VOTER_SELECT} FROM voters
     WHERE dataset_id = $1
       AND zip LIKE $2
       AND zip != $3
       ${statusFilter}`,
    [datasetId, `${zipPrefix}%`, excludeZip]
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
