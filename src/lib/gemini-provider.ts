/**
 * Gemini AI Provider
 *
 * Wraps the Google GenAI SDK to provide streaming chat + function calling
 * compatible with the same interface used by the Anthropic provider in ai-chat.ts.
 *
 * Server-only module.
 */

import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from '@google/genai'
import { executeTool, TOOL_DEFINITIONS } from './ai-chat'

let geminiClient: GoogleGenAI | null = null

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required')
    geminiClient = new GoogleGenAI({ apiKey })
  }
  return geminiClient
}

export function isGeminiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim()
}

/**
 * Recursively sanitize a JSON schema for Gemini compatibility.
 * - Removes empty strings from enum arrays (Gemini rejects them)
 * - Removes enums that become empty after filtering
 */
function sanitizeSchemaForGemini(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'enum' && Array.isArray(value)) {
      const filtered = value.filter((v: unknown) => v !== '')
      if (filtered.length > 0) {
        result[key] = filtered
      }
      // If all values were empty, omit the enum entirely
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeSchemaForGemini(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Convert Anthropic tool definitions to Gemini function declarations.
 */
function convertToolsToGemini(): FunctionDeclaration[] {
  return TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: sanitizeSchemaForGemini(tool.input_schema as Record<string, unknown>),
  }))
}

/**
 * Convert chat history from Anthropic format to Gemini format.
 */
function convertHistoryToGemini(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  message: string,
): Content[] {
  const contents: Content[] = []
  for (const m of history) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  }
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  })
  return contents
}

/**
 * Parse a Gemini API error into a user-friendly message.
 */
function getGeminiErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (lower.includes('api key') || lower.includes('api_key') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'Gemini API key is invalid. Please check your configuration in Admin settings.'
  }
  if (lower.includes('not found') || lower.includes('404') || lower.includes('model')) {
    return 'Gemini model not available. Please check the model name in AI settings.'
  }
  if (lower.includes('rate') || lower.includes('quota') || lower.includes('429') || lower.includes('resource_exhausted')) {
    return 'Gemini rate limit reached. Please wait a moment and try again.'
  }
  if (lower.includes('safety') || lower.includes('blocked')) {
    return 'Gemini blocked the response due to safety filters. Please try rephrasing.'
  }

  return 'Gemini encountered an error. Please try again.'
}

export interface GeminiStreamOptions {
  model: string
  maxTokens: number
  systemPrompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  message: string
  userId: string
  campaignId: string
}

/**
 * Stream a chat response from Gemini with tool calling support.
 * Yields the same event format as the Anthropic streamChat.
 */
export async function* streamGeminiChat(
  options: GeminiStreamOptions,
): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  let client: GoogleGenAI
  try {
    client = getGeminiClient()
  } catch (err) {
    console.error('[gemini] Client initialization error:', err)
    yield { type: 'error', message: getGeminiErrorMessage(err) }
    return
  }

  const ctx = { userId: options.userId, campaignId: options.campaignId }
  const functionDeclarations = convertToolsToGemini()

  let contents = convertHistoryToGemini(options.history, options.message)
  let continueLoop = true

  while (continueLoop) {
    try {
      const response = await client.models.generateContentStream({
        model: options.model,
        contents,
        config: {
          systemInstruction: options.systemPrompt,
          maxOutputTokens: options.maxTokens,
          tools: [{ functionDeclarations }],
        },
      })

      let fullText = ''
      const functionCalls: Array<{ name: string; args: Record<string, unknown>; id: string }> = []

      for await (const chunk of response) {
        if (!chunk.candidates?.[0]?.content?.parts) continue

        for (const part of chunk.candidates[0].content.parts) {
          if (part.text) {
            fullText += part.text
            yield { type: 'text', text: part.text }
          }
          if (part.functionCall && part.functionCall.name) {
            const id = `gemini_${Date.now()}_${functionCalls.length}`
            functionCalls.push({
              name: part.functionCall.name,
              args: (part.functionCall.args || {}) as Record<string, unknown>,
              id,
            })
          }
        }
      }

      if (functionCalls.length > 0) {
        // Execute tools
        const functionResponseParts: Part[] = []

        for (const fc of functionCalls) {
          try {
            const result = await executeTool(fc.name, fc.args, ctx)
            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: result,
              },
            })

            // Emit tool result to client for AppContext sync
            yield { type: 'tool_result', name: fc.name, input: fc.args, result }
          } catch (toolErr) {
            console.error(`[gemini] Tool execution error (${fc.name}):`, toolErr)
            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: { error: `Tool ${fc.name} failed: ${toolErr instanceof Error ? toolErr.message : 'unknown error'}` },
              },
            })
          }
        }

        // Build the model's response content (text + function calls)
        const modelParts: Part[] = []
        if (fullText) modelParts.push({ text: fullText })
        for (const fc of functionCalls) {
          modelParts.push({
            functionCall: { name: fc.name, args: fc.args },
          })
        }

        // Add model response + function results to continue the conversation
        contents = [
          ...contents,
          { role: 'model' as const, parts: modelParts },
          { role: 'user' as const, parts: functionResponseParts },
        ]

        // Loop continues — Gemini will respond incorporating tool results
      } else {
        continueLoop = false
      }
    } catch (err) {
      console.error('[gemini] Stream error:', err)
      yield { type: 'error', message: getGeminiErrorMessage(err) }
      return
    }
  }

  yield { type: 'done' }
}

/**
 * Simple (non-streaming) Gemini completion for suggestions.
 */
export async function geminiComplete(options: {
  model: string
  systemPrompt: string
  userMessage: string
  maxTokens: number
}): Promise<string> {
  try {
    const client = getGeminiClient()

    const response = await client.models.generateContent({
      model: options.model,
      contents: [{ role: 'user', parts: [{ text: options.userMessage }] }],
      config: {
        systemInstruction: options.systemPrompt,
        maxOutputTokens: options.maxTokens,
      },
    })

    return response.text ?? ''
  } catch (err) {
    console.error('[gemini] Completion error:', err)
    return `[Error: ${getGeminiErrorMessage(err)}]`
  }
}
