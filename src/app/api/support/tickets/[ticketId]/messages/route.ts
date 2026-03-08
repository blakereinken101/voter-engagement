import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext, requireSupportAdmin } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { getTicket, listMessages, createMessage } from '@/lib/support-tickets'
import { notifyTicketEvent } from '@/lib/support-realtime'
import { sendTicketReplyNotification } from '@/lib/email'
import { getPool } from '@/lib/db'
import { ADMIN_ROLES } from '@/types'

/** GET /api/support/tickets/[ticketId]/messages — List messages */
export async function GET(
  _request: NextRequest,
  { params }: { params: { ticketId: string } },
) {
  try {
    const ctx = await getSupportContext()
    const ticket = await getTicket(params.ticketId)

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const isAdmin = ctx.isPlatformAdmin || ADMIN_ROLES.includes(ctx.role)
    if (!isAdmin && ticket.userId !== ctx.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Only admins can see internal notes
    const messages = await listMessages(params.ticketId, isAdmin)

    return NextResponse.json({ messages })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/** POST /api/support/tickets/[ticketId]/messages — Post reply or internal note */
export async function POST(
  request: NextRequest,
  { params }: { params: { ticketId: string } },
) {
  try {
    const ctx = await getSupportContext()
    const ticket = await getTicket(params.ticketId)

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const isAdmin = ctx.isPlatformAdmin || ADMIN_ROLES.includes(ctx.role)
    if (!isAdmin && ticket.userId !== ctx.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { content, isInternalNote } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Only admins can post internal notes
    if (isInternalNote && !isAdmin) {
      return NextResponse.json({ error: 'Only admins can post internal notes' }, { status: 403 })
    }

    const message = await createMessage({
      ticketId: params.ticketId,
      senderId: ctx.userId,
      content: content.trim(),
      isInternalNote: !!isInternalNote,
    })

    // Notify via SSE (don't notify for internal notes — only admins see those)
    if (!isInternalNote) {
      notifyTicketEvent(ctx.campaignId, ticket.userId, ticket.assignedTo, {
        type: 'new_message',
        ticketId: ticket.id,
        message: {
          id: message.id,
          senderId: message.senderId,
          senderName: ctx.userName,
          content: message.content,
          createdAt: message.createdAt,
        },
      }).catch(err => console.error('[tickets] SSE notify error:', err))

      // Send email notification to ticket owner when an admin replies
      if (isAdmin && ticket.userId !== ctx.userId) {
        const pool = getPool()
        pool.query('SELECT email, name FROM users WHERE id = $1', [ticket.userId])
          .then(({ rows }) => {
            if (rows.length > 0) {
              sendTicketReplyNotification(
                rows[0].email, rows[0].name, ticket.subject,
                ctx.userName, content.trim(),
              ).catch(() => {})
            }
          }).catch(() => {})
      }
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
