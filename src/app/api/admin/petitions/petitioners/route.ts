import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'

/**
 * GET: List all petitioners for the campaign with their aggregate stats.
 */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { rows: petitioners } = await db.query(`
      SELECT
        pp.*,
        (SELECT COUNT(*) FROM petition_sheets ps WHERE ps.petitioner_id = pp.id AND ps.is_duplicate = false) as sheets_count,
        (SELECT COALESCE(SUM(ps.total_signatures), 0) FROM petition_sheets ps WHERE ps.petitioner_id = pp.id AND ps.is_duplicate = false) as total_sigs,
        (SELECT COALESCE(SUM(ps.matched_count), 0) FROM petition_sheets ps WHERE ps.petitioner_id = pp.id AND ps.is_duplicate = false) as total_matched
      FROM petition_petitioners pp
      WHERE pp.campaign_id = $1
      ORDER BY pp.total_signatures DESC, pp.canonical_name ASC
    `, [ctx.campaignId])

    // Also get sheets per petitioner for drill-down
    const { rows: sheets } = await db.query(`
      SELECT ps.id, ps.petitioner_id, ps.petitioner_name, ps.total_signatures,
             ps.matched_count, ps.validity_rate, ps.status, ps.is_duplicate,
             ps.created_at, u.name as scanned_by_name
      FROM petition_sheets ps
      JOIN users u ON u.id = ps.scanned_by
      WHERE ps.campaign_id = $1 AND ps.petitioner_id IS NOT NULL
      ORDER BY ps.created_at DESC
    `, [ctx.campaignId])

    // Group sheets by petitioner
    const sheetsByPetitioner: Record<string, typeof sheets> = {}
    for (const sheet of sheets) {
      if (!sheetsByPetitioner[sheet.petitioner_id]) {
        sheetsByPetitioner[sheet.petitioner_id] = []
      }
      sheetsByPetitioner[sheet.petitioner_id].push(sheet)
    }

    return NextResponse.json({
      petitioners: petitioners.map(p => ({
        ...p,
        sheets: sheetsByPetitioner[p.id] || [],
      })),
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
