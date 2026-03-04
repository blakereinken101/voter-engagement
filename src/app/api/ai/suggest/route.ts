import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSessionFromRequest } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAIEnabled, isAnthropicEnabled } from '@/lib/ai-chat'
import { getAISettings } from '@/lib/ai-settings'
import { geminiComplete, isGeminiEnabled } from '@/lib/gemini-provider'
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

    const userMessage = parts.join('\n')

    if (aiSettings.provider === 'gemini') {
      try {
        suggestion = (await geminiComplete({
          model: aiSettings.suggestModel,
          systemPrompt,
          userMessage,
          maxTokens,
        })).trim()
      } catch (geminiErr) {
        const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr)
        const isTransient = /503|unavailable|high demand|overloaded|429|quota|resource_exhausted/i.test(msg)
        if (isTransient && isAnthropicEnabled()) {
          console.warn(`[ai/suggest] Gemini unavailable, falling back to Anthropic`)
          // fall through to Anthropic below
        } else {
          throw geminiErr
        }
      }
    }

    if (!suggestion && (aiSettings.provider === 'anthropic' || aiSettings.provider === 'gemini')) {
      try {
        const client = new Anthropic()
        const fallbackModel = aiSettings.provider === 'anthropic'
          ? aiSettings.suggestModel
          : (process.env.ANTHROPIC_SUGGEST_MODEL || 'claude-haiku-4-5-20251001')
        const response = await client.messages.create({
          model: fallbackModel,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })
        const textBlock = response.content.find(b => b.type === 'text')
        suggestion = textBlock?.text?.trim() || ''
      } catch (anthropicErr) {
        const status = anthropicErr instanceof Anthropic.APIError ? anthropicErr.status : 0
        const isTransient = status === 529 || status === 503
        if (isTransient && aiSettings.provider === 'anthropic' && isGeminiEnabled()) {
          console.warn(`[ai/suggest] Anthropic unavailable, falling back to Gemini`)
          suggestion = (await geminiComplete({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            systemPrompt,
            userMessage,
            maxTokens,
          })).trim()
        } else {
          throw anthropicErr
        }
      }
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
