'use client'
import { useState } from 'react'
import { MatchResult, OutreachMethod, ContactOutcome } from '@/types'
import { getVoteHistoryDetail } from '@/lib/voter-segments'
import { getRelationshipTip } from '@/lib/scripts'
import { MessageCircle, Phone, Coffee, ThumbsUp, HelpCircle, ThumbsDown, Mail, PhoneOff } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  result: MatchResult
  showContactToggle?: boolean
  onContactToggle?: (method: OutreachMethod) => void
  contacted?: boolean
  outreachMethod?: OutreachMethod
  contactOutcome?: ContactOutcome
  onOutcomeSelect?: (outcome: ContactOutcome) => void
  onRecontact?: () => void
  notes?: string
  onNotesChange?: (notes: string) => void
}

const OUTREACH_LABELS: Record<OutreachMethod, { label: string; Icon: typeof MessageCircle }> = {
  text: { label: 'Text', Icon: MessageCircle },
  call: { label: 'Call', Icon: Phone },
  'one-on-one': { label: '1:1 meetup', Icon: Coffee },
}

const OUTCOME_CONFIG: Record<ContactOutcome, { label: string; Icon: typeof MessageCircle; color: string }> = {
  'supporter':    { label: 'Supporter',       Icon: ThumbsUp,    color: 'bg-vc-teal text-white' },
  'undecided':    { label: 'Undecided',       Icon: HelpCircle,  color: 'bg-vc-gold text-vc-purple' },
  'opposed':      { label: 'Not interested',  Icon: ThumbsDown,  color: 'bg-gray-200 text-vc-slate' },
  'left-message': { label: 'Left message',    Icon: Mail,        color: 'bg-vc-purple/10 text-vc-purple' },
  'no-answer':    { label: 'No answer',       Icon: PhoneOff,    color: 'bg-vc-purple/10 text-vc-purple' },
}

export default function VoterCard({
  result, showContactToggle, onContactToggle, contacted, outreachMethod,
  contactOutcome, onOutcomeSelect, onRecontact, notes, onNotesChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [localNotes, setLocalNotes] = useState(notes ?? '')
  const { personEntry, bestMatch, voteScore, segment, status } = result

  const segmentStyles = {
    'super-voter': 'border-l-vc-teal bg-white',
    'sometimes-voter': 'border-l-vc-gold bg-white',
    'rarely-voter': 'border-l-vc-coral bg-white',
  }

  const voteHistory = bestMatch ? getVoteHistoryDetail(bestMatch) : []
  const relationshipTip = getRelationshipTip(personEntry.category)
  const isRecontact = contactOutcome === 'left-message' || contactOutcome === 'no-answer'

  return (
    <div className={clsx(
      'rounded-lg border border-gray-200 p-4 transition-all border-l-4',
      status === 'unmatched' ? 'border-l-gray-300 bg-white' :
        segment ? segmentStyles[segment] : 'border-l-gray-300 bg-white',
      contacted && contactOutcome && !isRecontact && 'opacity-60'
    )}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-bold text-vc-purple">
            {personEntry.firstName} {personEntry.lastName}
            {contacted && contactOutcome && !isRecontact && (() => {
              const { Icon, color, label } = OUTCOME_CONFIG[contactOutcome]
              return (
                <span className={clsx('ml-2 inline-flex items-center gap-1 text-xs font-display px-2 py-0.5 rounded-full', color)}>
                  <Icon className="w-3 h-3" /> {label}
                </span>
              )
            })()}
          </h3>
          {bestMatch && (
            <p className="text-sm text-vc-gray">
              {bestMatch.city}, {bestMatch.state}
            </p>
          )}
          {status === 'unmatched' && (
            <p className="text-sm text-vc-gray">Not found in voter file</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {voteScore !== undefined && (
            <div className="text-right">
              <div className={clsx(
                'text-lg font-bold font-display',
                segment === 'super-voter' ? 'text-vc-teal' :
                  segment === 'sometimes-voter' ? 'text-vc-slate' :
                    'text-vc-coral'
              )}>
                {Math.round(voteScore * 100)}%
              </div>
              <div className="text-[10px] text-vc-gray uppercase tracking-wide">vote rate</div>
            </div>
          )}
        </div>
      </div>

      {/* Outreach method selector — show for uncontacted people (matched or not) */}
      {showContactToggle && !contacted && (
        <div className="flex gap-2 mt-3">
          {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, { label: string; Icon: typeof MessageCircle }][]).map(([method, { label, Icon }]) => (
            <button
              key={method}
              onClick={() => onContactToggle?.(method)}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-bold border border-gray-200 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all inline-flex items-center justify-center gap-1.5"
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}

      {/* After contact: show outreach method used */}
      {contacted && outreachMethod && !contactOutcome && (() => {
        const { Icon, label } = OUTREACH_LABELS[outreachMethod]
        return (
          <div className="mt-2 text-xs text-vc-gray inline-flex items-center gap-1">
            Reached via <Icon className="w-3 h-3" /> {label}
          </div>
        )
      })()}

      {/* Outcome selector — show after contacted but before outcome is set */}
      {contacted && !contactOutcome && onOutcomeSelect && (
        <div className="mt-3 animate-fade-in">
          <p className="text-xs font-bold text-vc-gray uppercase tracking-wider mb-2">
            How did it go?
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, Icon }]) => (
              <button
                key={outcome}
                onClick={() => onOutcomeSelect(outcome)}
                className="py-1.5 px-3 rounded-lg text-xs font-bold border border-gray-200 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all inline-flex items-center gap-1.5"
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Re-contact button for left-message / no-answer */}
      {contacted && isRecontact && onRecontact && (() => {
        const { Icon, color, label } = OUTCOME_CONFIG[contactOutcome!]
        return (
          <div className="flex items-center gap-3 mt-3">
            <span className={clsx('inline-flex items-center gap-1 text-xs font-display px-2 py-0.5 rounded-full', color)}>
              <Icon className="w-3 h-3" /> {label}
            </span>
            <button
              onClick={onRecontact}
              className="text-xs font-bold text-vc-coral hover:underline transition-colors"
            >
              Try again
            </button>
          </div>
        )
      })()}

      {/* Notes textarea — visible after contact */}
      {contacted && onNotesChange && (
        <div className="mt-3">
          <textarea
            value={localNotes}
            onChange={e => setLocalNotes(e.target.value)}
            onBlur={() => onNotesChange(localNotes)}
            placeholder="How did the conversation go? Any follow-up needed?"
            className="w-full p-2.5 border border-gray-200 rounded-lg text-xs text-vc-slate focus:outline-none focus:ring-2 focus:ring-vc-purple/30 resize-none"
            rows={2}
          />
        </div>
      )}

      {/* Contacted + outcome set: show method */}
      {contacted && contactOutcome && outreachMethod && !isRecontact && (() => {
        const { Icon, label } = OUTREACH_LABELS[outreachMethod]
        return (
          <div className="mt-2 text-xs text-vc-gray inline-flex items-center gap-1">
            Reached via <Icon className="w-3 h-3" /> {label}
          </div>
        )
      })()}

      {/* Expandable details */}
      {bestMatch && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-vc-gray hover:text-vc-purple mt-2 transition-colors"
        >
          {expanded ? '- hide details' : '+ details'}
        </button>
      )}

      {expanded && bestMatch && (
        <div className="mt-3 animate-fade-in">
          {/* Vote history grid */}
          <div className="grid grid-cols-6 gap-1 mb-3">
            {voteHistory.map(({ election, year, type, voted }) => (
              <div
                key={election}
                className={clsx(
                  'text-[10px] rounded p-1.5 text-center',
                  voted ? 'bg-vc-teal text-white font-bold' : 'bg-gray-100 text-gray-400'
                )}
              >
                <div>{year}</div>
                <div>{type.slice(0, 3)}</div>
              </div>
            ))}
          </div>

          {/* Relationship tip */}
          <div className="bg-vc-purple/5 rounded-lg p-3">
            <p className="text-xs text-vc-slate leading-relaxed">{relationshipTip}</p>
          </div>
        </div>
      )}
    </div>
  )
}
