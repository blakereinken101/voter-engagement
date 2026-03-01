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

const EXTRACTION_PROMPT = `You are a data extraction assistant. Analyze this image of a handwritten contact sheet, sign-up sheet, or petition and extract all contact information you can read. The sheet may be a simple list of names, a petition with columns (name, address, signature, etc.), a sign-in sheet, or any format with people's information on it. Focus on extracting names and any associated contact details regardless of the sheet layout.

Return a JSON object with these top-level fields:
- volunteerName (string, optional) — the name of the VOLUNTEER or CANVASSER who filled out this sheet. Look for this at the VERY TOP of the page. It is often:
  - Written in ALL CAPS
  - Labeled with "Volunteer:", "Name:", "Canvasser:", "Vol:", "Organizer:", or similar
  - The first name on the page, set apart from the contact list (bigger, underlined, or in a header area)
  - Do NOT confuse this with the first contact in the list. The volunteer name is separate from the contacts.
  - If you cannot clearly identify a volunteer name, omit this field.
- contacts (array of objects, required) — each object represents one person on the list:
  - firstName (string, required)
  - lastName (string, required)
  - phone (string, optional)
  - city (string, optional)
  - address (string, optional)
  - category (string, optional — relationship type. Must be one of: household, close-family, extended-family, best-friends, close-friends, neighbors, coworkers, faith-community, school-pta, sports-recreation, hobby-groups, community-regulars, recent-meals. Infer from clues like "neighbor", "coworker", "wife", "church friend", etc.)
  - supportStatus (string, optional — only if notes suggest a conversation occurred. Must be one of: supporter, undecided, opposed, left-message, no-answer. Look for clues like "supports", "on the fence", "not interested", "left VM", etc.)
  - volunteerInterest (string, optional — only if mentioned. Must be one of: yes, no, maybe. Look for clues like "wants to volunteer", "might help", "will canvass", etc.)
  - notes (string, optional — any other info like age, context, etc. that doesn't fit the above fields)

Rules:
- If a field is illegible or missing, omit it from that object
- If you can read a full name but can't tell first from last, put the first word as firstName and the rest as lastName
- Phone numbers should include area codes if visible
- Only set category if you have clear contextual evidence; otherwise omit it
- Only set supportStatus if notes clearly indicate a conversation outcome; otherwise omit it
- Only set volunteerInterest if explicitly mentioned; otherwise omit it
- Return ONLY valid JSON — no markdown, no explanation, just the JSON object
- If you cannot read any contacts, return {"contacts":[]}

Example output:
{"volunteerName":"JANE DOE","contacts":[{"firstName":"John","lastName":"Smith","phone":"919-555-1234","city":"Raleigh","category":"neighbors"},{"firstName":"Mary","lastName":"Jones","category":"coworkers","supportStatus":"supporter","volunteerInterest":"maybe","notes":"age 45"}]}`

interface ExtractedContact {
  firstName: string
  lastName: string
  phone?: string
  city?: string
  address?: string
  category?: string
  supportStatus?: string
  volunteerInterest?: string
  notes?: string
}

interface ScanSheetResult {
  volunteerName?: string
  contacts: ExtractedContact[]
}

async function extractWithAnthropic(
  base64: string,
  mimeType: string,
  model: string,
): Promise<ScanSheetResult> {
  const client = new Anthropic()

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
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

  return parseScanResult(textBlock.text)
}

async function extractWithGemini(
  base64: string,
  mimeType: string,
  model: string,
): Promise<ScanSheetResult> {
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
      maxOutputTokens: 4096,
    },
  })

  const text = response.text
  if (!text) throw new Error('No text response from Gemini')

  return parseScanResult(text)
}

const VALID_CATEGORIES = ['household', 'close-family', 'extended-family', 'best-friends', 'close-friends', 'neighbors', 'coworkers', 'faith-community', 'school-pta', 'sports-recreation', 'hobby-groups', 'community-regulars', 'recent-meals', 'who-did-we-miss']
const VALID_SUPPORT = ['supporter', 'undecided', 'opposed', 'left-message', 'no-answer']
const VALID_VOLUNTEER = ['yes', 'no', 'maybe']

function parseScanResult(rawText: string): ScanSheetResult {
  // Strip markdown code fences if present
  let text = rawText.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  // Try to extract JSON from surrounding text (AI sometimes adds preamble)
  if (!text.startsWith('[') && !text.startsWith('{')) {
    const jsonStart = text.search(/[\[{]/)
    if (jsonStart > 0) text = text.slice(jsonStart)
  }

  // If JSON is truncated, try to salvage what we can
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Try to fix truncated JSON by closing open structures
    let fixed = text
    // Count open/close braces and brackets
    const openBraces = (fixed.match(/{/g) || []).length
    const closeBraces = (fixed.match(/}/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length
    const closeBrackets = (fixed.match(/]/g) || []).length

    // Truncate to last complete object (find last },)
    const lastComplete = Math.max(fixed.lastIndexOf('},'), fixed.lastIndexOf('}]'))
    if (lastComplete > 0) {
      fixed = fixed.slice(0, lastComplete + 1)
      // Close remaining open brackets/braces
      for (let i = 0; i < openBrackets - (fixed.match(/]/g) || []).length; i++) fixed += ']'
      for (let i = 0; i < openBraces - (fixed.match(/}/g) || []).length; i++) fixed += '}'
      parsed = JSON.parse(fixed)
    } else {
      throw new Error(`AI response is not valid JSON (truncated at position ${text.length})`)
    }
  }

  // Handle both formats: raw array (backward compat) and object with volunteerName
  let volunteerName: string | undefined
  let contactsArray: unknown[]

  if (Array.isArray(parsed)) {
    contactsArray = parsed
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).contacts)) {
    const obj = parsed as Record<string, unknown>
    contactsArray = obj.contacts as unknown[]
    if (typeof obj.volunteerName === 'string' && obj.volunteerName.trim()) {
      volunteerName = obj.volunteerName.trim().slice(0, 100)
    }
  } else {
    throw new Error('AI response is not a valid scan result')
  }

  // Validate and clean each contact
  const contacts = (contactsArray as Record<string, unknown>[])
    .filter(
      (c) =>
        typeof c.firstName === 'string' &&
        typeof c.lastName === 'string' &&
        c.firstName.trim().length > 0 &&
        c.lastName.trim().length > 0,
    )
    .map((c) => {
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
      if (typeof c.category === 'string' && VALID_CATEGORIES.includes(c.category.trim())) {
        contact.category = c.category.trim()
      }
      if (typeof c.supportStatus === 'string' && VALID_SUPPORT.includes(c.supportStatus.trim())) {
        contact.supportStatus = c.supportStatus.trim()
      }
      if (typeof c.volunteerInterest === 'string' && VALID_VOLUNTEER.includes(c.volunteerInterest.trim())) {
        contact.volunteerInterest = c.volunteerInterest.trim()
      }
      if (typeof c.notes === 'string' && c.notes.trim()) {
        contact.notes = c.notes.trim().slice(0, 200)
      }
      return contact
    })

  return { volunteerName, contacts }
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

    let result: ScanSheetResult

    try {
      if (aiSettings.provider === 'gemini') {
        result = await extractWithGemini(image, mimeType, aiSettings.chatModel)
      } else {
        result = await extractWithAnthropic(image, mimeType, aiSettings.chatModel)
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

    return NextResponse.json({ contacts: result.contacts, volunteerName: result.volunteerName || null })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[scan-sheet] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
