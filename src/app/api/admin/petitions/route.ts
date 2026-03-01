import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { computeSheetFingerprint, findOrCreatePetitioner } from '@/lib/petition-utils'

// GET: List all petition sheets for the campaign, or signatures for a specific sheet
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const { searchParams } = new URL(request.url)
    const sheetId = searchParams.get('sheetId')

    // If sheetId provided, return signatures for that sheet
    if (sheetId) {
      // Verify sheet belongs to campaign
      const { rows: sheetCheck } = await db.query(
        'SELECT id FROM petition_sheets WHERE id = $1 AND campaign_id = $2',
        [sheetId, ctx.campaignId],
      )
      if (sheetCheck.length === 0) {
        return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })
      }

      const { rows: signatures } = await db.query(
        `SELECT id, sheet_id, line_number, first_name, last_name, address, city, zip,
                date_signed, match_status, match_data, match_score, candidates_data,
                user_confirmed, confirmed_by, created_at
         FROM petition_signatures WHERE sheet_id = $1
         ORDER BY line_number ASC NULLS LAST, created_at ASC`,
        [sheetId],
      )
      return NextResponse.json({ signatures })
    }

    const { rows: sheets } = await db.query(`
      SELECT ps.*, u.name as scanned_by_name,
             pp.canonical_name as petitioner_canonical_name,
             (SELECT COUNT(*) FROM petition_signatures WHERE sheet_id = ps.id) as signature_count
      FROM petition_sheets ps
      JOIN users u ON u.id = ps.scanned_by
      LEFT JOIN petition_petitioners pp ON pp.id = ps.petitioner_id
      WHERE ps.campaign_id = $1
      ORDER BY ps.created_at DESC
    `, [ctx.campaignId])

    // Get overall stats (exclude duplicates)
    const { rows: statsRows } = await db.query(`
      SELECT
        COUNT(DISTINCT ps.id) as total_sheets,
        COALESCE(SUM(ps.total_signatures), 0) as total_signatures,
        COALESCE(SUM(ps.matched_count), 0) as total_matched,
        CASE WHEN SUM(ps.total_signatures) > 0
          THEN ROUND(SUM(ps.matched_count)::numeric / SUM(ps.total_signatures) * 100, 1)
          ELSE 0
        END as overall_validity_rate
      FROM petition_sheets ps
      WHERE ps.campaign_id = $1 AND ps.is_duplicate = false
    `, [ctx.campaignId])

    return NextResponse.json({
      sheets,
      stats: statsRows[0] || { total_sheets: 0, total_signatures: 0, total_matched: 0, overall_validity_rate: 0 },
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

interface PetitionSignatureInput {
  lineNumber?: number
  firstName: string
  lastName: string
  address?: string
  city?: string
  zip?: string
  dateSigned?: string
}

// POST: Create a petition sheet with signatures
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    let body: { petitionerName?: string; signatures: PetitionSignatureInput[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { petitionerName, signatures } = body

    if (!Array.isArray(signatures) || signatures.length === 0) {
      return NextResponse.json({ error: 'signatures array is required' }, { status: 400 })
    }
    if (signatures.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 signatures per sheet' }, { status: 400 })
    }

    const sanitize = (val: unknown, maxLen = 200): string | null =>
      typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen) : null

    // Compute fingerprint for duplicate detection
    const fingerprint = computeSheetFingerprint(signatures)

    // Check for existing sheet with same fingerprint
    const { rows: dupeCheck } = await db.query(
      'SELECT id FROM petition_sheets WHERE campaign_id = $1 AND fingerprint = $2',
      [ctx.campaignId, fingerprint],
    )
    const isDuplicate = dupeCheck.length > 0
    const duplicateOf = isDuplicate ? dupeCheck[0].id : null

    // Find or create petitioner
    let petitionerId: string | null = null
    if (petitionerName?.trim()) {
      petitionerId = await findOrCreatePetitioner(db, ctx.campaignId, petitionerName.trim())
    }

    const sheetId = crypto.randomUUID()
    const client = await db.connect()

    try {
      await client.query('BEGIN')

      // Create the petition sheet
      await client.query(`
        INSERT INTO petition_sheets (id, campaign_id, petitioner_name, scanned_by, total_signatures, status, fingerprint, is_duplicate, duplicate_of, petitioner_id)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)
      `, [sheetId, ctx.campaignId, sanitize(petitionerName, 100), ctx.userId, signatures.length, fingerprint, isDuplicate, duplicateOf, petitionerId])

      // Insert signatures
      for (const sig of signatures) {
        if (!sig.firstName || !sig.lastName) continue

        const zipVal = typeof sig.zip === 'string' ? sig.zip.replace(/[^0-9]/g, '').slice(0, 5) || null : null

        await client.query(`
          INSERT INTO petition_signatures (id, sheet_id, line_number, first_name, last_name, address, city, zip, date_signed)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          crypto.randomUUID(), sheetId,
          typeof sig.lineNumber === 'number' ? sig.lineNumber : null,
          sanitize(sig.firstName, 50), sanitize(sig.lastName, 50),
          sanitize(sig.address, 200), sanitize(sig.city, 50),
          zipVal, sanitize(sig.dateSigned, 20),
        ])
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await logActivity(ctx.userId, 'petition_sheet_scanned', {
      sheetId,
      petitionerName: petitionerName || null,
      signatureCount: signatures.length,
      isDuplicate,
    }, ctx.campaignId)

    return NextResponse.json({
      success: true,
      sheetId,
      signatureCount: signatures.length,
      isDuplicate,
      duplicateOf,
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
