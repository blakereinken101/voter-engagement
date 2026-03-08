/**
 * Support ticket CRUD operations.
 * Server-only module — do not import from client components.
 */
import { getPool } from '@/lib/db'
import type {
  SupportTicket, SupportTicketMessage, SupportTicketEvent,
  SupportChatMessage, TicketCategory, TicketPriority, TicketStatus,
} from '@/types'
import { ADMIN_ROLES, type MembershipRole } from '@/types'

function rowToTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    userId: row.user_id as string,
    assignedTo: (row.assigned_to as string) || null,
    subject: row.subject as string,
    category: row.category as TicketCategory,
    priority: row.priority as TicketPriority,
    status: row.status as TicketStatus,
    aiConversation: row.ai_conversation as SupportChatMessage[] | null,
    aiSuggestedCategory: (row.ai_suggested_category as string) || null,
    aiSuggestedPriority: (row.ai_suggested_priority as string) || null,
    resolvedAt: row.resolved_at ? (row.resolved_at as Date).toISOString() : null,
    closedAt: row.closed_at ? (row.closed_at as Date).toISOString() : null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    userName: (row.user_name as string) || undefined,
    userEmail: (row.user_email as string) || undefined,
    assignedName: (row.assigned_name as string) || undefined,
    messageCount: row.message_count !== undefined ? Number(row.message_count) : undefined,
    lastMessageAt: row.last_message_at ? (row.last_message_at as Date).toISOString() : undefined,
  }
}

function rowToMessage(row: Record<string, unknown>): SupportTicketMessage {
  return {
    id: row.id as string,
    ticketId: row.ticket_id as string,
    senderId: row.sender_id as string,
    content: row.content as string,
    isInternalNote: row.is_internal_note as boolean,
    aiSuggested: row.ai_suggested as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    senderName: (row.sender_name as string) || undefined,
    senderRole: (row.sender_role as MembershipRole) || undefined,
  }
}

function rowToEvent(row: Record<string, unknown>): SupportTicketEvent {
  return {
    id: row.id as string,
    ticketId: row.ticket_id as string,
    actorId: row.actor_id as string,
    eventType: row.event_type as string,
    oldValue: (row.old_value as string) || null,
    newValue: (row.new_value as string) || null,
    createdAt: (row.created_at as Date).toISOString(),
    actorName: (row.actor_name as string) || undefined,
  }
}

// ── Ticket CRUD ─────────────────────────────────────────────────

export async function createTicket(data: {
  campaignId: string
  userId: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  aiConversation?: SupportChatMessage[]
  aiSuggestedCategory?: string
  aiSuggestedPriority?: string
}): Promise<SupportTicket> {
  const pool = getPool()
  const id = crypto.randomUUID()

  // Check if campaign has auto-assignment routing
  let assignedTo: string | null = null
  try {
    const { rows: campRows } = await pool.query(
      'SELECT settings FROM campaigns WHERE id = $1',
      [data.campaignId]
    )
    const settings = campRows[0]?.settings as Record<string, unknown> | undefined
    const routing = settings?.supportRouting as Record<string, string> | undefined
    if (routing) {
      assignedTo = routing[data.category] || routing.default || null
    }
  } catch {
    // Non-fatal: proceed without auto-assignment
  }

  const { rows } = await pool.query(`
    INSERT INTO support_tickets (id, campaign_id, user_id, assigned_to, subject, category, priority, ai_conversation, ai_suggested_category, ai_suggested_priority)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    id, data.campaignId, data.userId, assignedTo, data.subject,
    data.category, data.priority,
    data.aiConversation ? JSON.stringify(data.aiConversation) : null,
    data.aiSuggestedCategory || null,
    data.aiSuggestedPriority || null,
  ])

  // Record creation event
  await pool.query(`
    INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, new_value)
    VALUES ($1, $2, $3, 'created', $4)
  `, [crypto.randomUUID(), id, data.userId, data.subject])

  return rowToTicket(rows[0])
}

export async function listTickets(opts: {
  campaignId: string
  userId?: string
  isAdmin: boolean
  status?: TicketStatus
  category?: TicketCategory
  priority?: TicketPriority
  assignedTo?: string
}): Promise<SupportTicket[]> {
  const pool = getPool()
  const conditions: string[] = ['t.campaign_id = $1']
  const params: unknown[] = [opts.campaignId]
  let paramIdx = 2

  // Non-admin users can only see their own tickets
  if (!opts.isAdmin) {
    conditions.push(`t.user_id = $${paramIdx}`)
    params.push(opts.userId!)
    paramIdx++
  }

  if (opts.status) {
    conditions.push(`t.status = $${paramIdx}`)
    params.push(opts.status)
    paramIdx++
  }
  if (opts.category) {
    conditions.push(`t.category = $${paramIdx}`)
    params.push(opts.category)
    paramIdx++
  }
  if (opts.priority) {
    conditions.push(`t.priority = $${paramIdx}`)
    params.push(opts.priority)
    paramIdx++
  }
  if (opts.assignedTo) {
    conditions.push(`t.assigned_to = $${paramIdx}`)
    params.push(opts.assignedTo)
    paramIdx++
  }

  const { rows } = await pool.query(`
    SELECT t.*,
           u.name as user_name, u.email as user_email,
           a.name as assigned_name,
           (SELECT COUNT(*) FROM support_ticket_messages m WHERE m.ticket_id = t.id) as message_count,
           (SELECT MAX(m.created_at) FROM support_ticket_messages m WHERE m.ticket_id = t.id) as last_message_at
    FROM support_tickets t
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN users a ON a.id = t.assigned_to
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      t.created_at DESC
  `, params)
  return rows.map(rowToTicket)
}

export async function getTicket(ticketId: string): Promise<SupportTicket | null> {
  const pool = getPool()
  const { rows } = await pool.query(`
    SELECT t.*,
           u.name as user_name, u.email as user_email,
           a.name as assigned_name,
           (SELECT COUNT(*) FROM support_ticket_messages m WHERE m.ticket_id = t.id) as message_count
    FROM support_tickets t
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN users a ON a.id = t.assigned_to
    WHERE t.id = $1
  `, [ticketId])
  return rows.length > 0 ? rowToTicket(rows[0]) : null
}

export async function updateTicket(
  ticketId: string,
  actorId: string,
  updates: {
    status?: TicketStatus
    priority?: TicketPriority
    category?: TicketCategory
    assignedTo?: string | null
  },
): Promise<SupportTicket | null> {
  const pool = getPool()

  // Get current ticket for audit logging
  const current = await getTicket(ticketId)
  if (!current) return null

  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = [ticketId]
  let paramIdx = 2

  if (updates.status !== undefined) {
    sets.push(`status = $${paramIdx}`)
    params.push(updates.status)
    paramIdx++

    if (updates.status === 'resolved') {
      sets.push('resolved_at = NOW()')
    }
    if (updates.status === 'closed') {
      sets.push('closed_at = NOW()')
    }

    // Log status change event
    const eventType = updates.status === 'resolved' ? 'resolved'
      : updates.status === 'closed' ? 'closed'
      : updates.status === 'open' && current.status !== 'open' ? 'reopened'
      : 'status_changed'
    await pool.query(`
      INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [crypto.randomUUID(), ticketId, actorId, eventType, current.status, updates.status])
  }

  if (updates.priority !== undefined) {
    sets.push(`priority = $${paramIdx}`)
    params.push(updates.priority)
    paramIdx++

    await pool.query(`
      INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, old_value, new_value)
      VALUES ($1, $2, $3, 'priority_changed', $4, $5)
    `, [crypto.randomUUID(), ticketId, actorId, current.priority, updates.priority])
  }

  if (updates.category !== undefined) {
    sets.push(`category = $${paramIdx}`)
    params.push(updates.category)
    paramIdx++

    await pool.query(`
      INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, old_value, new_value)
      VALUES ($1, $2, $3, 'category_changed', $4, $5)
    `, [crypto.randomUUID(), ticketId, actorId, current.category, updates.category])
  }

  if (updates.assignedTo !== undefined) {
    sets.push(`assigned_to = $${paramIdx}`)
    params.push(updates.assignedTo)
    paramIdx++

    await pool.query(`
      INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, old_value, new_value)
      VALUES ($1, $2, $3, 'assigned', $4, $5)
    `, [crypto.randomUUID(), ticketId, actorId, current.assignedTo || '', updates.assignedTo || ''])
  }

  const { rows } = await pool.query(
    `UPDATE support_tickets SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  )

  return rows.length > 0 ? rowToTicket(rows[0]) : null
}

// ── Ticket Messages ─────────────────────────────────────────────

export async function listMessages(ticketId: string, includeInternal: boolean): Promise<SupportTicketMessage[]> {
  const pool = getPool()
  const internalFilter = includeInternal ? '' : 'AND m.is_internal_note = false'

  const { rows } = await pool.query(`
    SELECT m.*, u.name as sender_name,
           mem.role as sender_role
    FROM support_ticket_messages m
    LEFT JOIN users u ON u.id = m.sender_id
    LEFT JOIN memberships mem ON mem.user_id = m.sender_id AND mem.campaign_id = (
      SELECT campaign_id FROM support_tickets WHERE id = $1
    ) AND mem.is_active = true
    WHERE m.ticket_id = $1 ${internalFilter}
    ORDER BY m.created_at ASC
  `, [ticketId])
  return rows.map(rowToMessage)
}

export async function createMessage(data: {
  ticketId: string
  senderId: string
  content: string
  isInternalNote: boolean
  aiSuggested?: boolean
}): Promise<SupportTicketMessage> {
  const pool = getPool()
  const id = crypto.randomUUID()

  const { rows } = await pool.query(`
    INSERT INTO support_ticket_messages (id, ticket_id, sender_id, content, is_internal_note, ai_suggested)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [id, data.ticketId, data.senderId, data.content, data.isInternalNote, data.aiSuggested || false])

  // Update ticket updated_at
  await pool.query(
    'UPDATE support_tickets SET updated_at = NOW() WHERE id = $1',
    [data.ticketId],
  )

  // Log message event
  await pool.query(`
    INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, new_value)
    VALUES ($1, $2, $3, 'message_sent', $4)
  `, [crypto.randomUUID(), data.ticketId, data.senderId, data.isInternalNote ? 'internal_note' : 'reply'])

  return rowToMessage(rows[0])
}

// ── Ticket Events ───────────────────────────────────────────────

export async function listEvents(ticketId: string): Promise<SupportTicketEvent[]> {
  const pool = getPool()
  const { rows } = await pool.query(`
    SELECT e.*, u.name as actor_name
    FROM support_ticket_events e
    LEFT JOIN users u ON u.id = e.actor_id
    WHERE e.ticket_id = $1
    ORDER BY e.created_at ASC
  `, [ticketId])
  return rows.map(rowToEvent)
}

// ── Stats ───────────────────────────────────────────────────────

export async function getTicketStats(campaignId: string): Promise<{
  open: number
  inProgress: number
  resolved: number
  total: number
}> {
  const pool = getPool()
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'open') as open,
      COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) as total
    FROM support_tickets
    WHERE campaign_id = $1
  `, [campaignId])

  const r = rows[0]
  return {
    open: parseInt(r.open) || 0,
    inProgress: parseInt(r.in_progress) || 0,
    resolved: parseInt(r.resolved) || 0,
    total: parseInt(r.total) || 0,
  }
}
