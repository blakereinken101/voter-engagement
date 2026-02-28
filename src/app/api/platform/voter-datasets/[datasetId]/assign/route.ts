import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'
import { AuthError } from '@/lib/auth'
import { getPool } from '@/lib/db'

/**
 * POST /api/platform/voter-datasets/[datasetId]/assign
 * Assign a voter dataset to a campaign, optionally with geographic filters.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { datasetId } = await params
    const pool = getPool()

    let body: {
      campaignId: string
      filterCongressional?: string
      filterStateSenate?: string
      filterStateHouse?: string
      filterCity?: string
      filterZip?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    // Verify dataset exists
    const { rows: dsRows } = await pool.query(
      `SELECT id FROM voter_datasets WHERE id = $1`,
      [datasetId]
    )
    if (dsRows.length === 0) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    // Verify campaign exists
    const { rows: campRows } = await pool.query(
      `SELECT id FROM campaigns WHERE id = $1`,
      [body.campaignId]
    )
    if (campRows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    await pool.query(
      `INSERT INTO campaign_voter_datasets (campaign_id, dataset_id, filter_congressional, filter_state_senate, filter_state_house, filter_city, filter_zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (campaign_id, dataset_id) DO UPDATE SET
         filter_congressional = EXCLUDED.filter_congressional,
         filter_state_senate = EXCLUDED.filter_state_senate,
         filter_state_house = EXCLUDED.filter_state_house,
         filter_city = EXCLUDED.filter_city,
         filter_zip = EXCLUDED.filter_zip`,
      [
        body.campaignId,
        datasetId,
        body.filterCongressional?.trim() || null,
        body.filterStateSenate?.trim() || null,
        body.filterStateHouse?.trim() || null,
        body.filterCity?.trim() || null,
        body.filterZip?.trim() || null,
      ]
    )

    return NextResponse.json({ assigned: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[voter-datasets/assign] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/platform/voter-datasets/[datasetId]/assign
 * Unassign a voter dataset from a campaign.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { datasetId } = await params
    const pool = getPool()

    let body: { campaignId: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    await pool.query(
      `DELETE FROM campaign_voter_datasets WHERE campaign_id = $1 AND dataset_id = $2`,
      [body.campaignId, datasetId]
    )

    return NextResponse.json({ unassigned: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[voter-datasets/assign] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
