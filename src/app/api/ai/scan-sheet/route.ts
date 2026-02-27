import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAIEnabled } from '@/lib/ai-chat'
import { getAISettings } from '@/lib/ai-settings'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMAGE_SIZE = 4 * 1024 * 1024 // 4MB base64

const EXTRACTION_PROMPT = `You are a data extraction assistant. Analyze this image of a handwritten contact sheet and extract all contact information you can read.

Return a JSON array of objects. Each object represents one person and may have these fields:
- firstName (string, required)
- lastName (string, required)
- phone (string, optional)
- city (string, optional)
- address (string, optional)
- notes (string, optional — any other info like relationship, age, etc.)

Rules:
- If a field is illegible or missing, omit it from that object
- If you can read a full name but can't tell first from last, put the first word as firstName and the rest as lastName
- Phone numbers should include area codes if visible
- Return ONLY valid JSON — no markdown, no explanation, just the array
- If you cannot read any contacts, return an empty array []

Example output:
[{"firstName":"John","lastName":"Smith","phone":"919-555-1234","city":"Raleigh"},{"firstName":"Mary","lastName":"Jones","notes":"neighbor"}]`

interface ExtractedContact {
  firstName: string
  lastName: string
  phone?: string
  city?: string
  address?: string
  notes?: string
}

async function extractWithAnthropic(
  base64: string,
  mimeType: string,
  model: string,
): Promise<ExtractedContact[]> {
  const client = new Anthropic()

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from AI')
  }

  return parseContacts(textBlock.text)
}

async function extractWithGemini(
  base64: string,
  mimeType: string,
  model: string,
): Promise<ExtractedContact[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const client = new GoogleGenAI({ apiKey })

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
    config: {
      maxOutputTokens: 2048,
    },
  })

  const text = response.text
  if (!text) throw new Error('No text response from Gemini')

  return parseContacts(text)
}

function parseContacts(rawText: string): ExtractedContact[] {
  // Strip markdown code fences if present
  let text = rawText.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array')
  }

  // Validate and clean each contact
  return parsed
    .filter(
      (c: Record<string, unknown>) =>
        typeof c.firstName === 'string' &&
        typeof c.lastName === 'string' &&
        c.firstName.trim().length > 0 &&
        c.lastName.trim().length > 0,
    )
    .map((c: Record<string, unknown>) => {
      const contact: ExtractedContact = {
        firstName: String(c.firstName).trim().slice(0, 50),
        lastName: String(c.lastName).trim().slice(0, 50),
      }
      if (typeof c.phone === 'string' && c.phone.trim()) {
        contact.phone = c.phone.trim().slice(0, 20)
      }
      if (typeof c.city === 'string' && c.city.trim()) {
        contact.city = c.city.trim().slice(0, 50)
      }
      if (typeof c.address === 'string' && c.address.trim()) {
        contact.address = c.address.trim().slice(0, 200)
      }
      if (typeof c.notes === 'string' && c.notes.trim()) {
        contact.notes = c.notes.trim().slice(0, 200)
      }
      return contact
    })
}

export async function POST(request: NextRequest) {
  try {
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured.' },
        { status: 503 },
      )
    }

    const ctx = await getRequestContext()

    // Rate limit: 10 scans per 15 minutes
    const rateCheck = checkRateLimit(`scan-sheet:${ctx.userId}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    })
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many scan requests. Please wait a moment.', retryAfter: rateCheck.retryAfterSeconds },
        { status: 429 },
      )
    }

    let body: { image: string; mimeType: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { image, mimeType } = body

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 })
    }

    if (image.length > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Image is too large (max 4MB)' }, { status: 400 })
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validMimeTypes.includes(mimeType)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
    }

    const aiSettings = await getAISettings()

    let contacts: ExtractedContact[]

    try {
      if (aiSettings.provider === 'gemini') {
        contacts = await extractWithGemini(image, mimeType, aiSettings.chatModel)
      } else {
        contacts = await extractWithAnthropic(image, mimeType, aiSettings.chatModel)
      }
    } catch (err) {
      console.error('[scan-sheet] AI extraction error:', err)
      const message = err instanceof Error ? err.message : 'Unknown error'

      if (message.includes('Could not process image') || message.includes('invalid_image')) {
        return NextResponse.json(
          { error: 'Could not read the image. Please try a clearer photo.' },
          { status: 422 },
        )
      }

      return NextResponse.json(
        { error: 'Failed to extract contacts from image. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ contacts })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[scan-sheet] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
