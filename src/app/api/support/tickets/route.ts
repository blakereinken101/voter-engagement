import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext, requireSupportAdmin } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { listTickets, createTicket } from '@/lib/support-tickets'
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

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
