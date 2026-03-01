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
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type MatchedField = 'exact-name' | 'phonetic-name' | 'fuzzy-name' | 'city' | 'age-range' | 'exact-age' | 'zip' | 'address' | 'gender'

export interface MatchCandidate {
  voterRecord: SafeVoterRecord
  score: number
  confidenceLevel: ConfidenceLevel
  matchedOn: MatchedField[]
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

export type AdminTab = 'summary' | 'volunteers' | 'contacts' | 'activity' | 'export' | 'leaderboard' | 'purge' | 'team' | 'ai-context' | 'van' | 'petitions'

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
}

export type DashboardView = 'chat' | 'contacts'
