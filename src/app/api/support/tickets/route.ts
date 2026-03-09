import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext, requireSupportAdmin } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { listTickets, createTicket } from '@/lib/support-tickets'
import { sendTicketCreatedNotification } from '@/lib/email'
import { notifyTicketEvent } from '@/lib/support-realtime'
import { getPool } from '@/lib/db'
import { ADMIN_ROLES } from '@/types'
import type { TicketCategory, TicketPriority, TicketStatus } from '@/types'

/** GET /api/support/tickets — List tickets (user sees own, admin sees all) */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getSupportContext()
    const url = new URL(request.url)
    const isAdmin = ctx.isPlatformAdmin || ADMIN_ROLES.includes(ctx.role)

    const tickets = await listTickets({
      campaignId: ctx.campaignId,
      userId: ctx.userId,
      isAdmin,
      status: (url.searchParams.get('status') as TicketStatus) || undefined,
      category: (url.searchParams.get('category') as TicketCategory) || undefined,
      priority: (url.searchParams.get('priority') as TicketPriority) || undefined,
      assignedTo: url.searchParams.get('assignedTo') || undefined,
    })

    return NextResponse.json({ tickets })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/** POST /api/support/tickets — Create a ticket (manual creation) */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getSupportContext()
    const body = await request.json()
    const { subject, category, priority, aiConversation } = body

    if (!subject?.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }

    const ticket = await createTicket({
      campaignId: ctx.campaignId,
      userId: ctx.userId,
      subject: subject.trim().slice(0, 200),
      category: category || 'general',
      priority: priority || 'normal',
      aiConversation: aiConversation || undefined,
    })

    // Notify admins via SSE
    notifyTicketEvent(ctx.campaignId, ctx.userId, ticket.assignedTo, {
      type: 'ticket_created',
      ticketId: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
    }).catch(err => console.error('[tickets] SSE notify error:', err))

    // Send email notification to campaign admins (fire-and-forget)
    const pool = getPool()
    pool.query(
      `SELECT u.email FROM users u
       JOIN memberships m ON m.user_id = u.id
       WHERE m.campaign_id = $1 AND m.is_active = true
         AND m.role IN ('campaign_admin', 'org_owner')
       LIMIT 5`,
      [ctx.campaignId],
    ).then(({ rows }) => {
      for (const row of rows) {
        sendTicketCreatedNotification(
          row.email, ticket.subject, ctx.userName,
          ticket.category, ticket.priority, ticket.id,
        ).catch(() => {})
      }
    }).catch(() => {})

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
