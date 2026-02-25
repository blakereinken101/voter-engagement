import { NextRequest, NextResponse } from 'next/server'
import { getVoterFile } from '@/lib/mock-data'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { getCampaignConfig } from '@/lib/campaign-config.server'
import { getDatasetForCampaign, getDatasetStats } from '@/lib/voter-db'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getRequestContext()

    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state')

    if (!state || state.length !== 2) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
    }

    // Try DB-backed dataset first
    const datasetId = await getDatasetForCampaign(ctx.campaignId)
    if (datasetId) {
      const stats = await getDatasetStats(datasetId)
      return NextResponse.json({
        state: state.toUpperCase(),
        recordCount: stats.recordCount,
        cities: stats.cities,
      })
    }

    // Fall back to file-based
    const campaignConfig = await getCampaignConfig(ctx.campaignId)
    const voterFile = await getVoterFile(state.toUpperCase(), campaignConfig.voterFile)

    return NextResponse.json({
      state: state.toUpperCase(),
      recordCount: voterFile.length,
      cities: [...new Set(voterFile.map(r => r.city))].sort(),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[voter-data] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
