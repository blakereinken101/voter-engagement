import { NextResponse } from 'next/server'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { getCampaignConfig } from '@/lib/campaign-config.server'

export async function GET() {
  try {
    const ctx = await getRequestContext()
    const config = await getCampaignConfig(ctx.campaignId)
    return NextResponse.json(config)
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/config] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
