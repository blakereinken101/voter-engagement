'use client'
import { useState } from 'react'
import { MatchResult, OutreachMethod, ContactOutcome } from '@/types'
import { getVoteHistoryDetail } from '@/lib/voter-segments'
import { getRelationshipTip } from '@/lib/scripts'
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

const OUTREACH_LABELS: Record<OutreachMethod, { label: string; icon: string }> = {
  text: { label: 'Text', icon: '💬' },
  call: { label: 'Call', icon: '📞' },
  'one-on-one': { label: '1:1 meetup', icon: '☕' },
}

const OUTCOME_CONFIG: Record<ContactOutcome, { label: string; icon: string; color: string }> = {
  'supporter':    { label: 'Supporter',       icon: '✊', color: 'bg-rally-green text-white' },
  'undecided':    { label: 'Undecided',       icon: '🤔', color: 'bg-rally-yellow text-rally-navy' },
  'opposed':      { label: 'Not interested',  icon: '✋', color: 'bg-gray-200 text-rally-slate' },
  'left-message': { label: 'Left message',    icon: '📩', color: 'bg-rally-navy/10 text-rally-navy' },
  'no-answer':    { label: 'No answer',       icon: '📵', color: 'bg-rally-navy/10 text-rally-navy' },
}

export default function VoterCard({
  result, showContactToggle, onContactToggle, contacted, outreachMethod,
  contactOutcome, onOutcomeSelect, onRecontact, notes, onNotesChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [localNotes, setLocalNotes] = useState(notes ?? '')
  const { personEntry, bestMatch, voteScore, segment, status } = result

  const segmentStyles = {
    'super-voter': 'border-l-rally-green bg-white',
    'sometimes-voter': 'border-l-rally-yellow bg-white',
    'rarely-voter': 'border-l-rally-red bg-white',
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
          <h3 className="font-bold text-rally-navy">
            {personEntry.firstName} {personEntry.lastName}
            {contacted && contactOutcome && !isRecontact && (
              <span className={clsx('ml-2 text-xs font-mono px-2 py-0.5 rounded-full', OUTCOME_CONFIG[contactOutcome].color)}>
                {OUTCOME_CONFIG[contactOutcome].icon} {OUTCOME_CONFIG[contactOutcome].label}
              </span>
            )}
          </h3>
          {bestMatch && (
            <p className="text-sm text-rally-slate-light">
              {bestMatch.city}, {bestMatch.state}
            </p>
          )}
          {status === 'unmatched' && (
            <p className="text-sm text-rally-slate-light">Not found in voter file</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {voteScore !== undefined && (
            <div className="text-right">
              <div className={clsx(
                'text-lg font-bold font-mono',
                segment === 'super-voter' ? 'text-rally-green' :
                  segment === 'sometimes-voter' ? 'text-rally-slate' :
                    'text-rally-red'
              )}>
                {Math.round(voteScore * 100)}%
              </div>
              <div className="text-[10px] text-rally-slate-light uppercase tracking-wide">vote rate</div>
            </div>
          )}
        </div>
      </div>

      {/* Outreach method selector — show for uncontacted people (matched or not) */}
      {showContactToggle && !contacted && (
        <div className="flex gap-2 mt-3">
          {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, { label: string; icon: string }][]).map(([method, { label, icon }]) => (
            <button
              key={method}
              onClick={() => onContactToggle?.(method)}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-bold border border-gray-200 hover:border-rally-navy hover:bg-rally-navy hover:text-white transition-all"
            >
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {/* After contact: show outreach method used */}
      {contacted && outreachMethod && !contactOutcome && (
        <div className="mt-2 text-xs text-rally-slate-light">
          Reached via {OUTREACH_LABELS[outreachMethod].icon} {OUTREACH_LABELS[outreachMethod].label}
        </div>
      )}

      {/* Outcome selector — show after contacted but before outcome is set */}
      {contacted && !contactOutcome && onOutcomeSelect && (
        <div className="mt-3 animate-fade-in">
          <p className="text-xs font-bold text-rally-slate-light uppercase tracking-wider mb-2">
            How did it go?
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, icon }]) => (
              <button
                key={outcome}
                onClick={() => onOutcomeSelect(outcome)}
                className="py-1.5 px-3 rounded-lg text-xs font-bold border border-gray-200 hover:border-rally-navy hover:bg-rally-navy hover:text-white transition-all"
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Re-contact button for left-message / no-answer */}
      {contacted && isRecontact && onRecontact && (
        <div className="flex items-center gap-3 mt-3">
          <span className={clsx('text-xs font-mono px-2 py-0.5 rounded-full', OUTCOME_CONFIG[contactOutcome!].color)}>
            {OUTCOME_CONFIG[contactOutcome!].icon} {OUTCOME_CONFIG[contactOutcome!].label}
          </span>
          <button
            onClick={onRecontact}
            className="text-xs font-bold text-rally-red hover:underline transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Notes textarea — visible after contact */}
      {contacted && onNotesChange && (
        <div className="mt-3">
          <textarea
            value={localNotes}
            onChange={e => setLocalNotes(e.target.value)}
            onBlur={() => onNotesChange(localNotes)}
            placeholder="How did the conversation go? Any follow-up needed?"
            className="w-full p-2.5 border border-gray-200 rounded-lg text-xs text-rally-slate focus:outline-none focus:ring-2 focus:ring-rally-red resize-none"
            rows={2}
          />
        </div>
      )}

      {/* Contacted + outcome set: show method */}
      {contacted && contactOutcome && outreachMethod && !isRecontact && (
        <div className="mt-2 text-xs text-rally-slate-light">
          Reached via {OUTREACH_LABELS[outreachMethod].icon} {OUTREACH_LABELS[outreachMethod].label}
        </div>
      )}

      {/* Expandable details */}
      {bestMatch && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-rally-slate-light hover:text-rally-navy mt-2 transition-colors font-mono"
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
                  voted ? 'bg-rally-green text-white font-bold' : 'bg-gray-100 text-gray-400'
                )}
              >
                <div>{year}</div>
                <div>{type.slice(0, 3)}</div>
              </div>
            ))}
          </div>

          {/* Relationship tip */}
          <div className="bg-rally-navy/5 rounded-lg p-3">
            <p className="text-xs text-rally-slate leading-relaxed">{relationshipTip}</p>
          </div>
        </div>
      )}
    </div>
  )
}
