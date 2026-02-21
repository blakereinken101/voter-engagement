import { NextRequest, NextResponse } from 'next/server'
import { getVoterFile } from '@/lib/mock-data'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const state = searchParams.get('state')

  if (!state || state.length !== 2) {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
  }

  const voterFile = getVoterFile(state.toUpperCase())

  return NextResponse.json({
    state: state.toUpperCase(),
    recordCount: voterFile.length,
    cities: [...new Set(voterFile.map(r => r.city))].sort(),
  })
}
