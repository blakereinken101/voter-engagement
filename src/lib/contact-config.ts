/**
 * Shared configuration for contact display components.
 * Single source of truth for outcome labels, outreach methods,
 * category icons, segment colors, and helpers.
 */

import {
  MessageCircle,
  Phone,
  Coffee,
  ThumbsUp,
  HelpCircle,
  ThumbsDown,
  Mail,
  PhoneOff,
  Home,
  Heart,
  Users,
  Star,
  PartyPopper,
  Building,
  Briefcase,
  Landmark,
  GraduationCap,
  Trophy,
  BookOpen,
  Search,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { OutreachMethod, ContactOutcome, VoterSegment } from '@/types'

// ─── Outcome configuration ───────────────────────────────────────

export interface OutcomeInfo {
  label: string
  Icon: LucideIcon
  color: string
  tip: string
}

export const OUTCOME_CONFIG: Record<ContactOutcome, OutcomeInfo> = {
  supporter:      { label: 'Supporter',  Icon: ThumbsUp,   color: 'bg-vc-teal text-white',               tip: "They're on board and will vote!" },
  undecided:      { label: 'Undecided',  Icon: HelpCircle, color: 'bg-vc-gold text-vc-purple',            tip: 'Not sure yet — follow up closer to election day' },
  opposed:        { label: 'Opposed',    Icon: ThumbsDown, color: 'bg-white/10 text-white/60',            tip: 'Not interested — no need to push further' },
  'left-message': { label: 'Left msg',   Icon: Mail,       color: 'bg-vc-purple/10 text-vc-purple-light', tip: 'Left a voicemail or message — try again later' },
  'no-answer':    { label: 'No answer',  Icon: PhoneOff,   color: 'bg-vc-purple/10 text-vc-purple-light', tip: "Didn't pick up — try a different time or method" },
}

// ─── Outcome groupings ──────────────────────────────────────────

export const COULDNT_REACH_OUTCOMES: ContactOutcome[] = ['no-answer', 'left-message']
export const RESPONSE_OUTCOMES: ContactOutcome[] = ['supporter', 'undecided', 'opposed']

export function isRecontactOutcome(outcome?: ContactOutcome): boolean {
  return !!outcome && COULDNT_REACH_OUTCOMES.includes(outcome)
}

export function isResponseOutcome(outcome?: ContactOutcome): boolean {
  return !!outcome && RESPONSE_OUTCOMES.includes(outcome)
}

// ─── Outreach method configuration ──────────────────────────────

export interface OutreachInfo {
  label: string
  Icon: LucideIcon
  tip: string
}

export const OUTREACH_LABELS: Record<OutreachMethod, OutreachInfo> = {
  text:        { label: 'Text', Icon: MessageCircle, tip: 'Send a text message — casual and low-pressure' },
  call:        { label: 'Call', Icon: Phone,          tip: 'Give them a call — more personal than texting' },
  'one-on-one': { label: '1:1', Icon: Coffee,         tip: 'Meet up in person — the most persuasive approach' },
}

// ─── Category icons ─────────────────────────────────────────────

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: Home,
  heart: Heart,
  users: Users,
  star: Star,
  'party-popper': PartyPopper,
  building: Building,
  briefcase: Briefcase,
  landmark: Landmark,
  'graduation-cap': GraduationCap,
  trophy: Trophy,
  'book-open': BookOpen,
  coffee: Coffee,
  utensils: Utensils,
  search: Search,
}

// ─── Segment configuration ──────────────────────────────────────

export interface SegmentInfo {
  label: string
  textColor: string
  dotColor: string
}

export const SEGMENT_CONFIG: Record<VoterSegment, SegmentInfo> = {
  'super-voter':     { label: 'Super Voter',     textColor: 'text-vc-teal', dotColor: 'bg-vc-teal' },
  'sometimes-voter': { label: 'Sometimes Voter', textColor: 'text-vc-gold', dotColor: 'bg-vc-gold' },
  'rarely-voter':    { label: 'Rarely Voter',    textColor: 'text-vc-coral', dotColor: 'bg-vc-coral' },
}

export function getSegmentColors(segment?: VoterSegment): { textColor: string; dotColor: string } {
  if (segment && SEGMENT_CONFIG[segment]) {
    return { textColor: SEGMENT_CONFIG[segment].textColor, dotColor: SEGMENT_CONFIG[segment].dotColor }
  }
  return { textColor: 'text-white/40', dotColor: 'bg-gray-300' }
}
