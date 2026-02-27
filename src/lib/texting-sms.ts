import { sendSms } from '@/lib/sms'
import { getPool } from '@/lib/db'
import { normalizeToE164, isOptOutMessage, interpolateScript, mapContactRow } from '@/lib/texting'
import type { TextCampaignContact } from '@/types/texting'

/**
 * Send a single campaign text message.
 * Handles: opt-out checks, message recording, status updates.
 */
export async function sendTextCampaignMessage(
  contactId: string,
  campaignId: string,
  senderId: string,
  body: string,
  organizationId: string,
): Promise<{ success: boolean; messageId: string }> {
  const pool = getPool()
  const messageId = crypto.randomUUID()

  // Verify contact is not opted out
  const { rows: contactRows } = await pool.query(
    'SELECT * FROM text_campaign_contacts WHERE id = $1 AND text_campaign_id = $2',
    [contactId, campaignId]
  )
  if (contactRows.length === 0) {
    throw new Error('Contact not found')
  }
  const contact = mapContactRow(contactRows[0])

  if (contact.status === 'opted_out') {
    throw new Error('Contact has opted out')
  }

  // Check org-level opt-outs
  const normalized = normalizeToE164(contact.cell)
  if (!normalized) {
    throw new Error('Invalid phone number')
  }

  const { rows: optOutRows } = await pool.query(
    'SELECT 1 FROM text_opt_outs WHERE organization_id = $1 AND phone = $2',
    [organizationId, normalized]
  )
  if (optOutRows.length > 0) {
    await pool.query(
      `UPDATE text_campaign_contacts SET status = 'opted_out' WHERE id = $1`,
      [contactId]
    )
    throw new Error('Contact phone is on opt-out list')
  }

  // Create the message record
  await pool.query(
    `INSERT INTO text_messages (id, text_campaign_id, contact_id, sender_id, direction, body, status)
     VALUES ($1, $2, $3, $4, 'outbound', $5, 'queued')`,
    [messageId, campaignId, contactId, senderId, body]
  )

  // Send via Twilio
  const sent = await sendSms(normalized, body)

  if (sent) {
    await pool.query(
      `UPDATE text_messages SET status = 'sent' WHERE id = $1`,
      [messageId]
    )
    await pool.query(
      `UPDATE text_campaign_contacts SET status = 'sent', sent_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [contactId]
    )
  } else {
    await pool.query(
      `UPDATE text_messages SET status = 'failed' WHERE id = $1`,
      [messageId]
    )
    await pool.query(
      `UPDATE text_campaign_contacts SET status = 'error' WHERE id = $1 AND status = 'pending'`,
      [contactId]
    )
  }

  return { success: sent, messageId }
}

/**
 * Send reply to a contact in a campaign.
 */
export async function sendTextCampaignReply(
  contactId: string,
  campaignId: string,
  senderId: string,
  body: string,
  organizationId: string,
): Promise<{ success: boolean; messageId: string }> {
  const pool = getPool()
  const messageId = crypto.randomUUID()

  const { rows: contactRows } = await pool.query(
    'SELECT * FROM text_campaign_contacts WHERE id = $1 AND text_campaign_id = $2',
    [contactId, campaignId]
  )
  if (contactRows.length === 0) throw new Error('Contact not found')
  const contact = mapContactRow(contactRows[0])

  if (contact.status === 'opted_out') throw new Error('Contact has opted out')

  const normalized = normalizeToE164(contact.cell)
  if (!normalized) throw new Error('Invalid phone number')

  // Create message record
  await pool.query(
    `INSERT INTO text_messages (id, text_campaign_id, contact_id, sender_id, direction, body, status)
     VALUES ($1, $2, $3, $4, 'outbound', $5, 'queued')`,
    [messageId, campaignId, contactId, senderId, body]
  )

  const sent = await sendSms(normalized, body)

  await pool.query(
    `UPDATE text_messages SET status = $1 WHERE id = $2`,
    [sent ? 'sent' : 'failed', messageId]
  )

  return { success: sent, messageId }
}

/**
 * Handle an inbound SMS message from Twilio webhook.
 */
export async function handleInboundMessage(
  fromPhone: string,
  body: string,
  twilioSid: string,
): Promise<{ handled: boolean; optedOut?: boolean }> {
  const pool = getPool()

  const normalized = normalizeToE164(fromPhone)
  if (!normalized) return { handled: false }

  // Find the most recent contact with this phone across all active campaigns
  const { rows: contactRows } = await pool.query(`
    SELECT tcc.*, tc.organization_id
    FROM text_campaign_contacts tcc
    JOIN text_campaigns tc ON tc.id = tcc.text_campaign_id
    WHERE tcc.cell = $1 AND tc.status = 'active'
    ORDER BY tcc.sent_at DESC NULLS LAST
    LIMIT 1
  `, [normalized])

  if (contactRows.length === 0) return { handled: false }

  const contact = contactRows[0]
  const contactId = contact.id as string
  const campaignId = contact.text_campaign_id as string
  const orgId = contact.organization_id as string

  // Check for opt-out
  if (isOptOutMessage(body)) {
    // Add to opt-out list
    await pool.query(
      `INSERT INTO text_opt_outs (id, organization_id, phone, reason, source)
       VALUES ($1, $2, $3, 'Replied STOP', 'auto')
       ON CONFLICT (organization_id, phone) DO NOTHING`,
      [crypto.randomUUID(), orgId, normalized]
    )
    // Mark contact as opted out
    await pool.query(
      `UPDATE text_campaign_contacts SET status = 'opted_out' WHERE id = $1`,
      [contactId]
    )
    // Record the inbound message
    await pool.query(
      `INSERT INTO text_messages (id, text_campaign_id, contact_id, direction, body, status, twilio_sid)
       VALUES ($1, $2, $3, 'inbound', $4, 'received', $5)`,
      [crypto.randomUUID(), campaignId, contactId, body, twilioSid]
    )
    return { handled: true, optedOut: true }
  }

  // Record inbound message
  await pool.query(
    `INSERT INTO text_messages (id, text_campaign_id, contact_id, direction, body, status, twilio_sid)
     VALUES ($1, $2, $3, 'inbound', $4, 'received', $5)`,
    [crypto.randomUUID(), campaignId, contactId, body, twilioSid]
  )

  // Update contact status to 'replied'
  await pool.query(
    `UPDATE text_campaign_contacts SET status = 'replied' WHERE id = $1 AND status != 'opted_out'`,
    [contactId]
  )

  return { handled: true }
}

/**
 * Blast send: auto-send initial messages to all pending contacts in a campaign.
 */
export async function sendBlastMessages(
  campaignId: string,
  organizationId: string,
  senderId: string,
  batchSize: number = 50,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const pool = getPool()
  let sent = 0
  let failed = 0
  let skipped = 0

  // Get the initial script
  const { rows: scriptRows } = await pool.query(
    `SELECT * FROM text_campaign_scripts
     WHERE text_campaign_id = $1 AND script_type = 'initial' AND is_active = true
     ORDER BY sort_order ASC`,
    [campaignId]
  )
  if (scriptRows.length === 0) throw new Error('No initial script configured')

  // Get pending contacts in batch
  const { rows: contactRows } = await pool.query(
    `SELECT * FROM text_campaign_contacts
     WHERE text_campaign_id = $1 AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT $2`,
    [campaignId, batchSize]
  )

  for (const row of contactRows) {
    const contact = mapContactRow(row) as TextCampaignContact

    // Rotate through scripts
    const scriptIndex = (sent + failed + skipped) % scriptRows.length
    const script = scriptRows[scriptIndex]
    const messageBody = interpolateScript(script.body, contact)

    try {
      const result = await sendTextCampaignMessage(
        contact.id,
        campaignId,
        senderId,
        messageBody,
        organizationId,
      )
      if (result.success) {
        sent++
      } else {
        failed++
      }
    } catch {
      skipped++
    }
  }

  return { sent, failed, skipped }
}
