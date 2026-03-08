import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext, requireSupportAdmin } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { getTicket, updateTicket, listEvents } from '@/lib/support-tickets'
import { notifyTicketEvent } from '@/lib/support-realtime'
import { ADMIN_ROLES } from '@/types'

/** GET /api/support/tickets/[ticketId] — Get ticket detail */
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

    // Non-admins can only view their own tickets
    const isAdmin = ctx.isPlatformAdmin || ADMIN_ROLES.includes(ctx.role)
    if (!isAdmin && ticket.userId !== ctx.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const events = await listEvents(params.ticketId)

    return NextResponse.json({ ticket, events })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/** PATCH /api/support/tickets/[ticketId] — Update ticket (admin only) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { ticketId: string } },
) {
  try {
    const ctx = await getSupportContext()
    requireSupportAdmin(ctx)

    const body = await request.json()
    const ticket = await updateTicket(params.ticketId, ctx.userId, {
      status: body.status,
      priority: body.priority,
      category: body.category,
      assignedTo: body.assignedTo,
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Notify via SSE
    notifyTicketEvent(ctx.campaignId, ticket.userId, ticket.assignedTo, {
      type: 'ticket_updated',
      ticketId: ticket.id,
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo,
    }).catch(err => console.error('[tickets] SSE notify error:', err))

    return NextResponse.json({ ticket })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
