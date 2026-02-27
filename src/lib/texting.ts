import { getPool } from '@/lib/db'
import { getSessionFromRequest, AuthError } from '@/lib/auth'
import type {
  TextCampaign,
  TextCampaignContact,
  TextMessage,
  TextCampaignScript,
  TextCampaignSettings,
  TextCampaignMember,
  TextCampaignTag,
  TextContactNote,
  TextOptOut,
} from '@/types/texting'

// ── Texting Context ──────────────────────────────────────────────────

export interface TextingContext {
  userId: string
  email: string
  organizationId: string
  isPlatformAdmin: boolean
}

/**
 * Get texting context for the current user.
 * Requires: logged in + has texting product access + belongs to an org.
 */
export async function getTextingContext(): Promise<TextingContext> {
  const session = getSessionFromRequest()
  if (!session) throw new AuthError('Not authenticated', 401)

  const pool = getPool()

  const { rows: userRows } = await pool.query(
    'SELECT is_platform_admin FROM users WHERE id = $1',
    [session.userId]
  )
  if (userRows.length === 0) throw new AuthError('User not found', 401)
  const isPlatformAdmin = !!userRows[0].is_platform_admin

  // Verify texting product access
  if (!isPlatformAdmin) {
    const { rows: productRows } = await pool.query(
      `SELECT 1 FROM user_products WHERE user_id = $1 AND product = 'texting' AND is_active = true`,
      [session.userId]
    )
    if (productRows.length === 0) {
      throw new AuthError('No access to texting product', 403)
    }
  }

  // Find user's org — first by created_by, then via membership chain
  const { rows: createdOrgRows } = await pool.query(
    `SELECT id as org_id FROM organizations WHERE created_by = $1 LIMIT 1`,
    [session.userId]
  )

  let orgId: string
  if (createdOrgRows.length > 0) {
    orgId = createdOrgRows[0].org_id as string
  } else {
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

    orgId = orgRows.length > 0 ? orgRows[0].org_id as string : 'org-default'
  }

  return {
    userId: session.userId,
    email: session.email,
    organizationId: orgId,
    isPlatformAdmin,
  }
}

// ── Authorization helpers ────────────────────────────────────────────

export async function requireTextCampaignAdmin(
  campaignId: string,
  userId: string,
  isPlatformAdmin: boolean,
): Promise<void> {
  if (isPlatformAdmin) return

  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT role FROM text_campaign_members
     WHERE text_campaign_id = $1 AND user_id = $2 AND is_active = true`,
    [campaignId, userId]
  )

  if (rows.length === 0 || rows[0].role !== 'admin') {
    // Also check if they created the campaign
    const { rows: campaignRows } = await pool.query(
      'SELECT created_by FROM text_campaigns WHERE id = $1',
      [campaignId]
    )
    if (campaignRows.length === 0 || campaignRows[0].created_by !== userId) {
      throw new AuthError('Not an admin of this text campaign', 403)
    }
  }
}

export async function requireTextCampaignMember(
  campaignId: string,
  userId: string,
  isPlatformAdmin: boolean,
): Promise<void> {
  if (isPlatformAdmin) return

  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT 1 FROM text_campaign_members
     WHERE text_campaign_id = $1 AND user_id = $2 AND is_active = true`,
    [campaignId, userId]
  )

  if (rows.length === 0) {
    // Also check if they created the campaign
    const { rows: campaignRows } = await pool.query(
      'SELECT created_by FROM text_campaigns WHERE id = $1',
      [campaignId]
    )
    if (campaignRows.length === 0 || campaignRows[0].created_by !== userId) {
      throw new AuthError('Not a member of this text campaign', 403)
    }
  }
}

// ── Variable interpolation ───────────────────────────────────────────

export function interpolateScript(
  body: string,
  contact: Pick<TextCampaignContact, 'firstName' | 'lastName' | 'customFields'>,
): string {
  let result = body
    .replace(/\{firstName\}/g, contact.firstName)
    .replace(/\{lastName\}/g, contact.lastName)
    .replace(/\{fullName\}/g, `${contact.firstName} ${contact.lastName}`)

  // Replace custom field placeholders
  if (contact.customFields) {
    for (const [key, value] of Object.entries(contact.customFields)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '')
    }
  }

  return result
}

// ── Phone validation ─────────────────────────────────────────────────

export function normalizeToE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (phone.startsWith('+') && digits.length >= 10) return `+${digits}`
  return null // Invalid
}

// ── Opt-out detection ────────────────────────────────────────────────

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit', 'optout', 'opt out']

export function isOptOutMessage(body: string): boolean {
  const normalized = body.trim().toLowerCase()
  return OPT_OUT_KEYWORDS.some(kw => normalized === kw || normalized === kw + '.')
}

// ── Row mappers ──────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapCampaignRow(row: any): TextCampaign {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description,
    status: row.status,
    sendingMode: row.sending_mode,
    textingHoursStart: row.texting_hours_start,
    textingHoursEnd: row.texting_hours_end,
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
    contactCount: row.contact_count != null ? parseInt(row.contact_count, 10) : undefined,
    sentCount: row.sent_count != null ? parseInt(row.sent_count, 10) : undefined,
    repliedCount: row.replied_count != null ? parseInt(row.replied_count, 10) : undefined,
    optedOutCount: row.opted_out_count != null ? parseInt(row.opted_out_count, 10) : undefined,
  }
}

export function mapContactRow(row: any): TextCampaignContact {
  return {
    id: row.id,
    textCampaignId: row.text_campaign_id,
    firstName: row.first_name,
    lastName: row.last_name,
    cell: row.cell,
    customFields: row.custom_fields || {},
    status: row.status,
    assignedTo: row.assigned_to,
    sentAt: row.sent_at?.toISOString?.() || row.sent_at,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }
}

export function mapMessageRow(row: any): TextMessage {
  return {
    id: row.id,
    textCampaignId: row.text_campaign_id,
    contactId: row.contact_id,
    senderId: row.sender_id,
    direction: row.direction,
    body: row.body,
    status: row.status,
    twilioSid: row.twilio_sid,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }
}

export function mapScriptRow(row: any): TextCampaignScript {
  return {
    id: row.id,
    textCampaignId: row.text_campaign_id,
    scriptType: row.script_type,
    title: row.title,
    body: row.body,
    sortOrder: row.sort_order,
    tags: row.tags || [],
    isActive: row.is_active,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }
}

export function mapSettingsRow(row: any): TextCampaignSettings {
  return {
    id: row.id,
    textCampaignId: row.text_campaign_id,
    dynamicAssignmentInitials: row.dynamic_assignment_initials,
    dynamicAssignmentReplies: row.dynamic_assignment_replies,
    initialBatchSize: row.initial_batch_size,
    replyBatchSize: row.reply_batch_size,
    enableContactNotes: row.enable_contact_notes,
    enableManualTags: row.enable_manual_tags,
    initialJoinToken: row.initial_join_token,
    replyJoinToken: row.reply_join_token,
  }
}

export function mapMemberRow(row: any): TextCampaignMember {
  return {
    id: row.id,
    textCampaignId: row.text_campaign_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at?.toISOString?.() || row.joined_at,
    isActive: row.is_active,
    userName: row.user_name || row.name,
    userEmail: row.user_email || row.email,
  }
}

export function mapTagRow(row: any): TextCampaignTag {
  return {
    id: row.id,
    textCampaignId: row.text_campaign_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }
}

export function mapNoteRow(row: any): TextContactNote {
  return {
    id: row.id,
    contactId: row.contact_id,
    userId: row.user_id,
    note: row.note,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    userName: row.user_name || row.name,
  }
}

export function mapOptOutRow(row: any): TextOptOut {
  return {
    id: row.id,
    organizationId: row.organization_id,
    phone: row.phone,
    reason: row.reason,
    source: row.source,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
