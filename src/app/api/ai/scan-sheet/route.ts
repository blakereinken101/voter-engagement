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
  - zip (string, optional — zip or postal code)
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
{"volunteerName":"JANE DOE","contacts":[{"firstName":"John","lastName":"Smith","phone":"919-555-1234","address":"123 Main St","city":"Raleigh","zip":"27601","category":"neighbors"},{"firstName":"Mary","lastName":"Jones","category":"coworkers","supportStatus":"supporter","volunteerInterest":"maybe","notes":"age 45"}]}`

interface ExtractedContact {
  firstName: string
  lastName: string
  phone?: string
  city?: string
  address?: string
  zip?: string
  category?: string
  supportStatus?: string
  volunteerInterest?: string
  notes?: string
}

interface ScanSheetResult {
  volunteerName?: string
  contacts: ExtractedContact[]
}

const PETITION_EXTRACTION_PROMPT = `You are a data extraction assistant. Analyze this image of a petition sheet and extract all signature information you can read. Petition sheets typically have rows with columns for: line number, printed name, residential address, city, zip code, date signed, and signature.

Return a JSON object with these top-level fields:
- petitionerName (string, optional) — the name of the PETITIONER or CIRCULATOR who collected these signatures. Look for this at the VERY TOP or BOTTOM of the sheet. It is often:
  - Labeled "Circulator:", "Petitioner:", "Collected by:", "Canvasser:", or similar
  - Written in ALL CAPS or in a separate box/header area
  - A signature or printed name in a "Circulator Certification" section at the bottom
  - Do NOT confuse this with a regular signer. The petitioner/circulator is the person who collected the signatures.
  - If you cannot clearly identify a circulator name, omit this field.
- date (string, optional) — the date on the sheet header, or the most common date signed if no header date
- signatures (array of objects, required) — each object represents one signature line:
  - lineNumber (number, optional — the row/line number on the sheet)
  - firstName (string, required)
  - lastName (string, required)
  - address (string, optional — full street address)
  - city (string, optional)
  - zip (string, optional — zip/postal code)
  - dateSigned (string, optional — the date this person signed, e.g. "3/1/2026" or "March 1, 2026")

Rules:
- If a field is illegible or missing, omit it from that object
- If you can read a full name but can't tell first from last, put the first word as firstName and the rest as lastName
- Extract ALL rows that have at least a readable name, even if other fields are blank
- Preserve date formats as written (don't normalize)
- Return ONLY valid JSON — no markdown, no explanation, just the JSON object
- If you cannot read any signatures, return {"signatures":[]}

Example output:
{"petitionerName":"JANE DOE","date":"3/1/2026","signatures":[{"lineNumber":1,"firstName":"John","lastName":"Smith","address":"123 Main St","city":"Raleigh","zip":"27601","dateSigned":"3/1/2026"},{"lineNumber":2,"firstName":"Mary","lastName":"Jones","address":"456 Oak Ave","city":"Durham","zip":"27701","dateSigned":"3/1/2026"}]}`

interface PetitionSignature {
  lineNumber?: number
  firstName: string
  lastName: string
  address?: string
  city?: string
  zip?: string
  dateSigned?: string
}

interface PetitionResult {
  petitionerName?: string
  date?: string
  signatures: PetitionSignature[]
}

function parsePetitionResult(rawText: string): PetitionResult {
  let text = rawText.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }
  if (!text.startsWith('[') && !text.startsWith('{')) {
    const jsonStart = text.search(/[\[{]/)
    if (jsonStart > 0) text = text.slice(jsonStart)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    let fixed = text
    const openBraces = (fixed.match(/{/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length
    const lastComplete = Math.max(fixed.lastIndexOf('},'), fixed.lastIndexOf('}]'))
    if (lastComplete > 0) {
      fixed = fixed.slice(0, lastComplete + 1)
      for (let i = 0; i < openBrackets - (fixed.match(/]/g) || []).length; i++) fixed += ']'
      for (let i = 0; i < openBraces - (fixed.match(/}/g) || []).length; i++) fixed += '}'
      parsed = JSON.parse(fixed)
    } else {
      throw new Error(`AI response is not valid JSON (truncated at position ${text.length})`)
    }
  }

  const obj = parsed as Record<string, unknown>
  let petitionerName: string | undefined
  let date: string | undefined

  if (typeof obj.petitionerName === 'string' && obj.petitionerName.trim()) {
    petitionerName = obj.petitionerName.trim().slice(0, 100)
  }
  if (typeof obj.date === 'string' && obj.date.trim()) {
    date = obj.date.trim().slice(0, 20)
  }

  const sigArray = Array.isArray(obj.signatures) ? obj.signatures : (Array.isArray(parsed) ? parsed : [])

  const signatures = (sigArray as Record<string, unknown>[])
    .filter(s => typeof s.firstName === 'string' && typeof s.lastName === 'string' &&
                 s.firstName.trim().length > 0 && s.lastName.trim().length > 0)
    .map((s, idx) => {
      const sig: PetitionSignature = {
        firstName: String(s.firstName).trim().slice(0, 50),
        lastName: String(s.lastName).trim().slice(0, 50),
      }
      if (typeof s.lineNumber === 'number') sig.lineNumber = s.lineNumber
      else sig.lineNumber = idx + 1
      if (typeof s.address === 'string' && s.address.trim()) sig.address = s.address.trim().slice(0, 200)
      if (typeof s.city === 'string' && s.city.trim()) sig.city = s.city.trim().slice(0, 50)
      if (typeof s.zip === 'string' && s.zip.trim()) sig.zip = s.zip.trim().replace(/[^0-9]/g, '').slice(0, 5)
      if (typeof s.dateSigned === 'string' && s.dateSigned.trim()) sig.dateSigned = s.dateSigned.trim().slice(0, 20)
      return sig
    })

  return { petitionerName, date, signatures }
}

async function extractWithAnthropic(
  base64: string,
  mimeType: string,
  model: string,
  prompt: string,
): Promise<string> {
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
            text: prompt,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from AI')
  }

  return textBlock.text
}

async function extractWithGemini(
  base64: string,
  mimeType: string,
  model: string,
  prompt: string,
): Promise<string> {
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
          { text: prompt },
        ],
      },
    ],
    config: {
      maxOutputTokens: 4096,
    },
  })

  const text = response.text
  if (!text) throw new Error('No text response from Gemini')

  return text
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
      if (typeof c.zip === 'string' && c.zip.trim()) {
        contact.zip = c.zip.trim().replace(/[^0-9]/g, '').slice(0, 5)
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

    let body: { image: string; mimeType: string; mode?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { image, mimeType, mode } = body
    const isPetition = mode === 'petition'

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
    const prompt = isPetition ? PETITION_EXTRACTION_PROMPT : EXTRACTION_PROMPT

    let rawText: string

    try {
      if (aiSettings.provider === 'gemini') {
        rawText = await extractWithGemini(image, mimeType, aiSettings.chatModel, prompt)
      } else {
        rawText = await extractWithAnthropic(image, mimeType, aiSettings.chatModel, prompt)
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
        { error: `Failed to extract ${isPetition ? 'signatures' : 'contacts'} from image. Please try again.` },
        { status: 500 },
      )
    }

    if (isPetition) {
      const petitionResult = parsePetitionResult(rawText)
      return NextResponse.json({
        mode: 'petition',
        petitionerName: petitionResult.petitionerName || null,
        date: petitionResult.date || null,
        signatures: petitionResult.signatures,
      })
    } else {
      const result = parseScanResult(rawText)
      return NextResponse.json({ contacts: result.contacts, volunteerName: result.volunteerName || null })
    }
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[scan-sheet] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
