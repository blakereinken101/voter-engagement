/**
 * AI Re-Ranking for Petition Voter File Matching
 *
 * After algorithmic matching produces candidates, this module sends them
 * to an LLM for holistic evaluation — catching OCR errors, address
 * abbreviations, name variants, and other subtleties algorithms miss.
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import type { MatchCandidate, AiConfidence } from '@/types'

// =============================================
// TYPES
// =============================================

export interface AiRerankInput {
  signatureId: string
  ocrData: {
    firstName: string
    lastName: string
    address?: string
    city?: string
    zip?: string
  }
  candidates: Array<{
    index: number
    firstName: string
    lastName: string
    address?: string
    city?: string
    zip?: string
    party?: string
    algorithmicScore: number
  }>
}

interface AiAssessment {
  signatureId: string
  assessments: Array<{
    candidateIndex: number
    aiConfidence: AiConfidence
    reasoning: string
  }>
  recommendedIndex: number | null
}

// =============================================
// PROMPT
// =============================================

const RERANK_PROMPT = `You are a voter file matching assistant. For each petition signature below, evaluate the candidate voter records and assess whether each candidate is likely the same person who signed the petition.

Consider these common issues:
- OCR errors in handwritten text (l/1, O/0, missing or swapped letters)
- Address abbreviations (ST vs STREET, AVE vs AVENUE, APT vs #, DR vs DRIVE)
- Name variations (nicknames, middle names, suffixes like Jr/Sr/III, hyphenated names)
- City/zip consistency (same zip usually means same area even if city name differs)
- Partial information (missing address or city doesn't mean it's not a match)

For each signature, return a JSON array. Each element should have:
- "signatureId": the ID from the input
- "assessments": array of objects with:
  - "candidateIndex": the candidate number
  - "aiConfidence": one of "likely-match", "possible-match", or "unlikely-match"
  - "reasoning": a SHORT (under 15 words) explanation
- "recommendedIndex": index of the best candidate, or null if none seem right

Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.`

// =============================================
// MAIN FUNCTION
// =============================================

export async function aiRerankMatches(
  inputs: AiRerankInput[],
  provider: 'anthropic' | 'gemini',
  model: string,
): Promise<AiAssessment[]> {
  if (inputs.length === 0) return []

  // Batch into chunks of 20 to stay within token limits
  const BATCH_SIZE = 20
  const allResults: AiAssessment[] = []

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE)
    const batchResults = await rerankBatch(batch, provider, model)
    allResults.push(...batchResults)
  }

  return allResults
}

async function rerankBatch(
  inputs: AiRerankInput[],
  provider: 'anthropic' | 'gemini',
  model: string,
): Promise<AiAssessment[]> {
  // Build the signature descriptions
  const sigDescriptions = inputs.map((input, idx) => {
    const ocr = input.ocrData
    const ocrLine = `"${ocr.firstName} ${ocr.lastName}"${ocr.address ? ` at "${ocr.address}"` : ''}${ocr.city ? `, ${ocr.city}` : ''}${ocr.zip ? ` ${ocr.zip}` : ''}`

    const candidateLines = input.candidates.map(c => {
      return `  Candidate ${c.index}: "${c.firstName} ${c.lastName}"${c.address ? ` at "${c.address}"` : ''}${c.city ? `, ${c.city}` : ''}${c.zip ? ` ${c.zip}` : ''} (algo score: ${Math.round(c.algorithmicScore * 100)}%)`
    }).join('\n')

    return `[${idx + 1}] signatureId: "${input.signatureId}"\n  OCR: ${ocrLine}\n${candidateLines}`
  }).join('\n\n')

  const fullPrompt = `${RERANK_PROMPT}\n\nSIGNATURES:\n${sigDescriptions}`

  let rawText: string
  if (provider === 'anthropic') {
    rawText = await callAnthropic(fullPrompt, model)
  } else {
    rawText = await callGemini(fullPrompt, model)
  }

  return parseRerankResponse(rawText, inputs)
}

// =============================================
// PROVIDER CALLS
// =============================================

async function callAnthropic(prompt: string, model: string): Promise<string> {
  const client = new Anthropic()
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Anthropic')
  }
  return textBlock.text
}

async function callGemini(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const client = new GoogleGenAI({ apiKey })
  const response = await client.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 4096 },
  })

  const text = response.text
  if (!text) throw new Error('No text response from Gemini')
  return text
}

// =============================================
// RESPONSE PARSING
// =============================================

function parseRerankResponse(rawText: string, inputs: AiRerankInput[]): AiAssessment[] {
  let text = rawText.trim()

  // Strip markdown fences
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  // Find JSON array start
  const jsonStart = text.indexOf('[')
  if (jsonStart >= 0) text = text.slice(jsonStart)

  let parsed: unknown[]
  try {
    parsed = JSON.parse(text)
  } catch {
    // Try to recover truncated JSON
    let fixed = text
    const lastComplete = Math.max(fixed.lastIndexOf('},'), fixed.lastIndexOf('}]'))
    if (lastComplete > 0) {
      fixed = fixed.slice(0, lastComplete + 1)
      const openBrackets = (fixed.match(/\[/g) || []).length
      const closeBrackets = (fixed.match(/]/g) || []).length
      for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']'
      parsed = JSON.parse(fixed)
    } else {
      console.error('[ai-rerank] Failed to parse AI response:', text.slice(0, 200))
      return []
    }
  }

  if (!Array.isArray(parsed)) return []

  const VALID_CONFIDENCE: AiConfidence[] = ['likely-match', 'possible-match', 'unlikely-match']

  return parsed
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map(item => {
      const signatureId = String(item.signatureId || '')
      const rawAssessments = Array.isArray(item.assessments) ? item.assessments : []

      const assessments = rawAssessments
        .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object')
        .map(a => ({
          candidateIndex: typeof a.candidateIndex === 'number' ? a.candidateIndex : 0,
          aiConfidence: (VALID_CONFIDENCE.includes(a.aiConfidence as AiConfidence)
            ? a.aiConfidence : 'possible-match') as AiConfidence,
          reasoning: typeof a.reasoning === 'string' ? a.reasoning.slice(0, 100) : '',
        }))

      const recommendedIndex = typeof item.recommendedIndex === 'number' ? item.recommendedIndex : null

      return { signatureId, assessments, recommendedIndex }
    })
    .filter(r => r.signatureId) // drop entries with empty signatureId
}

// =============================================
// MERGE AI RESULTS INTO MATCH CANDIDATES
// =============================================

export function applyAiReranking(
  results: Array<{ personEntry: { id: string }; candidates: MatchCandidate[] }>,
  aiResults: AiAssessment[],
): void {
  const aiMap = new Map(aiResults.map(r => [r.signatureId, r]))

  for (const result of results) {
    const ai = aiMap.get(result.personEntry.id)
    if (!ai) continue

    // Apply AI assessments to each candidate
    for (const assessment of ai.assessments) {
      const candidate = result.candidates[assessment.candidateIndex]
      if (candidate) {
        candidate.aiConfidence = assessment.aiConfidence
        candidate.aiReasoning = assessment.reasoning
      }
    }

    // If AI recommends a different top candidate, reorder
    if (ai.recommendedIndex !== null && ai.recommendedIndex !== 0 &&
        ai.recommendedIndex < result.candidates.length) {
      const recommended = result.candidates[ai.recommendedIndex]
      // Only reorder if the AI strongly disagrees (recommended is "likely" and current top is not)
      if (recommended.aiConfidence === 'likely-match' &&
          result.candidates[0].aiConfidence !== 'likely-match') {
        // Swap to front
        result.candidates.splice(ai.recommendedIndex, 1)
        result.candidates.unshift(recommended)
      }
    }
  }
}
