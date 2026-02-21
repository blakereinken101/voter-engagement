'use client'
import { useState } from 'react'
import { SpreadsheetRow, OutreachMethod, ContactOutcome, SafeVoterRecord } from '@/types'
import { CATEGORIES } from '@/lib/wizard-config'
import { generateSmsLinkForContact } from '@/lib/sms-templates'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

const OUTREACH_LABELS: Record<OutreachMethod, { label: string; icon: string; tip: string }> = {
  text: { label: 'Text', icon: '💬', tip: 'Send a text message — casual and low-pressure' },
  call: { label: 'Call', icon: '📞', tip: 'Give them a call — more personal than texting' },
  'one-on-one': { label: '1:1', icon: '☕', tip: 'Meet up in person — the most persuasive approach' },
}

const OUTCOME_CONFIG: Record<ContactOutcome, { label: string; icon: string; color: string; tip: string }> = {
  'supporter': { label: 'Supporter', icon: '✊', color: 'bg-rally-green text-white', tip: 'They\'re on board and will vote!' },
  'undecided': { label: 'Undecided', icon: '🤔', color: 'bg-rally-yellow text-rally-navy', tip: 'Not sure yet — follow up closer to election day' },
  'opposed': { label: 'Opposed', icon: '✋', color: 'bg-gray-200 text-rally-slate', tip: 'Not interested — no need to push further' },
  'left-message': { label: 'Left msg', icon: '📩', color: 'bg-rally-navy/10 text-rally-navy', tip: 'Left a voicemail or message — try again later' },
  'no-answer': { label: 'No answer', icon: '📵', color: 'bg-rally-navy/10 text-rally-navy', tip: 'Didn\'t pick up — try a different time or method' },
}

interface Props {
  row: SpreadsheetRow
  onToggleContacted: (personId: string, method: OutreachMethod) => void
  onOutcomeSelect: (personId: string, outcome: ContactOutcome) => void
  onRecontact: (personId: string) => void
  onNotesChange: (personId: string, notes: string) => void
  onRemove: (personId: string) => void
  onConfirmMatch: (personId: string, voterRecord: SafeVoterRecord) => void
  onRejectMatch: (personId: string) => void
  onVolunteerRecruit: (personId: string) => void
}

export default function ContactCard({
  row, onToggleContacted, onOutcomeSelect, onRecontact, onNotesChange,
  onRemove, onConfirmMatch, onRejectMatch, onVolunteerRecruit,
}: Props) {
  const { person, matchResult, actionItem } = row
  const { user } = useAuth()
  const [localNotes, setLocalNotes] = useState(actionItem?.notes ?? '')
  const [showCandidates, setShowCandidates] = useState(false)

  const bestMatch = matchResult?.bestMatch
  const segment = matchResult?.segment
  const voteScore = matchResult?.voteScore
  const status = matchResult?.status
  const contacted = actionItem?.contacted ?? false
  const outreachMethod = actionItem?.outreachMethod
  const contactOutcome = actionItem?.contactOutcome
  const isRecontact = contactOutcome === 'left-message' || contactOutcome === 'no-answer'

  const catConfig = CATEGORIES.find(c => c.id === person.category)

  const isNew = person.createdAt && (Date.now() - person.createdAt) < 30000

  const segmentBorder = segment === 'super-voter' ? 'border-l-rally-green' :
    segment === 'sometimes-voter' ? 'border-l-rally-yellow' :
    segment === 'rarely-voter' ? 'border-l-rally-red' : 'border-l-gray-300'

  const segmentColor = segment === 'super-voter' ? 'text-rally-green' :
    segment === 'sometimes-voter' ? 'text-rally-yellow' :
    segment === 'rarely-voter' ? 'text-rally-red' : 'text-rally-slate-light'

  return (
    <div className={clsx(
      'rounded-lg border border-gray-200 p-4 border-l-4 bg-white shadow-sm',
      segmentBorder,
      contacted && contactOutcome && !isRecontact && 'opacity-50',
      isNew && 'ring-2 ring-rally-green/30 animate-fade-in'
    )}>
      {/* Header: Name + Score + Remove */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-rally-navy text-sm">
              {person.firstName} {person.lastName}
            </h3>
            {isNew && (
              <span className="text-[9px] font-bold bg-rally-green text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                New
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] bg-rally-navy/5 text-rally-slate px-2 py-0.5 rounded-full">
              {catConfig?.icon} {catConfig?.id.replace(/-/g, ' ')}
            </span>
            {bestMatch?.city && (
              <span className="text-xs text-rally-slate-light">{bestMatch.city}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {voteScore !== undefined && (
            <span className={clsx('font-mono font-bold text-lg', segmentColor)}>
              {Math.round(voteScore * 100)}%
            </span>
          )}
          <button
            onClick={() => onRemove(person.id)}
            className="text-rally-red/30 text-xs hover:text-rally-red transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Match status */}
      <div className="flex items-center gap-2 mb-3">
        {!matchResult && (
          <span className="text-[10px] text-rally-slate-light bg-gray-100 px-2 py-0.5 rounded-full">Not matched yet</span>
        )}
        {status === 'confirmed' && (
          <span className="text-[10px] font-bold text-rally-green bg-rally-green/10 px-2 py-0.5 rounded-full">Matched</span>
        )}
        {status === 'unmatched' && (
          <span className="text-[10px] font-bold text-rally-slate-light bg-gray-100 px-2 py-0.5 rounded-full">No match</span>
        )}
        {status === 'ambiguous' && (
          <div className="relative">
            <button
              onClick={() => setShowCandidates(!showCandidates)}
              className="text-[10px] font-bold text-rally-yellow bg-rally-yellow/20 px-2 py-0.5 rounded-full hover:bg-rally-yellow/30 transition-colors"
            >
              Pick match ▾
            </button>
            {showCandidates && matchResult?.candidates && (
              <div className="absolute z-20 top-full mt-1 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[280px]">
                {matchResult.candidates.map((c, i) => {
                  const age = c.voterRecord.birth_year ? new Date().getFullYear() - parseInt(c.voterRecord.birth_year) : null
                  return (
                    <button
                      key={i}
                      onClick={() => { onConfirmMatch(person.id, c.voterRecord); setShowCandidates(false) }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-rally-navy/5 rounded transition-colors"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold">{c.voterRecord.first_name} {c.voterRecord.last_name}</span>
                        <span className="text-rally-slate-light font-mono ml-2">{Math.round(c.score * 100)}%</span>
                      </div>
                      <div className="text-rally-slate-light mt-0.5">
                        {c.voterRecord.residential_address}, {c.voterRecord.city}
                        {age && <span className="ml-1">&middot; Age {age}</span>}
                      </div>
                    </button>
                  )
                })}
                <button
                  onClick={() => { onRejectMatch(person.id); setShowCandidates(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-rally-red hover:bg-rally-red/5 rounded transition-colors font-bold"
                >
                  None of these
                </button>
              </div>
            )}
          </div>
        )}
        {contacted && contactOutcome && (
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', OUTCOME_CONFIG[contactOutcome].color)}>
            {OUTCOME_CONFIG[contactOutcome].icon} {OUTCOME_CONFIG[contactOutcome].label}
          </span>
        )}
        {contacted && contactOutcome && isRecontact && (
          <button
            onClick={() => onRecontact(person.id)}
            className="text-[10px] text-rally-red hover:underline font-bold"
          >
            Try again
          </button>
        )}
        {contacted && contactOutcome === 'supporter' && !actionItem?.isVolunteerProspect && (
          <button
            onClick={() => onVolunteerRecruit(person.id)}
            className="text-[10px] text-rally-navy bg-rally-navy/10 hover:bg-rally-navy hover:text-white px-2 py-0.5 rounded-full font-bold transition-colors"
          >
            Recruit as Volunteer
          </button>
        )}
        {actionItem?.isVolunteerProspect && (
          <span className="text-[10px] bg-rally-navy text-white px-2 py-0.5 rounded-full font-bold">
            Volunteer
          </span>
        )}
      </div>

      {/* Outreach buttons — show for uncontacted */}
      {!contacted && (
        <div className="space-y-2 mb-3">
          <div className="flex gap-2">
            {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, { label: string; icon: string; tip: string }][]).map(([method, { label, icon, tip }]) => (
              <button
                key={method}
                onClick={() => onToggleContacted(person.id, method)}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-200 hover:border-rally-navy hover:bg-rally-navy hover:text-white transition-all"
                title={tip}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          {person.phone ? (
            <button
              onClick={() => {
                const smsLink = generateSmsLinkForContact(person.phone!, person.firstName, user?.name ?? '', matchResult?.segment)
                window.open(smsLink, '_blank')
                onToggleContacted(person.id, 'text')
              }}
              className="w-full py-2 rounded-lg text-xs font-bold bg-rally-green/10 text-rally-green border border-rally-green/30 hover:bg-rally-green hover:text-white transition-all"
            >
              Send Text
            </button>
          ) : (
            <button
              disabled
              title="Add phone to text"
              className="w-full py-2 rounded-lg text-xs font-bold bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed"
            >
              Send Text
            </button>
          )}
        </div>
      )}

      {/* Outreach method used */}
      {contacted && outreachMethod && (
        <p className="text-[10px] text-rally-slate-light mb-2">
          Via {OUTREACH_LABELS[outreachMethod].icon} {OUTREACH_LABELS[outreachMethod].label}
        </p>
      )}

      {/* Outcome selector — after contacted, before outcome set */}
      {contacted && !contactOutcome && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-rally-slate-light uppercase tracking-wider mb-1.5">How did it go?</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, icon, tip }]) => (
              <button
                key={outcome}
                onClick={() => onOutcomeSelect(person.id, outcome)}
                className="py-1.5 px-2.5 rounded-lg text-[10px] font-bold border border-gray-200 hover:border-rally-navy hover:bg-rally-navy hover:text-white transition-all"
                title={tip}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <input
        type="text"
        value={localNotes}
        onChange={e => setLocalNotes(e.target.value)}
        onBlur={() => onNotesChange(person.id, localNotes)}
        placeholder="Notes..."
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-rally-slate focus:outline-none focus:ring-1 focus:ring-rally-red"
      />
    </div>
  )
}
