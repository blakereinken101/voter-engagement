import { NextResponse } from 'next/server'
import { isAIEnabled } from '@/lib/ai-chat'

export function GET() {
  return NextResponse.json({ enabled: isAIEnabled() })
}
