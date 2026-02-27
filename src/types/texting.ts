// =============================================
// P2P TEXTING PLATFORM TYPES
// =============================================

export type TextCampaignStatus = 'draft' | 'active' | 'paused' | 'archived'
export type SendingMode = 'p2p' | 'blast'
export type ContactStatus = 'pending' | 'queued' | 'sent' | 'replied' | 'opted_out' | 'error'
export type MessageDirection = 'outbound' | 'inbound'
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
export type ScriptType = 'initial' | 'canned_response'
export type TextCampaignRole = 'admin' | 'texter'

export interface TextCampaign {
  id: string
  organizationId: string
  title: string
  description: string | null
  status: TextCampaignStatus
  sendingMode: SendingMode
  textingHoursStart: number
  textingHoursEnd: number
  createdBy: string
  createdAt: string
  updatedAt: string
  // Computed from joins
  contactCount?: number
  sentCount?: number
  repliedCount?: number
  optedOutCount?: number
}

export interface TextCampaignSettings {
  id: string
  textCampaignId: string
  dynamicAssignmentInitials: boolean
  dynamicAssignmentReplies: boolean
  initialBatchSize: number
  replyBatchSize: number
  enableContactNotes: boolean
  enableManualTags: boolean
  initialJoinToken: string | null
  replyJoinToken: string | null
}

export interface TextCampaignContact {
  id: string
  textCampaignId: string
  firstName: string
  lastName: string
  cell: string
  customFields: Record<string, string>
  status: ContactStatus
  assignedTo: string | null
  sentAt: string | null
  createdAt: string
}

export interface TextCampaignScript {
  id: string
  textCampaignId: string
  scriptType: ScriptType
  title: string | null
  body: string
  sortOrder: number
  tags: string[]
  isActive: boolean
  createdAt: string
}

export interface TextMessage {
  id: string
  textCampaignId: string
  contactId: string
  senderId: string | null
  direction: MessageDirection
  body: string
  status: MessageStatus
  twilioSid: string | null
  createdAt: string
}

export interface TextCampaignTag {
  id: string
  textCampaignId: string
  name: string
  color: string
  createdAt: string
}

export interface TextContactNote {
  id: string
  contactId: string
  userId: string
  note: string
  createdAt: string
  userName?: string
}

export interface TextOptOut {
  id: string
  organizationId: string
  phone: string
  reason: string | null
  source: string
  createdAt: string
}

export interface TextCampaignMember {
  id: string
  textCampaignId: string
  userId: string
  role: TextCampaignRole
  joinedAt: string
  isActive: boolean
  userName?: string
  userEmail?: string
}

// ── API request/response types ──

export interface CreateTextCampaignBody {
  title: string
  description?: string
  sendingMode?: SendingMode
  textingHoursStart?: number
  textingHoursEnd?: number
}

export interface ImportContactsBody {
  contacts: {
    firstName: string
    lastName: string
    cell: string
    customFields?: Record<string, string>
  }[]
}

export interface CreateScriptBody {
  scriptType: ScriptType
  title?: string
  body: string
  tags?: string[]
}

export interface TextCampaignStats {
  totalContacts: number
  pending: number
  sent: number
  replied: number
  optedOut: number
  errors: number
  totalMessages: number
  delivered: number
  failed: number
  inbound: number
}

export interface ConversationPreview {
  contact: TextCampaignContact
  lastMessage: TextMessage | null
  messageCount: number
}
