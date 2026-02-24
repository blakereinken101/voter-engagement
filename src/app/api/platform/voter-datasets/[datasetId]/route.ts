import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'
import { AuthError } from '@/lib/auth'
import { getPool } from '@/lib/db'

/**
 * GET /api/platform/voter-datasets/[datasetId]
 * Dataset details with record count, city list, and assigned campaigns.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { datasetId } = await params
    const pool = getPool()

    const { rows: dsRows } = await pool.query(
      `SELECT * FROM voter_datasets WHERE id = $1`,
      [datasetId]
    )

    if (dsRows.length === 0) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    // Get city list and record count
    const [citiesResult, campaignsResult] = await Promise.all([
      pool.query(
        `SELECT DISTINCT city FROM voters WHERE dataset_id = $1 AND city IS NOT NULL ORDER BY city`,
        [datasetId]
      ),
      pool.query(
        `SELECT c.id, c.name, c.slug, o.name as org_name
         FROM campaign_voter_datasets cvd
         JOIN campaigns c ON c.id = cvd.campaign_id
         JOIN organizations o ON o.id = c.org_id
         WHERE cvd.dataset_id = $1
         ORDER BY c.name`,
        [datasetId]
      ),
    ])

    return NextResponse.json({
      dataset: dsRows[0],
      cities: citiesResult.rows.map(r => r.city),
      assignedCampaigns: campaignsResult.rows,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[platform/voter-datasets/[id]] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/platform/voter-datasets/[datasetId]
 * Delete a dataset and all its voter records (CASCADE).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { datasetId } = await params
    const pool = getPool()

    const { rowCount } = await pool.query(
      `DELETE FROM voter_datasets WHERE id = $1`,
      [datasetId]
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[platform/voter-datasets/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
