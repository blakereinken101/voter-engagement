import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'

export async function GET() {
  try {
    const ctx = await getRequestContext()
    const db = await getDb()

    const { rows } = await db.query(
      `SELECT id, role, content, tool_calls, tool_results, created_at
       FROM chat_messages
       WHERE user_id = $1 AND campaign_id = $2
       ORDER BY created_at ASC
       LIMIT 200`,
      [ctx.userId, ctx.campaignId],
    )

    const messages = rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      toolCalls: row.tool_calls || undefined,
      toolResults: row.tool_results || undefined,
      createdAt: row.created_at,
    }))

    return NextResponse.json({ messages })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[ai/history GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const ctx = await getRequestContext()
    const db = await getDb()

    await db.query(
      'DELETE FROM chat_messages WHERE user_id = $1 AND campaign_id = $2',
      [ctx.userId, ctx.campaignId],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[ai/history DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
