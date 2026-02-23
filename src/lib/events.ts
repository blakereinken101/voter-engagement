import { getPool } from '@/lib/db'
import { getSessionFromRequest, SessionPayload, AuthError } from '@/lib/auth'
import type { ProductSubscription, PlanLimits, EventsPlan } from '@/types/events'
import { PLAN_LIMITS } from '@/types/events'

// ── Event Context (like getRequestContext but for events product) ───

export interface EventsContext {
  userId: string
  email: string
  organizationId: string
  subscription: ProductSubscription
  isPlatformAdmin: boolean
}

/**
 * Get events context for the current user.
 * Requires: logged in + belongs to an org with active events subscription.
 * Use for event creation/management endpoints.
 */
export async function getEventsContext(): Promise<EventsContext> {
  const session = getSessionFromRequest()
  if (!session) throw new AuthError('Not authenticated', 401)

  const pool = getPool()

  // Look up user's platform admin status
  const { rows: userRows } = await pool.query(
    'SELECT is_platform_admin FROM users WHERE id = $1',
    [session.userId]
  )
  if (userRows.length === 0) throw new AuthError('User not found', 401)
  const isPlatformAdmin = !!userRows[0].is_platform_admin

  // Find the user's organization via their memberships → campaigns → org
  const { rows: orgRows } = await pool.query(`
    SELECT DISTINCT o.id as org_id
    FROM memberships m
    JOIN campaigns c ON c.id = m.campaign_id
    JOIN organizations o ON o.id = c.org_id
    WHERE m.user_id = $1 AND m.is_active = true
    LIMIT 1
  `, [session.userId])

  if (orgRows.length === 0 && !isPlatformAdmin) {
    throw new AuthError('Not a member of any organization', 403)
  }

  // Platform admin without org membership — use default org
  const orgId = orgRows.length > 0 ? orgRows[0].org_id as string : 'org-default'

  // Check events subscription
  const subscription = await getEventsSubscription(orgId)
  if (!subscription && !isPlatformAdmin) {
    throw new AuthError('No active events subscription', 403)
  }

  return {
    userId: session.userId,
    email: session.email,
    organizationId: orgId,
    subscription: subscription || {
      id: 'platform-admin-override',
      organizationId: orgId,
      product: 'events',
      plan: 'scale',
      status: 'active',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      limits: PLAN_LIMITS.scale,
      createdAt: new Date().toISOString(),
    },
    isPlatformAdmin,
  }
}

// ── Subscription Helpers ────────────────────────────────────────────

/**
 * Get active events subscription for an organization. Returns null if none.
 */
export async function getEventsSubscription(orgId: string): Promise<ProductSubscription | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT * FROM product_subscriptions
     WHERE organization_id = $1 AND product = 'events' AND status IN ('active', 'trialing')`,
    [orgId]
  )
  if (rows.length === 0) return null

  const row = rows[0]

  // Check if trial has expired
  if (row.status === 'trialing' && row.current_period_end && new Date(row.current_period_end) < new Date()) {
    return null
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    product: row.product,
    plan: row.plan,
    status: row.status,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    limits: row.limits || PLAN_LIMITS[row.plan as EventsPlan] || PLAN_LIMITS.grassroots,
    createdAt: row.created_at,
  }
}

/**
 * Require an active events subscription. Throws if none found.
 */
export async function requireEventsSubscription(orgId: string): Promise<ProductSubscription> {
  const sub = await getEventsSubscription(orgId)
  if (!sub) throw new AuthError('No active events subscription. Visit /events/pricing to subscribe.', 403)
  return sub
}

/**
 * Check if the org has exceeded their monthly RSVP limit.
 */
export async function checkRsvpLimit(orgId: string, subscription: ProductSubscription): Promise<void> {
  const limits = subscription.limits
  if (limits.maxRsvpsPerMonth === -1) return // unlimited

  const pool = getPool()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(er.guest_count), 0) as total_rsvps
    FROM event_rsvps er
    JOIN events e ON e.id = er.event_id
    WHERE e.organization_id = $1
      AND er.status = 'going'
      AND er.created_at >= $2
  `, [orgId, monthStart.toISOString()])

  const totalRsvps = parseInt(rows[0].total_rsvps, 10)
  if (totalRsvps >= limits.maxRsvpsPerMonth) {
    throw new AuthError(
      `Monthly RSVP limit reached (${limits.maxRsvpsPerMonth}). Upgrade your plan for more capacity.`,
      429
    )
  }
}

/**
 * Check if the org has exceeded their team member limit.
 */
export async function checkTeamLimit(orgId: string, subscription: ProductSubscription): Promise<void> {
  const limits = subscription.limits
  if (limits.maxTeamMembers === -1) return // unlimited

  const pool = getPool()
  // Count distinct users who have created events for this org
  const { rows } = await pool.query(`
    SELECT COUNT(DISTINCT created_by) as team_count
    FROM events
    WHERE organization_id = $1
  `, [orgId])

  const teamCount = parseInt(rows[0].team_count, 10)
  if (teamCount >= limits.maxTeamMembers) {
    throw new AuthError(
      `Team member limit reached (${limits.maxTeamMembers}). Upgrade your plan for more team members.`,
      429
    )
  }
}

// ── Slug Generation ─────────────────────────────────────────────────

/**
 * Generate a URL-friendly slug from a title.
 * Appends a short random suffix for uniqueness.
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)

  const suffix = crypto.randomUUID().slice(0, 6)
  return `${base}-${suffix}`
}

// ── Visibility & Authorization ──────────────────────────────────────

/**
 * Check if a user can view an event based on its visibility.
 */
export async function canViewEvent(
  event: { visibility: string; organization_id: string },
  session: SessionPayload | null
): Promise<boolean> {
  if (event.visibility === 'public') return true
  if (event.visibility === 'invite_only') return true // has the link = can view
  if (!session) return false

  // 'org' visibility: check org membership via campaigns → memberships
  const pool = getPool()
  const { rows } = await pool.query(`
    SELECT m.id FROM memberships m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE m.user_id = $1 AND c.org_id = $2 AND m.is_active = true
    LIMIT 1
  `, [session.userId, event.organization_id])

  return rows.length > 0
}

/**
 * Check if a user can manage (edit/delete) an event.
 * Creator of the event, or an admin of the organization.
 */
export async function canManageEvent(
  event: { created_by: string; organization_id: string },
  session: SessionPayload
): Promise<boolean> {
  // Creator can always manage
  if (event.created_by === session.userId) return true

  const pool = getPool()

  // Check platform admin
  const { rows: userRows } = await pool.query(
    'SELECT is_platform_admin FROM users WHERE id = $1',
    [session.userId]
  )
  if (userRows.length > 0 && userRows[0].is_platform_admin) return true

  // Check org admin (via campaign admin role)
  const { rows } = await pool.query(`
    SELECT m.role FROM memberships m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE m.user_id = $1 AND c.org_id = $2 AND m.is_active = true
      AND m.role IN ('platform_admin', 'org_owner', 'campaign_admin')
    LIMIT 1
  `, [session.userId, event.organization_id])

  return rows.length > 0
}

// ── DB Row to Client Type Mappers ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapEventRow(row: any) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    locationName: row.location_name,
    locationAddress: row.location_address,
    locationCity: row.location_city,
    locationState: row.location_state,
    locationZip: row.location_zip,
    isVirtual: row.is_virtual,
    virtualUrl: row.virtual_url,
    coverImageUrl: row.cover_image_url,
    emoji: row.emoji,
    themeColor: row.theme_color,
    visibility: row.visibility,
    maxAttendees: row.max_attendees,
    rsvpEnabled: row.rsvp_enabled,
    status: row.status,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creatorName: row.creator_name || undefined,
    organizationName: row.org_name || undefined,
    rsvpCounts: row.going_count !== undefined ? {
      going: parseInt(row.going_count, 10) || 0,
      maybe: parseInt(row.maybe_count, 10) || 0,
      notGoing: parseInt(row.not_going_count, 10) || 0,
    } : undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRsvpRow(row: any) {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    status: row.status,
    guestCount: row.guest_count,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: row.user_name || row.guest_name || undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCommentRow(row: any) {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    parentId: row.parent_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: row.user_name || undefined,
  }
}
