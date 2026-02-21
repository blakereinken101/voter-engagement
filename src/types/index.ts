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
export type ContactMode = 'rolodex' | 'list'

export interface ActionPlanItem {
  matchResult: MatchResult
  contacted: boolean
  contactedDate?: string
  outreachMethod?: OutreachMethod
  contactOutcome?: ContactOutcome
  followUpDate?: string
  notes?: string
  isVolunteerProspect?: boolean
  recruitedDate?: string
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

export type SortField = 'name' | 'category' | 'matchStatus' | 'voteScore' | 'outcome' | 'contacted'
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

export type UserRole = 'volunteer' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  campaignId: string
  createdAt: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
}

// =============================================
// ADMIN TYPES
// =============================================

export interface VolunteerSummary {
  id: string
  name: string
  email: string
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

export type AdminTab = 'summary' | 'volunteers' | 'contacts' | 'activity' | 'export' | 'leaderboard'
