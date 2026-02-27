/**
 * Gemini AI Provider
 *
 * Wraps the Google GenAI SDK to provide streaming chat + function calling
 * compatible with the same interface used by the Anthropic provider in ai-chat.ts.
 *
 * Server-only module.
 */

import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from '@google/genai'
import type Anthropic from '@anthropic-ai/sdk'
import { executeTool, TOOL_DEFINITIONS } from './ai-chat'

let geminiClient: GoogleGenAI | null = null

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required')
    geminiClient = new GoogleGenAI({ apiKey })
  }
  return geminiClient
}

export function isGeminiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY
}

/**
 * Convert Anthropic tool definitions to Gemini function declarations.
 */
function convertToolsToGemini(): FunctionDeclaration[] {
  return TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema as Record<string, unknown>,
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
  const client = getGeminiClient()
  const ctx = { userId: options.userId, campaignId: options.campaignId }
  const functionDeclarations = convertToolsToGemini()

  let contents = convertHistoryToGemini(options.history, options.message)
  let continueLoop = true

  while (continueLoop) {
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
        if (part.functionCall) {
          const id = `gemini_${Date.now()}_${functionCalls.length}`
          functionCalls.push({
            name: part.functionCall.name!,
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
        const result = await executeTool(fc.name, fc.args, ctx)
        functionResponseParts.push({
          functionResponse: {
            name: fc.name,
            response: result,
          },
        })

        // Emit tool result to client for AppContext sync
        yield { type: 'tool_result', name: fc.name, input: fc.args, result }
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
}
