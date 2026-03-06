import { getPool } from '@/lib/db'
import { isPdiEnabled, pdiFetch, logPdiSync } from '@/lib/pdi-client'

// ── Contact → PDI POST /contacts ────────────────────────────────

export async function syncContactToPdi(campaignId: string, contactId: string): Promise<void> {
  if (!(await isPdiEnabled(campaignId))) return

  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT first_name, last_name, phone, address, city, zip, pdi_id FROM contacts WHERE id = $1',
    [contactId],
  )
  if (!rows[0] || rows[0].pdi_id) return // already synced or not found

  const contact = rows[0]

  const { rows: campRows } = await pool.query('SELECT state FROM campaigns WHERE id = $1', [campaignId])
  const state = campRows[0]?.state
  if (!state) {
    console.warn('[pdi-sync] Campaign has no state set, skipping sync')
    return
  }

  const payload: Record<string, unknown> = {
    FirstName: contact.first_name,
    LastName: contact.last_name,
  }

  const endpoint = '/contacts'
  try {
    const { status, data } = await pdiFetch(campaignId, 'POST', endpoint, payload)
    const pdiId = (data as Record<string, unknown>)?.Id as number | undefined

    if (status >= 200 && status < 300 && pdiId) {
      // Add phone and address as sub-resources
      if (contact.phone) {
        try {
          await pdiFetch(campaignId, 'POST', `/contacts/${pdiId}/phones`, {
            PhoneNumber: contact.phone,
            PhoneType: 'Cell',
          })
        } catch { /* non-critical */ }
      }
      if (contact.address) {
        try {
          await pdiFetch(campaignId, 'POST', `/contacts/${pdiId}/addresses`, {
            AddressLine1: contact.address,
            City: contact.city || undefined,
            State: state,
            Zip: contact.zip || undefined,
          })
        } catch { /* non-critical */ }
      }

      await pool.query('UPDATE contacts SET pdi_id = $1 WHERE id = $2', [pdiId, contactId])
      await logPdiSync({ campaignId, entityType: 'contact', entityId: contactId, pdiEndpoint: endpoint, syncStatus: 'success', pdiId })
    } else {
      await logPdiSync({ campaignId, entityType: 'contact', entityId: contactId, pdiEndpoint: endpoint, syncStatus: 'failed', errorMessage: `HTTP ${status}: ${JSON.stringify(data)}` })
    }
  } catch (err) {
    await logPdiSync({ campaignId, entityType: 'contact', entityId: contactId, pdiEndpoint: endpoint, syncStatus: 'failed', errorMessage: (err as Error).message })
  }
}

// ── Canvass Response → PDI POST /communications ─────────────────

export async function syncCanvassResponseToPdi(
  campaignId: string,
  contactId: string,
  outcome: string | null,
  method: string | null,
): Promise<void> {
  if (!(await isPdiEnabled(campaignId))) return
  if (!outcome) return

  const pool = getPool()
  const { rows } = await pool.query('SELECT pdi_id FROM contacts WHERE id = $1', [contactId])
  const pdiId = rows[0]?.pdi_id
  if (!pdiId) return // contact not yet synced to PDI

  const endpoint = '/communications'
  const payload = {
    ContactId: pdiId,
    CommunicationType: method === 'call' ? 'Phone' : method === 'text' ? 'SMS' : 'InPerson',
    CommunicationDate: new Date().toISOString(),
    Notes: `Outcome: ${outcome}`,
  }

  try {
    const { status, data } = await pdiFetch(campaignId, 'POST', endpoint, [payload])
    if (status >= 200 && status < 300) {
      await logPdiSync({ campaignId, entityType: 'communication', entityId: contactId, pdiEndpoint: endpoint, syncStatus: 'success', pdiId })
    } else {
      await logPdiSync({ campaignId, entityType: 'communication', entityId: contactId, pdiEndpoint: endpoint, syncStatus: 'failed', errorMessage: `HTTP ${status}: ${JSON.stringify(data)}` })
    }
  } catch (err) {
    await logPdiSync({ campaignId, entityType: 'communication', entityId: contactId, pdiEndpoint: endpoint, syncStatus: 'failed', errorMessage: (err as Error).message })
  }
}

// ── Event → PDI POST /events ────────────────────────────────────

export async function syncEventToPdi(campaignId: string, eventId: string): Promise<void> {
  if (!(await isPdiEnabled(campaignId))) return

  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT id, title, description, event_type, start_time, end_time, location_name, location_address, location_city, location_state, location_zip, pdi_event_id FROM events WHERE id = $1',
    [eventId],
  )
  if (!rows[0] || rows[0].pdi_event_id) return // already synced or not found

  const event = rows[0]
  const startDate = new Date(event.start_time).toISOString()
  const endDate = event.end_time ? new Date(event.end_time).toISOString() : startDate

  // First get available calendars to find one to attach the event to
  let calendarId: number | undefined
  try {
    const { data } = await pdiFetch(campaignId, 'GET', '/calendars')
    const calendars = Array.isArray(data) ? data : []
    calendarId = (calendars[0] as Record<string, unknown>)?.Id as number | undefined
  } catch { /* will try direct event creation */ }

  const endpoint = calendarId ? `/calendars/${calendarId}/events` : '/events'
  const payload = {
    Name: event.title,
    Description: event.description || '',
    StartDate: startDate,
    EndDate: endDate,
  }

  try {
    const { status, data } = await pdiFetch(campaignId, 'POST', endpoint, payload)
    const pdiEventId = (data as Record<string, unknown>)?.Id as number | undefined

    if (status >= 200 && status < 300 && pdiEventId) {
      await pool.query('UPDATE events SET pdi_event_id = $1 WHERE id = $2', [pdiEventId, eventId])
      await logPdiSync({ campaignId, entityType: 'event', entityId: eventId, pdiEndpoint: endpoint, syncStatus: 'success', pdiId: pdiEventId })
    } else {
      await logPdiSync({ campaignId, entityType: 'event', entityId: eventId, pdiEndpoint: endpoint, syncStatus: 'failed', errorMessage: `HTTP ${status}: ${JSON.stringify(data)}` })
    }
  } catch (err) {
    await logPdiSync({ campaignId, entityType: 'event', entityId: eventId, pdiEndpoint: endpoint, syncStatus: 'failed', errorMessage: (err as Error).message })
  }
}

// ── RSVP → PDI POST /events/{eventId}/invitations ───────────────

export async function syncSignupToPdi(campaignId: string, eventId: string, rsvpId: string): Promise<void> {
  if (!(await isPdiEnabled(campaignId))) return

  const pool = getPool()

  const { rows: eventRows } = await pool.query('SELECT pdi_event_id FROM events WHERE id = $1', [eventId])
  const pdiEventId = eventRows[0]?.pdi_event_id
  if (!pdiEventId) return // event not synced to PDI

  const { rows: rsvpRows } = await pool.query('SELECT user_id, status FROM event_rsvps WHERE id = $1', [rsvpId])
  const rsvp = rsvpRows[0]
  if (!rsvp?.user_id) return // guest RSVP, can't link

  const { rows: contactRows } = await pool.query(
    'SELECT pdi_id FROM contacts WHERE user_id = $1 AND campaign_id = $2 AND pdi_id IS NOT NULL LIMIT 1',
    [rsvp.user_id, campaignId],
  )
  const pdiContactId = contactRows[0]?.pdi_id
  if (!pdiContactId) return // user has no PDI-linked contact

  const endpoint = `/events/${pdiEventId}/invitations`
  const payload = {
    ContactId: pdiContactId,
    Status: rsvp.status === 'going' ? 'Accepted' : 'Tentative',
  }

  try {
    const { status, data } = await pdiFetch(campaignId, 'POST', endpoint, payload)
    if (status >= 200 && status < 300) {
      await logPdiSync({ campaignId, entityType: 'invitation', entityId: rsvpId, pdiEndpoint: endpoint, syncStatus: 'success', pdiId: pdiContactId })
    } else {
      await logPdiSync({ campaignId, entityType: 'invitation', entityId: rsvpId, pdiEndpoint: endpoint, syncStatus: 'failed', errorMessage: `HTTP ${status}: ${JSON.stringify(data)}` })
    }
  } catch (err) {
    await logPdiSync({ campaignId, entityType: 'invitation', entityId: rsvpId, pdiEndpoint: endpoint, syncStatus: 'failed', errorMessage: (err as Error).message })
  }
}

// ── Helper: find PDI-enabled campaign for an organization ────────

export async function findPdiCampaignForOrg(organizationId: string): Promise<string | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id, settings FROM campaigns WHERE org_id = $1`,
    [organizationId],
  )
  for (const row of rows) {
    if (row.settings?.pdiConfig?.enabled && row.settings?.pdiConfig?.apiToken) {
      return row.id
    }
  }
  return null
}
