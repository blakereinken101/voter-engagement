// =============================================
// EVENT TYPES
// =============================================

export type EventType =
  | 'canvassing'
  | 'phone_bank'
  | 'rally'
  | 'town_hall'
  | 'watch_party'
  | 'meetup'
  | 'happy_hour'
  | 'fundraiser'
  | 'volunteer_training'
  | 'community'
  | 'voter_registration'
  | 'protest'
  | 'debate_watch'
  | 'ballot_party'

export type EventVisibility = 'public' | 'org' | 'invite_only'
export type EventStatus = 'draft' | 'published' | 'cancelled'
export type RSVPStatus = 'going' | 'maybe' | 'not_going'

export interface Event {
  id: string
  organizationId: string
  createdBy: string
  title: string
  description: string | null
  eventType: EventType

  // When & where
  startTime: string
  endTime: string | null
  timezone: string
  locationName: string | null
  locationAddress: string | null
  locationCity: string | null
  locationState: string | null
  locationZip: string | null
  isVirtual: boolean
  virtualUrl: string | null

  // Appearance
  coverImageUrl: string | null
  emoji: string
  themeColor: string

  // Access
  visibility: EventVisibility
  maxAttendees: number | null
  rsvpEnabled: boolean

  // Status
  status: EventStatus
  slug: string
  createdAt: string
  updatedAt: string

  // Computed (from joins)
  creatorName?: string
  organizationName?: string
  rsvpCounts?: RSVPCounts
}

export interface RSVPCounts {
  going: number
  maybe: number
  notGoing: number
}

export interface EventRSVP {
  id: string
  eventId: string
  userId: string | null
  guestName: string | null
  guestEmail: string | null
  status: RSVPStatus
  guestCount: number
  note: string | null
  createdAt: string
  updatedAt: string

  // Computed
  userName?: string
}

export interface EventComment {
  id: string
  eventId: string
  userId: string
  parentId: string | null
  content: string
  createdAt: string
  updatedAt: string

  // Computed
  userName?: string
  replies?: EventComment[]
}

export interface EventReaction {
  id: string
  eventId: string
  userId: string
  emoji: string
  createdAt: string
}

export interface ReactionSummary {
  emoji: string
  count: number
  userReacted: boolean
}

// =============================================
// SUBSCRIPTION TYPES
// =============================================

export type ProductType = 'events' | 'relational'
export type EventsPlan = 'grassroots' | 'growth' | 'scale'
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing'

export interface PlanLimits {
  maxRsvpsPerMonth: number   // -1 = unlimited
  maxTeamMembers: number     // -1 = unlimited
  analytics: boolean
  customBranding: boolean
  apiAccess: boolean
  whiteLabel: boolean
}

export const PLAN_LIMITS: Record<EventsPlan, PlanLimits> = {
  grassroots: {
    maxRsvpsPerMonth: 200,
    maxTeamMembers: 3,
    analytics: false,
    customBranding: false,
    apiAccess: false,
    whiteLabel: false,
  },
  growth: {
    maxRsvpsPerMonth: -1,
    maxTeamMembers: 10,
    analytics: true,
    customBranding: true,
    apiAccess: false,
    whiteLabel: false,
  },
  scale: {
    maxRsvpsPerMonth: -1,
    maxTeamMembers: -1,
    analytics: true,
    customBranding: true,
    apiAccess: true,
    whiteLabel: true,
  },
}

export const PLAN_PRICES: Record<EventsPlan, number> = {
  grassroots: 49,
  growth: 149,
  scale: 349,
}

export interface ProductSubscription {
  id: string
  organizationId: string
  product: ProductType
  plan: string
  status: SubscriptionStatus
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  limits: PlanLimits
  createdAt: string
}

// =============================================
// FORM TYPES
// =============================================

export interface EventFormData {
  title: string
  description: string
  eventType: EventType
  startTime: string
  endTime: string
  timezone: string
  locationName: string
  locationAddress: string
  locationCity: string
  locationState: string
  locationZip: string
  isVirtual: boolean
  virtualUrl: string
  coverImageUrl: string
  emoji: string
  themeColor: string
  visibility: EventVisibility
  maxAttendees: string  // string for form input, parsed to number
  rsvpEnabled: boolean
  status: EventStatus
}

export interface RSVPFormData {
  status: RSVPStatus
  guestCount: number
  note: string
  guestName: string
  guestEmail: string
}

// =============================================
// EVENT TYPE DISPLAY CONFIG
// =============================================

export interface EventTypeConfig {
  label: string
  emoji: string
  color: string    // Tailwind class like 'vc-teal'
  bgClass: string  // Tailwind bg class
}

export const EVENT_TYPE_CONFIG: Record<EventType, EventTypeConfig> = {
  canvassing:          { label: 'Canvassing',          emoji: '🚪', color: 'vc-teal',        bgClass: 'bg-vc-teal/15 text-vc-teal border-vc-teal/30' },
  phone_bank:          { label: 'Phone Bank',          emoji: '📞', color: 'vc-gold',        bgClass: 'bg-vc-gold/15 text-vc-gold border-vc-gold/30' },
  rally:               { label: 'Rally',               emoji: '📢', color: 'vc-coral',       bgClass: 'bg-vc-coral/15 text-vc-coral border-vc-coral/30' },
  town_hall:           { label: 'Town Hall',           emoji: '🏛️', color: 'vc-purple',      bgClass: 'bg-vc-purple/15 text-vc-purple-light border-vc-purple/30' },
  watch_party:         { label: 'Watch Party',         emoji: '📺', color: 'vc-purple-light', bgClass: 'bg-vc-purple-light/15 text-vc-purple-light border-vc-purple-light/30' },
  meetup:              { label: 'Meetup',              emoji: '🤝', color: 'vc-teal',        bgClass: 'bg-vc-teal/15 text-vc-teal border-vc-teal/30' },
  happy_hour:          { label: 'Happy Hour',          emoji: '🍻', color: 'vc-gold',        bgClass: 'bg-vc-gold/15 text-vc-gold border-vc-gold/30' },
  fundraiser:          { label: 'Fundraiser',          emoji: '💰', color: 'vc-gold',        bgClass: 'bg-vc-gold/15 text-vc-gold border-vc-gold/30' },
  volunteer_training:  { label: 'Volunteer Training',  emoji: '📋', color: 'vc-purple',      bgClass: 'bg-vc-purple/15 text-vc-purple-light border-vc-purple/30' },
  community:           { label: 'Community Event',     emoji: '🌟', color: 'vc-teal',        bgClass: 'bg-vc-teal/15 text-vc-teal border-vc-teal/30' },
  voter_registration:  { label: 'Voter Registration', emoji: '📝', color: 'vc-teal',        bgClass: 'bg-vc-teal/15 text-vc-teal border-vc-teal/30' },
  protest:             { label: 'Protest / March',    emoji: '✊', color: 'vc-coral',       bgClass: 'bg-vc-coral/15 text-vc-coral border-vc-coral/30' },
  debate_watch:        { label: 'Debate Watch',       emoji: '🎙️', color: 'vc-purple',      bgClass: 'bg-vc-purple/15 text-vc-purple-light border-vc-purple/30' },
  ballot_party:        { label: 'Ballot Party',       emoji: '🗳️', color: 'vc-gold',        bgClass: 'bg-vc-gold/15 text-vc-gold border-vc-gold/30' },
}

export const DEFAULT_REACTION_EMOJIS = ['🔥', '❤️', '🙌', '🎉', '⭐', '💯']

// Free tier: organizations can create this many events without a paid subscription
export const FREE_EVENT_LIMIT = 2
