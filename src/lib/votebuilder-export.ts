import { ActionPlanItem, VoterSegment, ContactOutcome } from '@/types'

/**
 * VoteBuilder (VAN/EveryAction) CSV export
 * Generates a CSV in the format VoteBuilder expects for contact uploads.
 * Columns match VAN's "My Voters" bulk upload template.
 * Includes campaign isolation fields and volunteer prospect tracking.
 */

const SEGMENT_LABELS: Record<VoterSegment, string> = {
  'super-voter': 'Super Voter - Volunteer Recruitment',
  'sometimes-voter': 'Sometimes Voter - Nudge Needed',
  'rarely-voter': 'Rarely Voter - Priority Conversation',
}

const METHOD_MAP: Record<string, string> = {
  text: 'Text',
  call: 'Phone',
  'one-on-one': 'Walk',
}

const OUTCOME_MAP: Record<ContactOutcome, string> = {
  'supporter': 'Supporter',
  'undecided': 'Undecided',
  'opposed': 'Opposed',
  'left-message': 'Left Message',
  'no-answer': 'No Answer',
}

function escapeCSV(value: string): string {
  // Sanitize against CSV injection — strip leading =, +, -, @, tab, CR
  let sanitized = value
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = "'" + sanitized
  }
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}

export function generateVoteBuilderCSV(
  items: ActionPlanItem[],
  selectedState: string | null,
  userId?: string,
  campaignId?: string,
  campaignName?: string,
): string {
  const headers = [
    'CampaignId',
    'CampaignName',
    'UserId',
    'FirstName',
    'LastName',
    'Address',
    'City',
    'State',
    'Zip5',
    'Sex',
    'Age',
    'Party',
    'VoterStatus',
    'MatchStatus',
    'ContactType',
    'ContactResult',
    'ContactOutcome',
    'ContactDate',
    'VoterSegment',
    'VoteScore',
    'RelationshipCategory',
    'VolunteerProspect',
    'Notes',
  ]

  const rows = items.map(item => {
    const { matchResult, contacted, contactedDate, outreachMethod, contactOutcome, notes, volunteerInterest } = item
    const voter = matchResult.bestMatch
    const person = matchResult.personEntry

    const contactType = outreachMethod ? (METHOD_MAP[outreachMethod] || outreachMethod) : ''
    const contactResult = contactOutcome
      ? OUTCOME_MAP[contactOutcome]
      : contacted
        ? 'Contacted'
        : 'Not Yet Contacted'
    const outcomeStr = contactOutcome ? OUTCOME_MAP[contactOutcome] : ''
    const segment = matchResult.segment ? SEGMENT_LABELS[matchResult.segment] : ''
    const voteScoreStr = matchResult.voteScore !== undefined
      ? `${Math.round(matchResult.voteScore * 100)}%`
      : ''

    return [
      campaignId ?? '',
      campaignName ?? '',
      userId ?? '',
      voter?.first_name ?? person.firstName,
      voter?.last_name ?? person.lastName,
      voter?.residential_address ?? person.address ?? '',
      voter?.city ?? person.city ?? '',
      voter?.state ?? selectedState ?? '',
      voter?.zip ?? person.zip ?? '',
      voter?.gender === 'M' ? 'Male' : voter?.gender === 'F' ? 'Female' : '',
      voter?.birth_year ? `${new Date().getFullYear() - parseInt(voter.birth_year)}` : (person.age ? `${person.age}` : ''),
      voter?.party_affiliation ?? '',
      voter?.voter_status ?? '',
      matchResult.status,
      contactType,
      contactResult,
      outcomeStr,
      contactedDate ? new Date(contactedDate).toLocaleDateString('en-US') : '',
      segment,
      voteScoreStr,
      person.category,
      volunteerInterest === 'yes' ? 'Yes' : volunteerInterest === 'maybe' ? 'Maybe' : '',
      notes ?? '',
    ].map(v => escapeCSV(String(v)))
  })

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
