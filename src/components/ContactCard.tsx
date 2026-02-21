'use client'
import { useState } from 'react'
import { SpreadsheetRow, OutreachMethod, ContactOutcome, SafeVoterRecord } from '@/types'
import { CATEGORIES } from '@/lib/wizard-config'
import { generateSmsLinkForContact } from '@/lib/sms-templates'
import { useAuth } from '@/context/AuthContext'
import { MessageCircle, Phone, Coffee, ThumbsUp, HelpCircle, ThumbsDown, Mail, PhoneOff, Smartphone, X, UserPlus, Star } from 'lucide-react'
import clsx from 'clsx'

const OUTREACH_LABELS: Record<OutreachMethod, { label: string; Icon: typeof MessageCircle; tip: string }> = {
  text: { label: 'Text', Icon: MessageCircle, tip: 'Send a text message' },
  call: { label: 'Call', Icon: Phone, tip: 'Give them a call' },
  'one-on-one': { label: '1:1', Icon: Coffee, tip: 'Meet up in person' },
}

const OUTCOME_CONFIG: Record<ContactOutcome, { label: string; Icon: typeof ThumbsUp; color: string; tip: string }> = {
  'supporter': { label: 'Supporter', Icon: ThumbsUp, color: 'bg-vc-teal text-white', tip: 'They\'re on board!' },
  'undecided': { label: 'Undecided', Icon: HelpCircle, color: 'bg-vc-gold text-white', tip: 'Not sure yet' },
  'opposed': { label: 'Opposed', Icon: ThumbsDown, color: 'bg-gray-200 text-vc-slate', tip: 'Not interested' },
  'left-message': { label: 'Left msg', Icon: Mail, color: 'bg-vc-purple/10 text-vc-purple', tip: 'Left a voicemail' },
  'no-answer': { label: 'No answer', Icon: PhoneOff, color: 'bg-vc-purple/10 text-vc-purple', tip: 'Didn\'t pick up' },
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

  const segmentDot = segment === 'super-voter' ? 'bg-vc-teal' :
    segment === 'sometimes-voter' ? 'bg-vc-gold' :
    segment === 'rarely-voter' ? 'bg-vc-coral' : 'bg-gray-300'

  const segmentColor = segment === 'super-voter' ? 'text-vc-teal' :
    segment === 'sometimes-voter' ? 'text-vc-gold' :
    segment === 'rarely-voter' ? 'text-vc-coral' : 'text-vc-gray'

  return (
    <div className={clsx(
      'glass-card p-4',
      contacted && contactOutcome && !isRecontact && 'opacity-50',
      isNew && 'ring-2 ring-vc-teal/30 animate-fade-in'
    )}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className={clsx('w-2 h-2 rounded-full', segmentDot)} />
            <h3 className="font-bold text-vc-slate text-sm">
              {person.firstName} {person.lastName}
            </h3>
            {isNew && (
              <span className="text-[9px] font-bold bg-vc-teal text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                New
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 ml-4">
            <span className="text-[10px] bg-vc-purple/5 text-vc-gray px-2 py-0.5 rounded-full capitalize">
              {catConfig?.id.replace(/-/g, ' ')}
            </span>
            {bestMatch?.city && (
              <span className="text-xs text-vc-gray">{bestMatch.city}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {voteScore !== undefined && (
            <span className={clsx('font-display font-bold text-lg', segmentColor)}>
              {Math.round(voteScore * 100)}%
            </span>
          )}
          <button
            onClick={() => onRemove(person.id)}
            className="text-vc-coral/30 hover:text-vc-coral transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Match status */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {!matchResult && (
          <span className="text-[10px] text-vc-gray bg-gray-100 px-2 py-0.5 rounded-full">Not matched yet</span>
        )}
        {status === 'confirmed' && (
          <span className="text-[10px] font-bold text-vc-teal bg-vc-teal/10 px-2 py-0.5 rounded-full">Matched</span>
        )}
        {status === 'unmatched' && (
          <span className="text-[10px] font-bold text-vc-gray bg-gray-100 px-2 py-0.5 rounded-full">No match</span>
        )}
        {status === 'ambiguous' && (
          <div className="relative">
            <button
              onClick={() => setShowCandidates(!showCandidates)}
              className="text-[10px] font-bold text-vc-gold bg-vc-gold/20 px-2 py-0.5 rounded-full hover:bg-vc-gold/30 transition-colors"
            >
              Pick match
            </button>
            {showCandidates && matchResult?.candidates && (
              <div className="absolute z-20 top-full mt-1 left-0 bg-white rounded-card shadow-lifted border border-gray-200 p-2 min-w-[280px]">
                {matchResult.candidates.map((c, i) => {
                  const age = c.voterRecord.birth_year ? new Date().getFullYear() - parseInt(c.voterRecord.birth_year) : null
                  return (
                    <button
                      key={i}
                      onClick={() => { onConfirmMatch(person.id, c.voterRecord); setShowCandidates(false) }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-vc-purple/5 rounded transition-colors"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold">{c.voterRecord.first_name} {c.voterRecord.last_name}</span>
                        <span className="text-vc-gray ml-2">{Math.round(c.score * 100)}%</span>
                      </div>
                      <div className="text-vc-gray mt-0.5">
                        {c.voterRecord.residential_address}, {c.voterRecord.city}
                        {age && <span className="ml-1">&middot; Age {age}</span>}
                      </div>
                    </button>
                  )
                })}
                <button
                  onClick={() => { onRejectMatch(person.id); setShowCandidates(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-vc-coral hover:bg-vc-coral/5 rounded transition-colors font-bold"
                >
                  None of these
                </button>
              </div>
            )}
          </div>
        )}
        {contacted && contactOutcome && (
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1', OUTCOME_CONFIG[contactOutcome].color)}>
            {(() => { const OIcon = OUTCOME_CONFIG[contactOutcome].Icon; return <OIcon className="w-3 h-3" /> })()}
            {OUTCOME_CONFIG[contactOutcome].label}
          </span>
        )}
        {contacted && contactOutcome && isRecontact && (
          <button
            onClick={() => onRecontact(person.id)}
            className="text-[10px] text-vc-coral hover:underline font-bold"
          >
            Try again
          </button>
        )}
        {contacted && contactOutcome === 'supporter' && !actionItem?.isVolunteerProspect && (
          <button
            onClick={() => onVolunteerRecruit(person.id)}
            className="text-[10px] text-vc-purple bg-vc-purple/10 hover:bg-vc-purple hover:text-white px-2 py-0.5 rounded-full font-bold transition-colors inline-flex items-center gap-1"
          >
            <UserPlus className="w-3 h-3" />
            Recruit
          </button>
        )}
        {actionItem?.isVolunteerProspect && (
          <span className="text-[10px] bg-vc-purple text-white px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
            <Star className="w-3 h-3" />
            Volunteer
          </span>
        )}
      </div>

      {/* Outreach buttons */}
      {!contacted && (
        <div className="space-y-2 mb-3">
          <div className="flex gap-2">
            {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, { label: string; Icon: typeof MessageCircle; tip: string }][]).map(([method, { label, Icon, tip }]) => (
              <button
                key={method}
                onClick={() => onToggleContacted(person.id, method)}
                className="flex-1 py-2 rounded-btn text-xs font-bold border border-gray-200 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center justify-center gap-1.5"
                title={tip}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
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
              className="w-full py-2 rounded-btn text-xs font-bold bg-vc-teal/10 text-vc-teal border border-vc-teal/30 hover:bg-vc-teal hover:text-white transition-all flex items-center justify-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Send Text
            </button>
          ) : (
            <button
              disabled
              title="Add phone to text"
              className="w-full py-2 rounded-btn text-xs font-bold bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Send Text
            </button>
          )}
        </div>
      )}

      {/* Outreach method used */}
      {contacted && outreachMethod && (
        <p className="text-[10px] text-vc-gray mb-2 flex items-center gap-1">
          Via {(() => { const MIcon = OUTREACH_LABELS[outreachMethod].Icon; return <MIcon className="w-3 h-3" /> })()}
          {OUTREACH_LABELS[outreachMethod].label}
        </p>
      )}

      {/* Outcome selector */}
      {contacted && !contactOutcome && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-vc-gray uppercase tracking-wider mb-1.5">How did it go?</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, Icon, tip }]) => (
              <button
                key={outcome}
                onClick={() => onOutcomeSelect(person.id, outcome)}
                className="py-1.5 px-2.5 rounded-btn text-[10px] font-bold border border-gray-200 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center gap-1"
                title={tip}
              >
                <Icon className="w-3 h-3" />
                {label}
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
        className="w-full px-3 py-2 border border-gray-200 rounded-btn text-xs text-vc-slate focus:outline-none focus:ring-2 focus:ring-vc-purple/30"
      />
    </div>
  )
}
