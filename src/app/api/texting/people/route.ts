import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, mapMemberRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'

/** List all texting team members across campaigns for this org. */
export async function GET() {
  try {
    const ctx = await getTextingContext()
    const pool = getPool()

    const { rows } = await pool.query(`
      SELECT DISTINCT ON (tcm.user_id) tcm.*, u.name, u.email
      FROM text_campaign_members tcm
      JOIN text_campaigns tc ON tc.id = tcm.text_campaign_id
      JOIN users u ON u.id = tcm.user_id
      WHERE tc.organization_id = $1 AND tcm.is_active = true
      ORDER BY tcm.user_id, tcm.joined_at DESC
    `, [ctx.organizationId])

    return NextResponse.json({ members: rows.map(mapMemberRow) })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
