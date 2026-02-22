import { NextRequest, NextResponse } from 'next/server'
import { getVoterFile } from '@/lib/mock-data'
import { matchPeopleToVoterFile } from '@/lib/matching'
import { MatchRequestBody, PersonEntry } from '@/types'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { getCampaignConfig } from '@/lib/campaign-config.server'

// Sanitize string inputs — strip HTML tags and control characters
function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<[^>]*>/g, '')           // Strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip control chars
    .trim()
    .slice(0, 200) // Max length
}

// Validate and sanitize a single person entry
function sanitizePerson(p: Record<string, unknown>): PersonEntry | null {
  const firstName = sanitizeString(p.firstName)
  const lastName = sanitizeString(p.lastName)
  if (!firstName || !lastName) return null

  return {
    id: typeof p.id === 'string' ? sanitizeString(p.id) : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    firstName,
    lastName,
    address: p.address ? sanitizeString(p.address) : undefined,
    city: p.city ? sanitizeString(p.city) : undefined,
    zip: p.zip ? sanitizeString(p.zip).replace(/[^0-9]/g, '').slice(0, 5) : undefined,
    age: typeof p.age === 'number' && p.age >= 18 && p.age <= 120 ? Math.floor(p.age) : undefined,
    ageRange: typeof p.ageRange === 'string' ? sanitizeString(p.ageRange) as PersonEntry['ageRange'] : undefined,
    gender: (p.gender === 'M' || p.gender === 'F' || p.gender === '') ? p.gender : undefined,
    category: typeof p.category === 'string' ? sanitizeString(p.category) as PersonEntry['category'] : 'who-did-we-miss',
  }
}

export async function POST(request: NextRequest) {
  try {
  const ctx = await getRequestContext()

  let body: MatchRequestBody
  try {
    // Limit request body size (100KB max)
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 100_000) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { people, state } = body

  // Validate state — must be exactly 2 uppercase letters
  if (!state || typeof state !== 'string' || !/^[A-Za-z]{2}$/.test(state)) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  if (!Array.isArray(people) || people.length === 0) {
    return NextResponse.json({ error: 'No people provided' }, { status: 400 })
  }

  if (people.length > 100) {
    return NextResponse.json({ error: 'Too many people (max 100)' }, { status: 400 })
  }

  // Sanitize all person entries
  const sanitizedPeople = people
    .map(p => sanitizePerson(p as unknown as Record<string, unknown>))
    .filter((p): p is PersonEntry => p !== null)

  if (sanitizedPeople.length === 0) {
    return NextResponse.json({ error: 'No valid people after sanitization' }, { status: 400 })
  }

  const start = Date.now()
  const campaignConfig = await getCampaignConfig(ctx.campaignId)
  const voterFile = getVoterFile(state.toUpperCase(), campaignConfig.voterFile)
  const results = await matchPeopleToVoterFile(sanitizedPeople, voterFile)
  const processingTimeMs = Date.now() - start

  return NextResponse.json({ results, processingTimeMs })

  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[match] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
