// =============================================
// VOTER FILE TYPES
// =============================================

export type VoteValue = 'Y' | 'N' | 'A' | 'E' | ''

export interface VoterRecord {
  voter_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: 'M' | 'F' | 'U'
  residential_address: string
  city: string
  state: string
  zip: string
  party_affiliation: 'DEM' | 'REP' | 'IND' | 'GRN' | 'LIB' | 'OTH' | 'UNR'
  registration_date: string
  voter_status: 'Active' | 'Inactive' | 'Purged'
  VH2024G: VoteValue
  VH2022G: VoteValue
  VH2020G: VoteValue
  VH2024P: VoteValue
  VH2022P: VoteValue
  VH2020P: VoteValue
  lat?: number | null
  lng?: number | null
  congressional_district?: string | null
  state_senate_district?: string | null
  state_house_district?: string | null
}

// Sanitized version sent to client (no voter_id or full DOB)
export interface SafeVoterRecord {
  first_name: string
  last_name: string
  birth_year?: string
  gender: 'M' | 'F' | 'U'
  residential_address: string
  city: string
  state: string
  zip: string
  party_affiliation: string
  registration_date: string
  voter_status: string
  VH2024G: VoteValue
  VH2022G: VoteValue
  VH2020G: VoteValue
  VH2024P: VoteValue
  VH2022P: VoteValue
  VH2020P: VoteValue
  lat?: number | null
  lng?: number | null
  congressional_district?: string | null
  state_senate_district?: string | null
  state_house_district?: string | null
}

// =============================================
// USER INPUT TYPES
// =============================================

export type AgeRange = 'under-25' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'
export type Gender = 'M' | 'F' | ''

export interface PersonEntry {
  id: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  city?: string
  zip?: string
  age?: number
  ageRange?: AgeRange
  gender?: Gender
  category: RelationshipCategory
  createdAt?: number  // timestamp (Date.now()) for "just added" indicator
}

export type RelationshipCategory =
  | 'household'
  | 'close-family'
  | 'extended-family'
  | 'best-friends'
  | 'close-friends'
  | 'neighbors'
  | 'coworkers'
  | 'faith-community'
  | 'school-pta'
  | 'sports-recreation'
  | 'hobby-groups'
  | 'community-regulars'
  | 'recent-meals'
  | 'who-did-we-miss'

// =============================================
// MATCHING TYPES
// =============================================

export type MatchStatus = 'confirmed' | 'ambiguous' | 'unmatched' | 'pending'
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very-low'
export type AiConfidence = 'likely-match' | 'possible-match' | 'unlikely-match'

export type MatchedField = 'exact-name' | 'phonetic-name' | 'fuzzy-name' | 'city' | 'age-range' | 'exact-age' | 'zip' | 'address' | 'gender'

export interface MatchCandidate {
  voterRecord: SafeVoterRecord
  score: number
  confidenceLevel: ConfidenceLevel
  matchedOn: MatchedField[]
  aiConfidence?: AiConfidence
  aiReasoning?: string
}

export interface MatchResult {
  personEntry: PersonEntry
  status: MatchStatus
  bestMatch?: SafeVoterRecord
  candidates: MatchCandidate[]
  voteScore?: number
  segment?: VoterSegment
  userConfirmed?: boolean
}

// =============================================
// SEGMENTATION TYPES
// =============================================

export type VoterSegment = 'super-voter' | 'sometimes-voter' | 'rarely-voter'

export interface SegmentedResults {
  superVoters: MatchResult[]
  sometimesVoters: MatchResult[]
  rarelyVoters: MatchResult[]
  unmatched: MatchResult[]
  totalEntered: number
  totalMatched: number
}

// =============================================
// OUTREACH TYPES
// =============================================

export type OutreachMethod = 'text' | 'call' | 'one-on-one'
export type ContactOutcome = 'supporter' | 'undecided' | 'opposed' | 'left-message' | 'no-answer'
export type VolunteerInterest = 'yes' | 'no' | 'maybe'
export type ContactMode = 'rolodex' | 'list'

export interface ActionPlanItem {
  matchResult: MatchResult
  contacted: boolean
  contactedDate?: string
  outreachMethod?: OutreachMethod
  contactOutcome?: ContactOutcome
  followUpDate?: string
  notes?: string
  volunteerInterest?: VolunteerInterest
  recruitedDate?: string
  surveyResponses?: Record<string, string>
}

// =============================================
// SURVEY TYPES
// =============================================

export type SurveyQuestionType = 'select' | 'text'

export interface SurveyQuestion {
  id: string
  label: string
  type: SurveyQuestionType
  options?: string[]  // for 'select' type
  required?: boolean
}

// =============================================
// SCRIPT TYPES
// =============================================

export interface ConversationScript {
  segment: VoterSegment
  title: string
  introduction: string
  keyPoints: string[]
  sampleConversation: ScriptLine[]
  closingAsk: string
  tips: string[]
  textTemplate: string
  callOpener: string
  oneOnOneSetup: string
}

export interface ScriptLine {
  speaker: 'you' | 'them'
  text: string
}

// =============================================
// APP STATE TYPES
// =============================================

export type AppStep = 'landing' | 'state-select' | 'questionnaire' | 'matching' | 'results' | 'action-plan'

export interface AppState {
  userId: string
  campaignId: string
  selectedState: string | null
  currentStep: AppStep
  personEntries: PersonEntry[]
  currentCategoryIndex: number
  matchResults: MatchResult[]
  actionPlanState: ActionPlanItem[]
  isLoading: boolean
  error: string | null
}

// =============================================
// API TYPES
// =============================================

export interface MatchRequestBody {
  people: PersonEntry[]
  state: string
}

export interface MatchResponseBody {
  results: MatchResult[]
  processingTimeMs: number
}

// =============================================
// WIZARD TYPES
// =============================================

export interface CategoryConfig {
  id: RelationshipCategory
  question: string
  icon: string
  subtext: string
  examples: string[]
  minSuggested: number
}

// =============================================
// BRANDING / WHITE-LABEL TYPES
// =============================================

export interface BrandConfig {
  appName: string
  tagline: string
  logoUrl?: string
  organizationName?: string
  privacyText?: string
}

// =============================================
// SPREADSHEET VIEW TYPES
// =============================================

export interface SpreadsheetRow {
  person: PersonEntry
  matchResult?: MatchResult
  actionItem?: ActionPlanItem
}

export type SortField = 'name' | 'category' | 'matchStatus' | 'voteScore' | 'outcome' | 'contacted' | 'priority'
export type SortDirection = 'asc' | 'desc'
export type SegmentFilter = 'all' | VoterSegment | 'unmatched'
export type OutcomeFilter = 'all' | 'not-contacted' | ContactOutcome

// =============================================
// INTAKE MODE TYPES
// =============================================

export type IntakeMode = 'manual' | 'nearby' | 'contacts'

export interface NearbyVoter {
  voterRecord: SafeVoterRecord
  distance?: string
}

// =============================================
// AUTH TYPES
// =============================================

export type MembershipRole = 'platform_admin' | 'org_owner' | 'campaign_admin' | 'organizer' | 'volunteer'

// Roles that count as "admin" for campaign-level admin actions
export const ADMIN_ROLES: MembershipRole[] = ['platform_admin', 'org_owner', 'campaign_admin']

export interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface Campaign {
  id: string
  orgId: string
  name: string
  slug: string
  candidateName: string
  state: string
  electionDate?: string
  settings: Record<string, unknown>
  isActive: boolean
  createdAt: string
}

export interface Membership {
  id: string
  userId: string
  campaignId: string
  role: MembershipRole
  campaignName?: string
  campaignSlug?: string
  orgName?: string
  joinedAt: string
  isActive: boolean
}

export interface Invitation {
  id: string
  campaignId: string
  email: string | null
  role: MembershipRole
  token: string
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  maxUses: number
  useCount: number
  createdAt: string
  campaignName?: string
  inviterName?: string
}

export interface User {
  id: string
  email: string
  name: string
  isPlatformAdmin: boolean
  createdAt: string
}

export interface AuthState {
  user: User | null
  memberships: Membership[]
  activeMembership: Membership | null
  isLoading: boolean
}

// =============================================
// ADMIN TYPES
// =============================================

export interface VolunteerSummary {
  id: string
  name: string
  email: string
  role: MembershipRole
  contactCount: number
  matchedCount: number
  contactedCount: number
  supporterCount: number
  undecidedCount: number
  opposedCount: number
  createdAt: string
}

export interface AdminStats {
  totalVolunteers: number
  totalContacts: number
  matchRate: number
  contactRate: number
  outcomeDistribution: Record<string, number>
  segmentDistribution: Record<string, number>
}

export interface ActivityLogEntry {
  id: number
  userId: string
  userName: string
  action: string
  details: string | null
  createdAt: string
}

export type AdminTab = 'summary' | 'volunteers' | 'contacts' | 'activity' | 'export' | 'leaderboard' | 'purge' | 'team' | 'ai-context' | 'integrations' | 'petitions' | 'channels' | 'push' | 'support'

// =============================================
// PTG — CONVERSATIONS SPREADSHEET TYPES
// =============================================

export interface Turf {
  id: string
  campaignId: string
  name: string
  description: string | null
  organizerId: string | null
  organizerName: string | null
  region: string | null
  createdAt: string
}

export interface ConversationRow {
  contactId: string
  firstName: string
  lastName: string
  phone: string | null
  address: string | null
  city: string | null
  zip: string | null

  actionItemId: string
  contactOutcome: string | null
  notes: string | null
  surveyResponses: Record<string, string> | null
  outreachMethod: string | null
  contactedDate: string | null
  volunteerInterest: string | null

  volunteerName: string | null
  volunteerId: string | null

  organizerName: string | null
  organizerId: string | null
  turfName: string | null
  region: string | null

  entryMethod: 'manual' | 'scan' | 'chatbot' | 'import'
  enteredByName: string | null
  enteredBySelf: boolean
  timestamp: string
  timezone: string
}

export interface ConversationsResponse {
  rows: ConversationRow[]
  total: number
  page: number
  pageSize: number
}

export interface ConversationFilters {
  search?: string
  region?: string
  organizerId?: string
  volunteerId?: string
  outcome?: string
  entryMethod?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  width?: number
}

// =============================================
// AI CHAT TYPES
// =============================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ChatToolCall[]
  toolResults?: ChatToolResult[]
  createdAt: string
}

export interface ChatToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ChatToolResult {
  toolCallId: string
  name: string
  result: Record<string, unknown>
}

export type CampaignType = 'candidate' | 'ballot-measure' | 'issue-advocacy'
export type GoalPriority = 'volunteer-recruitment' | 'voter-turnout' | 'persuasion' | 'fundraising'

export interface CandidateInfo {
  name?: string
  party?: string
  office?: string
}

export interface ElectionInfo {
  date?: string
  state?: string
  district?: string
}

export interface PartyStrategies {
  DEM?: string
  REP?: string
  UNF?: string
  OTHER?: string
}

export interface CustomSurveyQuestion {
  id: string
  question: string
  type: 'text' | 'select'
  options?: string[]
}

export interface FundraiserTypeConfig {
  id: string        // UUID
  name: string      // Admin-defined, e.g. "Grassroots", "Max Out"
  guidance: string   // Per-type AI coaching text
}

export interface FundraisingConfig {
  requireResidency?: boolean
  contributionLimits?: string
  fundraisingGuidance?: string
  fundraiserTypes?: FundraiserTypeConfig[]
}

export type TargetElectionCondition = 'voted' | 'did-not-vote'

export interface TargetUniverseConfig {
  VH2024G?: TargetElectionCondition
  VH2022G?: TargetElectionCondition
  VH2020G?: TargetElectionCondition
  VH2024P?: TargetElectionCondition
  VH2022P?: TargetElectionCondition
  VH2020P?: TargetElectionCondition
}

export interface AICampaignContext {
  goals?: string
  keyIssues?: string[]
  talkingPoints?: string[]
  messagingGuidance?: string
  campaignType?: CampaignType
  goalPriorities?: GoalPriority[]
  candidateInfo?: CandidateInfo
  electionInfo?: ElectionInfo
  partyStrategies?: PartyStrategies
  customSurveyQuestions?: CustomSurveyQuestion[]
  fundraisingConfig?: FundraisingConfig
  targetUniverse?: TargetUniverseConfig
  /** Per-campaign prompt overrides. Keys are PromptSectionId values (e.g. 'identity', 'rolodex').
   *  When set, these take highest priority — overriding platform defaults, base overrides,
   *  and campaign-type overrides. Only applied to chat (not event_suggest or petition matching). */
  promptOverrides?: Record<string, string>
}

export type DashboardView = 'chat' | 'contacts'

// =============================================
// CONTACT EVENT RSVP TYPES
// =============================================

// =============================================
// MESSAGING TYPES
// =============================================

export type ChannelType = 'team' | 'broadcast' | 'direct'
export type MessageType = 'text' | 'system' | 'announcement'
export type ChannelMemberRole = 'admin' | 'member'

export interface MessagingChannel {
  id: string
  campaignId: string
  name: string | null
  channelType: ChannelType
  description: string | null
  createdBy: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
  // Computed
  unreadCount?: number
  lastMessage?: MessagingMessage | null
  memberCount?: number
  members?: ChannelMember[]
}

export interface ChannelMember {
  id: string
  channelId: string
  userId: string
  role: ChannelMemberRole
  lastReadAt: string
  muted: boolean
  joinedAt: string
  // Joined
  userName?: string
  userEmail?: string
}

export interface MessagingMessage {
  id: string
  channelId: string
  senderId: string
  content: string
  messageType: MessageType
  parentId: string | null
  isEdited: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  // Joined
  senderName?: string
}

// =============================================
// CONTACT EVENT RSVP TYPES
// =============================================

export type ContactEventRsvpStatus = 'yes' | 'no' | 'maybe'

export interface ContactEventRsvp {
  id: string
  contactId: string
  eventId: string
  status: ContactEventRsvpStatus
  notes?: string
  eventTitle?: string
  eventStartTime?: string
}

// =============================================
// SUPPORT TYPES
// =============================================

export type TicketCategory = 'general' | 'technical' | 'billing' | 'account' | 'data' | 'feature-request'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in-progress' | 'waiting-on-user' | 'resolved' | 'closed'

export const TICKET_CATEGORIES: { id: TicketCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'technical', label: 'Technical' },
  { id: 'billing', label: 'Billing' },
  { id: 'account', label: 'Account' },
  { id: 'data', label: 'Data' },
  { id: 'feature-request', label: 'Feature Request' },
]

export const TICKET_PRIORITIES: { id: TicketPriority; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
]

export const TICKET_STATUSES: { id: TicketStatus; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'waiting-on-user', label: 'Waiting on User' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
]

export interface KBArticle {
  id: string
  campaignId: string | null
  title: string
  slug: string
  content: string
  category: string
  tags: string[]
  isPublished: boolean
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface SupportTicket {
  id: string
  campaignId: string
  userId: string
  assignedTo: string | null
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  aiConversation: SupportChatMessage[] | null
  aiSuggestedCategory: string | null
  aiSuggestedPriority: string | null
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  // Joined fields
  userName?: string
  userEmail?: string
  assignedName?: string
  messageCount?: number
  lastMessageAt?: string
}

export interface SupportTicketMessage {
  id: string
  ticketId: string
  senderId: string
  content: string
  isInternalNote: boolean
  aiSuggested: boolean
  createdAt: string
  // Joined
  senderName?: string
  senderRole?: MembershipRole
}

export interface SupportChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface SupportTicketEvent {
  id: string
  ticketId: string
  actorId: string
  eventType: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
  actorName?: string
}
