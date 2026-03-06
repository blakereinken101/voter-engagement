import { isVanEnabled } from '@/lib/van-client'
import { syncContactToVan, syncCanvassResponseToVan, syncEventToVan, syncSignupToVan, findVanCampaignForOrg } from '@/lib/van-sync'
import { isPdiEnabled } from '@/lib/pdi-client'
import { syncContactToPdi, syncCanvassResponseToPdi, syncEventToPdi, syncSignupToPdi, findPdiCampaignForOrg } from '@/lib/pdi-sync'

/**
 * Fire-and-forget wrapper. Catches all errors so CRM sync failures
 * never affect the primary request.
 */
export function fireAndForget(fn: () => Promise<void>, label: string): void {
  fn().catch(err => {
    console.error(`[crm-sync] ${label} failed:`, err)
  })
}

// ── Contact sync dispatch ───────────────────────────────────────

export function syncContact(campaignId: string, contactId: string): void {
  fireAndForget(async () => {
    if (await isVanEnabled(campaignId)) await syncContactToVan(campaignId, contactId)
    else if (await isPdiEnabled(campaignId)) await syncContactToPdi(campaignId, contactId)
  }, `crm-contact:${contactId}`)
}

// ── Canvass response sync dispatch ──────────────────────────────

export function syncCanvassResponse(
  campaignId: string,
  contactId: string,
  outcome: string | null,
  method: string | null,
): void {
  fireAndForget(async () => {
    if (await isVanEnabled(campaignId)) await syncCanvassResponseToVan(campaignId, contactId, outcome, method)
    else if (await isPdiEnabled(campaignId)) await syncCanvassResponseToPdi(campaignId, contactId, outcome, method)
  }, `crm-canvass:${contactId}`)
}

// ── Event sync dispatch ─────────────────────────────────────────

export function syncEvent(campaignId: string, eventId: string): void {
  fireAndForget(async () => {
    if (await isVanEnabled(campaignId)) await syncEventToVan(campaignId, eventId)
    else if (await isPdiEnabled(campaignId)) await syncEventToPdi(campaignId, eventId)
  }, `crm-event:${eventId}`)
}

// ── Signup/RSVP sync dispatch ───────────────────────────────────

export function syncSignup(campaignId: string, eventId: string, rsvpId: string): void {
  fireAndForget(async () => {
    if (await isVanEnabled(campaignId)) await syncSignupToVan(campaignId, eventId, rsvpId)
    else if (await isPdiEnabled(campaignId)) await syncSignupToPdi(campaignId, eventId, rsvpId)
  }, `crm-signup:${rsvpId}`)
}

// ── Find CRM-enabled campaign for an organization ───────────────

export async function findCrmCampaignForOrg(organizationId: string): Promise<string | null> {
  return (await findVanCampaignForOrg(organizationId)) || (await findPdiCampaignForOrg(organizationId))
}
