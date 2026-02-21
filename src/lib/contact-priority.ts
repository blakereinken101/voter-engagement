import type { ActionPlanItem, VoterSegment, RelationshipCategory } from '@/types'

// =============================================================================
// Contact Priority Scoring
// =============================================================================
// Scores contacts 0-100 to help volunteers know who to reach out to first.
// Higher score = contact first. Factors: contact status, voter segment,
// relationship closeness, and follow-up needs.
// =============================================================================

const SEGMENT_SCORES: Record<VoterSegment, number> = {
  'sometimes-voter': 25,
  'rarely-voter': 15,
  'super-voter': 5,
}

const UNMATCHED_SEGMENT_SCORE = 10

const RELATIONSHIP_SCORES: Record<RelationshipCategory, number> = {
  'household': 20,
  'close-family': 18,
  'best-friends': 16,
  'extended-family': 14,
  'close-friends': 12,
  'neighbors': 10,
  'coworkers': 8,
  'faith-community': 8,
  'school-pta': 6,
  'sports-recreation': 6,
  'hobby-groups': 4,
  'community-regulars': 4,
  'recent-meals': 2,
  'who-did-we-miss': 2,
}

/**
 * Calculate a priority score (0-100) for a contact in the action plan.
 *
 * Scoring breakdown:
 * - Not yet contacted: +40
 * - Voter segment:     up to +25 (sometimes-voter most valuable)
 * - Relationship:      up to +20 (closer = more influence)
 * - Follow-up needed:  +15 (left-message or no-answer)
 * - Undecided:         +10 (worth another conversation)
 */
export function calculatePriority(item: ActionPlanItem): number {
  let score = 0

  // Factor 1: Contact status (+40 if not yet contacted)
  if (!item.contacted) {
    score += 40
  }

  // Factor 2: Voter segment scoring
  const segment = item.matchResult.segment
  if (segment) {
    score += SEGMENT_SCORES[segment]
  } else {
    score += UNMATCHED_SEGMENT_SCORE
  }

  // Factor 3: Relationship closeness
  const category = item.matchResult.personEntry.category
  score += RELATIONSHIP_SCORES[category] ?? 0

  // Factor 4: Follow-up boost (contacted but needs another attempt)
  if (item.contactOutcome === 'left-message' || item.contactOutcome === 'no-answer') {
    score += 15
  }

  // Factor 5: Undecided boost (worth another conversation)
  if (item.contactOutcome === 'undecided') {
    score += 10
  }

  // Clamp to 0-100
  return Math.min(100, Math.max(0, score))
}

/**
 * Get a human-readable priority label and associated color class.
 */
export function getPriorityLabel(score: number): { label: string; color: string } {
  if (score >= 70) {
    return { label: 'High', color: 'text-vc-coral' }
  }
  if (score >= 40) {
    return { label: 'Medium', color: 'text-vc-gold' }
  }
  return { label: 'Low', color: 'text-white/40' }
}

/**
 * Sort action plan items by priority score, highest first.
 * Returns a new array (does not mutate the original).
 */
export function sortByPriority(items: ActionPlanItem[]): ActionPlanItem[] {
  return [...items].sort((a, b) => calculatePriority(b) - calculatePriority(a))
}
