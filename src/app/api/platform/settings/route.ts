import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'
import { getAISettings, updateAISettings, MODEL_OPTIONS } from '@/lib/ai-settings'
import { isGeminiEnabled } from '@/lib/gemini-provider'
import { isAIEnabled } from '@/lib/ai-chat'

export async function GET() {
  try {
    await requirePlatformAdmin()

    const settings = await getAISettings()

    return NextResponse.json({
      settings,
      modelOptions: MODEL_OPTIONS,
      apiKeysConfigured: {
        anthropic: isAIEnabled(),
        gemini: isGeminiEnabled(),
      },
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requirePlatformAdmin()
    const body = await request.json()

    // Validate provider
    if (body.provider && !['anthropic', 'gemini'].includes(body.provider)) {
      return NextResponse.json({ error: 'provider must be "anthropic" or "gemini"' }, { status: 400 })
    }

    // Validate numeric fields
    if (body.maxTokens !== undefined) {
      const n = parseInt(body.maxTokens, 10)
      if (isNaN(n) || n < 256 || n > 8192) {
        return NextResponse.json({ error: 'maxTokens must be between 256 and 8192' }, { status: 400 })
      }
      body.maxTokens = n
    }
    if (body.rateLimitMessages !== undefined) {
      const n = parseInt(body.rateLimitMessages, 10)
      if (isNaN(n) || n < 5 || n > 500) {
        return NextResponse.json({ error: 'rateLimitMessages must be between 5 and 500' }, { status: 400 })
      }
      body.rateLimitMessages = n
    }
    if (body.rateLimitWindowMinutes !== undefined) {
      const n = parseInt(body.rateLimitWindowMinutes, 10)
      if (isNaN(n) || n < 1 || n > 60) {
        return NextResponse.json({ error: 'rateLimitWindowMinutes must be between 1 and 60' }, { status: 400 })
      }
      body.rateLimitWindowMinutes = n
    }
    if (body.suggestRateLimit !== undefined) {
      const n = parseInt(body.suggestRateLimit, 10)
      if (isNaN(n) || n < 5 || n > 200) {
        return NextResponse.json({ error: 'suggestRateLimit must be between 5 and 200' }, { status: 400 })
      }
      body.suggestRateLimit = n
    }

    const settings = await updateAISettings(body)

    return NextResponse.json({ settings })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
