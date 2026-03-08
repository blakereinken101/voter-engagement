import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { recordFeedback } from '@/lib/support-kb'

/** POST /api/support/kb/[articleId]/feedback — Record helpful/not helpful */
export async function POST(
  request: NextRequest,
  { params }: { params: { articleId: string } },
) {
  try {
    await getSupportContext()
    const body = await request.json()
    const { helpful } = body

    if (typeof helpful !== 'boolean') {
      return NextResponse.json({ error: 'helpful must be a boolean' }, { status: 400 })
    }

    await recordFeedback(params.articleId, helpful)
    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
