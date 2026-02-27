import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSessionFromRequest } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAIEnabled } from '@/lib/ai-chat'
import { getAISettings } from '@/lib/ai-settings'
import { geminiComplete } from '@/lib/gemini-provider'
import { getPromptSection } from '@/lib/ai-prompts'
import { EVENT_TYPE_CONFIG } from '@/types/events'
import type { EventType } from '@/types/events'

export const runtime = 'nodejs'
export const maxDuration = 15

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

    const aiSettings = await getAISettings()

    const rateCheck = checkRateLimit(`ai-suggest:${session.userId}`, {
      maxAttempts: aiSettings.suggestRateLimit,
      windowMs: aiSettings.rateLimitWindowMinutes * 60 * 1000,
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

    const maxTokens = field === 'title' ? 100 : 300
    let suggestion = ''

    // Load DB-backed event suggest prompt (falls back to hardcoded default)
    const suggestPromptSection = await getPromptSection('event_suggest')
    const systemPrompt = suggestPromptSection.content

    if (aiSettings.provider === 'gemini') {
      suggestion = (await geminiComplete({
        model: aiSettings.suggestModel,
        systemPrompt,
        userMessage: parts.join('\n'),
        maxTokens,
      })).trim()
    } else {
      const client = new Anthropic()
      const response = await client.messages.create({
        model: aiSettings.suggestModel,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: parts.join('\n') }],
      })
      const textBlock = response.content.find(b => b.type === 'text')
      suggestion = textBlock?.text?.trim() || ''
    }

    if (!suggestion) {
      return NextResponse.json({ error: 'No suggestion generated' }, { status: 500 })
    }

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error('[ai/suggest] Error:', error)
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 })
  }
}
