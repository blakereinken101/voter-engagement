import { getPool } from '@/lib/db'
import { isVanEnabled, vanFetch, logVanSync } from '@/lib/van-client'

/**
 * Fire-and-forget wrapper. Catches all errors so VAN failures
 * never affect the primary request.
 */
export function fireAndForget(fn: () => Promise<void>, label: string): void {
  fn().catch(err => {
    console.error(`[van-sync] ${label} failed:`, err)
  })
}

// ── Contact → VAN /people/findOrCreate ──────────────────────────

export async function syncContactToVan(campaignId: string, contactId: string): Promise<void> {
  if (!(await isVanEnabled(campaignId))) return

  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT first_name, last_name, phone, address, city, zip, van_id FROM contacts WHERE id = $1',
    [contactId],
  )
  if (!rows[0] || rows[0].van_id) return // already synced or not found

  const contact = rows[0]

  // Look up campaign state for address
  const { rows: campRows } = await pool.query('SELECT state FROM campaigns WHERE id = $1', [campaignId])
  const state = campRows[0]?.state || 'NC'

  const payload: Record<string, unknown> = {
    firstName: contact.first_name,
    lastName: contact.last_name,
  }

  if (contact.phone) {
    payload.phones = [{ phoneNumber: contact.phone, phoneType: 'Cell' }]
  }
  if (contact.address) {
    payload.addresses = [{
      addressLine1: contact.address,
      city: contact.city || undefined,
      stateOrProvince: state,
      zipOrPostalCode: contact.zip || undefined,
      type: 'Voting',
    }]
  }

  const endpoint = '/people/findOrCreate'
  try {
    const { status, data } = await vanFetch(campaignId, 'POST', endpoint, payload)
    const vanId = (data as Record<string, unknown>)?.vanId as number | undefined

    if (status >= 200 && status < 300 && vanId) {
      await pool.query('UPDATE contacts SET van_id = $1 WHERE id = $2', [vanId, contactId])
      await logVanSync({ campaignId, entityType: 'contact', entityId: contactId, vanEndpoint: endpoint, syncStatus: 'success', vanId })
    } else {
      await logVanSync({ campaignId, entityType: 'contact', entityId: contactId, vanEndpoint: endpoint, syncStatus: 'failed', errorMessage: `HTTP ${status}: ${JSON.stringify(data)}` })
    }
  } catch (err) {
    await logVanSync({ campaignId, entityType: 'contact', entityId: contactId, vanEndpoint: endpoint, syncStatus: 'failed', errorMessage: (err as Error).message })
  }
}

// ── Canvass Response → VAN /people/{vanId}/canvassResponses ─────

// Map app outreach methods to VAN contact type names
const CONTACT_TYPE_MAP: Record<string, string> = {
  call: 'Phone',
  text: 'SMS Text',
  'one-on-one': 'Walk',
}

// Map app outcomes to VAN result code names
const RESULT_CODE_MAP: Record<string, string> = {
  supporter: 'Canvassed',
  undecided: 'Canvassed',
  opposed: 'Canvassed',
  'left-message': 'Left Message',
  'no-answer': 'No Answer',
}

export async function syncCanvassResponseToVan(
  campaignId: string,
  contactId: string,
  outcome: string | null,
  method: string | null,
): Promise<void> {
  if (!(await isVanEnabled(campaignId))) return
  if (!outcome) return

  const pool = getPool()
  const { rows } = await pool.query('SELECT van_id FROM contacts WHERE id = $1', [contactId])
  const vanId = rows[0]?.van_id
  if (!vanId) return // contact not yet synced to VAN

  // Fetch VAN reference data for this campaign to get correct IDs
  let contactTypeId: number | undefined
  let resultCodeId: number | undefined

  try {
    if (method && CONTACT_TYPE_MAP[method]) {
      const { data } = await vanFetch(campaignId, 'GET', '/canvassResponses/contactTypes')
      const types = Array.isArray(data) ? data : []
      const match = types.find((t: Record<string, unknown>) =>
        (t.name as string)?.toLowerCase() === CONTACT_TYPE_MAP[method].toLowerCase()
      )
      contactTypeId = match?.contactTypeId as number | undefined
    }

    if (RESULT_CODE_MAP[outcome]) {
      const { data } = await vanFetch(campaignId, 'GET', '/canvassResponses/resultCodes')
      const codes = Array.isArray(data) ? data : []
      const match = codes.find((c: Record<string, unknown>) =>
        (c.name as string)?.toLowerCase() === RESULT_CODE_MAP[outcome].toLowerCase()
      )
      resultCodeId = match?.resultCodeId as number | undefined
    }
  } catch {
    // If reference data fetch fails, proceed with what we have
  }

  const endpoint = `/people/${vanId}/canvassResponses`
  const payload: Record<string, unknown> = {
    canvassContext: {
      contactTypeId: contactTypeId || 1, // fallback to Phone
      inputTypeId: 11, // API
      dateCanvassed: new Date().toISOString().split('T')[0],
    },
  }
  if (resultCodeId) {
    payload.resultCodeId = resultCodeId
  }

  try {
    const { status, data } = await vanFetch(campaignId, 'POST', endpoint, payload)
    if (status >= 200 && status < 300) {
      await logVanSync({ campaignId, entityType: 'canvass_response', entityId: contactId, vanEndpoint: endpoint, syncStatus: 'success', vanId })
    } else {
      await logVanSync({ campaignId, entityType: 'canvass_response', entityId: contactId, vanEndpoint: endpoint, syncStatus: 'failed', errorMessage: `HTTP ${status}: ${JSON.stringify(data)}` })
    }
  } catch (err) {
    await logVanSync({ campaignId, entityType: 'canvass_response', entityId: contactId, vanEndpoint: endpoint, syncStatus: 'failed', errorMessage: (err as Error).message })
  }
}

// ── Event → VAN /events ─────────────────────────────────────────

export async function syncEventToVan(campaignId: string, eventId: string): Promise<void> {
  if (!(await isVanEnabled(campaignId))) return

  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id, title, description, event_type, start_time, end_time, location_name, location_address, location_city, location_state, location_zip, van_event_id FROM events WHERE id = $1',
    [eventId],
  )
  if (!rows[0] || rows[0].van_event_id) return // already synced or not found

  const event = rows[0]
  const startDate = new Date(event.start_time).toISOString()
  const endDate = event.end_time ? new Date(event.end_time).toISOString() : startDate

  const endpoint = '/events'
  const payload = {
    name: event.title,
    shortName: event.title.slice(0, 50),
    description: event.description || '',
    startDate,
    endDate,
    shifts: [{
      name: 'Default',
      startTime: startDate,
      endTime: endDate,
    }],
  }

  try {
    const { status, data } = await vanFetch(campaignId, 'POST', endpoint, payload)
    const vanEventId = (data as Record<string, unknown>)?.eventId as number | undefined

    if (status >= 200 && status < 300 && vanEventId) {
      await pool.query('UPDATE events SET van_event_id = $1 WHERE id = $2', [vanEventId, eventId])
      await logVanSync({ campaignId, entityType: 'event', entityId: eventId, vanEndpoint: endpoint, syncStatus: 'success', vanId: vanEventId })
    } else {
      await logVanSync({ campaignId, entityType: 'event', entityId: eventId, vanEndpoint: endpoint, syncStatus: 'failed', errorMessage: `HTTP ${status}: ${JSON.stringify(data)}` })
    }
  } catch (err) {
    await logVanSync({ campaignId, entityType: 'event', entityId: eventId, vanEndpoint: endpoint, syncStatus: 'failed', errorMessage: (err as Error).message })
  }
}

// ── RSVP → VAN /signups ─────────────────────────────────────────

export async function syncSignupToVan(campaignId: string, eventId: string, rsvpId: string): Promise<void> {
  if (!(await isVanEnabled(campaignId))) return

  const pool = getPool()

  // Need the VAN event ID and the RSVP user's VAN person ID
  const { rows: eventRows } = await pool.query('SELECT van_event_id FROM events WHERE id = $1', [eventId])
  const vanEventId = eventRows[0]?.van_event_id
  if (!vanEventId) return // event not synced to VAN

  const { rows: rsvpRows } = await pool.query('SELECT user_id, status FROM event_rsvps WHERE id = $1', [rsvpId])
  const rsvp = rsvpRows[0]
  if (!rsvp?.user_id) return // guest RSVP, can't link to VAN

  // Find the user's contact with a van_id in this campaign
  const { rows: contactRows } = await pool.query(
    'SELECT van_id FROM contacts WHERE user_id = $1 AND campaign_id = $2 AND van_id IS NOT NULL LIMIT 1',
    [rsvp.user_id, campaignId],
  )
  const vanPersonId = contactRows[0]?.van_id
  if (!vanPersonId) return // user has no VAN-linked contact

  const endpoint = '/signups'
  const statusMap: Record<string, number> = { going: 2, maybe: 11 } // Scheduled, Invited
  const payload = {
    event: { eventId: vanEventId },
    person: { vanId: vanPersonId },
    status: { statusId: statusMap[rsvp.status] || 2 },
  }

  try {
    const { status, data } = await vanFetch(campaignId, 'POST', endpoint, payload)
    if (status >= 200 && status < 300) {
      await logVanSync({ campaignId, entityType: 'signup', entityId: rsvpId, vanEndpoint: endpoint, syncStatus: 'success', vanId: vanPersonId })
    } else {
      await logVanSync({ campaignId, entityType: 'signup', entityId: rsvpId, vanEndpoint: endpoint, syncStatus: 'failed', errorMessage: `HTTP ${status}: ${JSON.stringify(data)}` })
    }
  } catch (err) {
    await logVanSync({ campaignId, entityType: 'signup', entityId: rsvpId, vanEndpoint: endpoint, syncStatus: 'failed', errorMessage: (err as Error).message })
  }
}

// ── Helper: find VAN-enabled campaign for an organization ───────

export async function findVanCampaignForOrg(organizationId: string): Promise<string | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id, settings FROM campaigns WHERE org_id = $1`,
    [organizationId],
  )
  for (const row of rows) {
    if (row.settings?.vanConfig?.enabled && row.settings?.vanConfig?.apiKey) {
      return row.id
    }
  }
  return null
}
