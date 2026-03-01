import { createHash } from 'crypto'
import type { Pool } from 'pg'

// =============================================
// SHEET FINGERPRINTING (duplicate detection)
// =============================================

/**
 * Compute a SHA-256 fingerprint from normalized signature data.
 * Used to detect when the same petition sheet is scanned twice.
 * Normalizes names and addresses, sorts tuples, then hashes.
 */
export function computeSheetFingerprint(
  signatures: { firstName: string; lastName: string; address?: string }[],
): string {
  const normalized = signatures
    .map(s => {
      const first = normalizePetitionStr(s.firstName)
      const last = normalizePetitionStr(s.lastName)
      const addr = normalizePetitionStr(s.address || '')
      return `${last}|${first}|${addr}`
    })
    .sort()
    .join('\n')

  return createHash('sha256').update(normalized).digest('hex')
}

function normalizePetitionStr(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
}

// =============================================
// PETITIONER NAME NORMALIZATION
// =============================================

const TITLE_PREFIXES = /^(mr\.?|mrs\.?|ms\.?|dr\.?|miss|rev\.?)\s+/i

/**
 * Normalize a petitioner name for matching.
 * Removes titles (Mr/Mrs/Ms/Dr), lowercases, trims, collapses whitespace.
 */
export function normalizePetitionerName(name: string): string {
  return name
    .trim()
    .replace(TITLE_PREFIXES, '')
    .toLowerCase()
    .replace(/[^a-z\s\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// =============================================
// PETITIONER RECOGNITION
// =============================================

/**
 * Find an existing petitioner by name similarity, or create a new one.
 * Uses exact normalized match first, then Jaro-Winkler fuzzy matching.
 * Returns the petitioner ID.
 */
export async function findOrCreatePetitioner(
  db: Pool,
  campaignId: string,
  petitionerName: string,
): Promise<string> {
  const normalized = normalizePetitionerName(petitionerName)
  if (!normalized) {
    // Empty name — create anonymous petitioner
    const id = crypto.randomUUID()
    await db.query(
      `INSERT INTO petition_petitioners (id, campaign_id, canonical_name, name_variants)
       VALUES ($1, $2, $3, $4)`,
      [id, campaignId, petitionerName.trim(), JSON.stringify([petitionerName.trim()])],
    )
    return id
  }

  // Look for existing petitioners in this campaign
  const { rows: existing } = await db.query(
    'SELECT id, canonical_name, name_variants FROM petition_petitioners WHERE campaign_id = $1',
    [campaignId],
  )

  // Pass 1: Exact normalized match on canonical_name
  for (const p of existing) {
    if (normalizePetitionerName(p.canonical_name) === normalized) {
      // Add name variant if it's new
      await addNameVariant(db, p.id, petitionerName.trim(), p.name_variants)
      return p.id
    }
  }

  // Pass 2: Check name variants for exact match
  for (const p of existing) {
    const variants: string[] = safeParseJson(p.name_variants, [])
    for (const v of variants) {
      if (normalizePetitionerName(v) === normalized) {
        return p.id
      }
    }
  }

  // Pass 3: Jaro-Winkler fuzzy match (> 0.85 threshold)
  try {
    const natural = await import('natural')
    const jw = natural.JaroWinklerDistance

    for (const p of existing) {
      const canonicalNorm = normalizePetitionerName(p.canonical_name)
      if (canonicalNorm && jw(normalized, canonicalNorm) > 0.85) {
        await addNameVariant(db, p.id, petitionerName.trim(), p.name_variants)
        return p.id
      }

      // Also check variants
      const variants: string[] = safeParseJson(p.name_variants, [])
      for (const v of variants) {
        const variantNorm = normalizePetitionerName(v)
        if (variantNorm && jw(normalized, variantNorm) > 0.85) {
          return p.id
        }
      }
    }
  } catch {
    // If natural module not available, skip fuzzy matching
  }

  // No match found — create new petitioner
  const id = crypto.randomUUID()
  await db.query(
    `INSERT INTO petition_petitioners (id, campaign_id, canonical_name, name_variants)
     VALUES ($1, $2, $3, $4)`,
    [id, campaignId, petitionerName.trim(), JSON.stringify([petitionerName.trim()])],
  )
  return id
}

async function addNameVariant(
  db: Pool,
  petitionerId: string,
  newVariant: string,
  existingVariantsJson: string,
): Promise<void> {
  const variants: string[] = safeParseJson(existingVariantsJson, [])
  if (!variants.includes(newVariant)) {
    variants.push(newVariant)
    await db.query(
      'UPDATE petition_petitioners SET name_variants = $1 WHERE id = $2',
      [JSON.stringify(variants), petitionerId],
    )
  }
}

// =============================================
// PETITIONER STATS RECALCULATION
// =============================================

/**
 * Recalculate aggregate stats for a petitioner from their linked sheets.
 */
export async function recalcPetitionerStats(
  db: Pool,
  petitionerId: string,
): Promise<void> {
  await db.query(`
    UPDATE petition_petitioners SET
      total_sheets = sub.sheet_count,
      total_signatures = sub.sig_count,
      matched_count = sub.match_count,
      validity_rate = CASE WHEN sub.sig_count > 0
        THEN ROUND(sub.match_count::numeric / sub.sig_count * 100, 1)
        ELSE 0
      END
    FROM (
      SELECT
        COUNT(DISTINCT ps.id) as sheet_count,
        COALESCE(SUM(ps.total_signatures), 0) as sig_count,
        COALESCE(SUM(ps.matched_count), 0) as match_count
      FROM petition_sheets ps
      WHERE ps.petitioner_id = $1
        AND ps.is_duplicate = false
    ) sub
    WHERE petition_petitioners.id = $1
  `, [petitionerId])
}

// =============================================
// UTILITIES
// =============================================

function safeParseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}
