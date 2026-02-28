import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'
import { AuthError } from '@/lib/auth'
import { getPool } from '@/lib/db'

/**
 * GET /api/platform/campaigns/[campaignId]
 * Campaign detail: info, members, assigned voter datasets, available datasets.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { campaignId } = await params
    const pool = getPool()

    const { rows: campRows } = await pool.query(
      `SELECT c.*, o.name as org_name
       FROM campaigns c
       JOIN organizations o ON o.id = c.org_id
       WHERE c.id = $1`,
      [campaignId]
    )

    if (campRows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = campRows[0]

    const [membersResult, datasetsResult, availableResult] = await Promise.all([
      pool.query(
        `SELECT m.id, m.user_id, u.name as user_name, u.email as user_email,
                m.role, m.is_active, m.joined_at
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.campaign_id = $1
         ORDER BY m.joined_at`,
        [campaignId]
      ),
      pool.query(
        `SELECT cvd.dataset_id, vd.name as dataset_name, vd.state as dataset_state,
                vd.record_count, vd.status,
                cvd.filter_congressional, cvd.filter_state_senate,
                cvd.filter_state_house, cvd.filter_city, cvd.filter_zip
         FROM campaign_voter_datasets cvd
         JOIN voter_datasets vd ON vd.id = cvd.dataset_id
         WHERE cvd.campaign_id = $1
         ORDER BY vd.name`,
        [campaignId]
      ),
      pool.query(
        `SELECT vd.id, vd.name, vd.state, vd.record_count
         FROM voter_datasets vd
         WHERE vd.status = 'ready'
           AND vd.id NOT IN (
             SELECT dataset_id FROM campaign_voter_datasets WHERE campaign_id = $1
           )
         ORDER BY vd.name`,
        [campaignId]
      ),
    ])

    return NextResponse.json({
      campaign,
      members: membersResult.rows,
      voterDatasets: datasetsResult.rows,
      availableDatasets: availableResult.rows,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[platform/campaigns/[id]] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
