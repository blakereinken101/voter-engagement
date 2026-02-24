import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSessionFromRequest } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAIEnabled } from '@/lib/ai-chat'
import { EVENT_TYPE_CONFIG } from '@/types/events'
import type { EventType } from '@/types/events'

export const runtime = 'nodejs'
export const maxDuration = 15

const MODEL = process.env.ANTHROPIC_SUGGEST_MODEL || 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You are a writing assistant for political event organizers. You help write compelling, concise event titles and descriptions.

Rules for TITLES:
- Keep it under 60 characters
- Be specific and action-oriented
- Include the neighborhood or area when location info is available
- Match the energy of the event type
- Do NOT use generic filler like "Join us for..." — lead with the action or purpose

Rules for DESCRIPTIONS:
- 2-4 sentences maximum
- NEVER repeat the event title
- NEVER mention date, time, or location — those are displayed separately in the UI
- Focus on: what attendees will DO, why it MATTERS, what to BRING or expect
- Match the tone to the event type:
  - canvassing: practical, energizing — "here's what we'll accomplish together"
  - phone_bank: practical, clear — what the calls are about, who they're reaching
  - rally/protest: urgent, inspiring, movement-building language
  - town_hall/debate_watch: informative, civic-minded, what they'll learn
  - happy_hour/meetup: casual, welcoming, community-building
  - fundraiser: compelling case for support, mention the impact of donations
  - volunteer_training: practical, what skills they'll gain, who it's for
  - community/voter_registration: inclusive, empowering, grassroots energy
  - ballot_party: fun, informative, help people feel prepared

Always respond with ONLY the requested text. No quotes, no preamble, no explanation.`

export async function POST(request: NextRequest) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured.' },
        { status: 503 },
      )
    }

    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rateCheck = checkRateLimit(`ai-suggest:${session.userId}`, {
      maxAttempts: 30,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    })
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait.', retryAfter: rateCheck.retryAfterSeconds },
        { status: 429 },
      )
    }

    let body: {
      field: string
      eventType: string
      title?: string
      description?: string
      locationName?: string
      locationCity?: string
      isVirtual?: boolean
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { field, eventType, title, description, locationName, locationCity, isVirtual } = body

    if (!field || !['title', 'description'].includes(field)) {
      return NextResponse.json({ error: 'field must be "title" or "description"' }, { status: 400 })
    }

    if (!eventType || !(eventType in EVENT_TYPE_CONFIG)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }

    const eventLabel = EVENT_TYPE_CONFIG[eventType as EventType].label

    // Build the user message with available context
    const parts: string[] = []

    if (field === 'title') {
      parts.push(`Generate a compelling event title for a "${eventLabel}" event.`)
      if (title?.trim()) {
        parts.push(`The current draft title is: "${title.trim()}" — improve or complete it.`)
      }
    } else {
      parts.push(`Write a short event description for a "${eventLabel}" event.`)
      if (title?.trim()) {
        parts.push(`The event title is: "${title.trim()}"`)
      }
      if (description?.trim()) {
        parts.push(`The current draft description is: "${description.trim()}" — improve and refine it.`)
      }
    }

    if (locationName?.trim()) parts.push(`Venue: ${locationName.trim()}`)
    if (locationCity?.trim()) parts.push(`City: ${locationCity.trim()}`)
    if (isVirtual) parts.push('This is a virtual/online event.')

    parts.push(`Respond with ONLY the ${field} text.`)

    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: field === 'title' ? 100 : 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: parts.join('\n') }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    const suggestion = textBlock?.text?.trim() || ''

    if (!suggestion) {
      return NextResponse.json({ error: 'No suggestion generated' }, { status: 500 })
    }

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error('[ai/suggest] Error:', error)
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 })
  }
}
