import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext, requireSupportAdmin } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { getTicket, listMessages } from '@/lib/support-tickets'
import { suggestResponse } from '@/lib/support-ai'

/** POST /api/support/tickets/[ticketId]/suggest — Generate AI-suggested response */
export async function POST(
  _request: NextRequest,
  { params }: { params: { ticketId: string } },
) {
  try {
    const ctx = await getSupportContext()
    requireSupportAdmin(ctx)

    const ticket = await getTicket(params.ticketId)
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const messages = await listMessages(params.ticketId, true)

    const suggestion = await suggestResponse({
      ticketSubject: ticket.subject,
      ticketCategory: ticket.category,
      aiConversation: ticket.aiConversation,
      messages: messages.map(m => ({
        senderName: m.senderName || 'Unknown',
        content: m.content,
        isInternalNote: m.isInternalNote,
      })),
      campaignId: ctx.campaignId,
    })

    return NextResponse.json({ suggestion })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
