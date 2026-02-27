'use client'
import { useState } from 'react'
import { SpreadsheetRow, OutreachMethod, ContactOutcome, SafeVoterRecord } from '@/types'
import { CATEGORIES } from '@/lib/wizard-config'
import { generateSmsLinkForContact } from '@/lib/sms-templates'
import { getRegistrationUrl } from './VoterRegistrationLinks'
import { useAuth } from '@/context/AuthContext'
import defaultCampaignConfig from '@/lib/campaign-config'
import { MessageCircle, Phone, Coffee, ThumbsUp, HelpCircle, ThumbsDown, Mail, PhoneOff, Smartphone, X, UserPlus, Star, ClipboardList, Share2, Check } from 'lucide-react'
import clsx from 'clsx'

const OUTREACH_LABELS: Record<OutreachMethod, { label: string; Icon: typeof MessageCircle; tip: string }> = {
  text: { label: 'Text', Icon: MessageCircle, tip: 'Send a text message' },
  call: { label: 'Call', Icon: Phone, tip: 'Give them a call' },
  'one-on-one': { label: '1:1', Icon: Coffee, tip: 'Meet up in person' },
}

const OUTCOME_CONFIG: Record<ContactOutcome, { label: string; Icon: typeof ThumbsUp; color: string; tip: string }> = {
  'supporter': { label: 'Supporter', Icon: ThumbsUp, color: 'bg-vc-teal text-white', tip: 'They\'re on board!' },
  'undecided': { label: 'Undecided', Icon: HelpCircle, color: 'bg-vc-gold text-white', tip: 'Not sure yet' },
  'opposed': { label: 'Opposed', Icon: ThumbsDown, color: 'bg-white/10 text-white/60', tip: 'Not interested' },
  'left-message': { label: 'Left msg', Icon: Mail, color: 'bg-vc-purple/10 text-vc-purple-light', tip: 'Left a voicemail' },
  'no-answer': { label: 'No answer', Icon: PhoneOff, color: 'bg-vc-purple/10 text-vc-purple-light', tip: 'Didn\'t pick up' },
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
  onSurveyChange: (personId: string, responses: Record<string, string>) => void
}

export default function ContactCard({
  row, onToggleContacted, onOutcomeSelect, onRecontact, onNotesChange,
  onRemove, onConfirmMatch, onRejectMatch, onVolunteerRecruit, onSurveyChange,
}: Props) {
  const { person, matchResult, actionItem } = row
  const { user, campaignConfig: authConfig } = useAuth()
  const campaignConfig = authConfig || defaultCampaignConfig
  const [localNotes, setLocalNotes] = useState(actionItem?.notes ?? '')
  const [showCandidates, setShowCandidates] = useState(false)
  const [regLinkSent, setRegLinkSent] = useState(false)

  const bestMatch = matchResult?.bestMatch
  const segment = matchResult?.segment
  const voteScore = matchResult?.voteScore
  const status = matchResult?.status
  const contacted = actionItem?.contacted ?? false
  const outreachMethod = actionItem?.outreachMethod
  const contactOutcome = actionItem?.contactOutcome
  const outcomeValid = contactOutcome && contactOutcome in OUTCOME_CONFIG
  const isRecontact = contactOutcome === 'left-message' || contactOutcome === 'no-answer'

  const catConfig = CATEGORIES.find(c => c.id === person.category)

  const isNew = person.createdAt && (Date.now() - person.createdAt) < 30000

  const segmentDot = segment === 'super-voter' ? 'bg-vc-teal' :
    segment === 'sometimes-voter' ? 'bg-vc-gold' :
    segment === 'rarely-voter' ? 'bg-vc-coral' : 'bg-gray-300'

  const segmentColor = segment === 'super-voter' ? 'text-vc-teal' :
    segment === 'sometimes-voter' ? 'text-vc-gold' :
    segment === 'rarely-voter' ? 'text-vc-coral' : 'text-white/40'

  return (
    <div className={clsx(
      'glass-card p-5',
      contacted && contactOutcome && !isRecontact && 'opacity-75',
      isNew && 'ring-2 ring-vc-teal/30 animate-fade-in'
    )}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className={clsx('w-2 h-2 rounded-full', segmentDot)} />
            <h3 className="font-bold text-white text-base md:text-lg">
              {person.firstName} {person.lastName}
            </h3>
            {isNew && (
              <span className="text-[9px] font-bold bg-vc-teal text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                New
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 ml-4">
            <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full capitalize">
              {catConfig?.id.replace(/-/g, ' ')}
            </span>
            {bestMatch?.city && (
              <span className="text-xs text-white/70">{bestMatch.city}</span>
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
          <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">Not matched yet</span>
        )}
        {status === 'confirmed' && (
          <span className="text-[10px] font-bold text-vc-teal bg-vc-teal/10 px-2 py-0.5 rounded-full">Matched</span>
        )}
        {status === 'unmatched' && (
          <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">No match</span>
        )}
        {status === 'unmatched' && !regLinkSent && (
          <button
            onClick={async () => {
              const regUrl = getRegistrationUrl(campaignConfig.state)
              const text = `Hey ${person.firstName}, make sure you're registered to vote! Check here: ${regUrl}`
              if (navigator.share) {
                try {
                  await navigator.share({ text })
                  setRegLinkSent(true)
                } catch { /* user cancelled share */ }
              } else {
                await navigator.clipboard.writeText(text)
                setRegLinkSent(true)
              }
            }}
            className="text-[10px] font-bold text-vc-teal bg-vc-teal/10 px-2 py-0.5 rounded-full hover:bg-vc-teal/20 transition-colors inline-flex items-center gap-1"
          >
            <Share2 className="w-3 h-3" />
            Send Registration Link
          </button>
        )}
        {status === 'unmatched' && regLinkSent && (
          <span className="text-[10px] font-bold text-vc-teal bg-vc-teal/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <Check className="w-3 h-3" />
            Reg link sent
          </span>
        )}
        {status === 'ambiguous' && (
          <div className="relative" style={{ zIndex: showCandidates ? 50 : 'auto' }}>
            <button
              onClick={() => setShowCandidates(!showCandidates)}
              className="text-[10px] font-bold text-vc-gold bg-vc-gold/20 px-2 py-0.5 rounded-full hover:bg-vc-gold/30 transition-colors"
            >
              Pick match
            </button>
            {showCandidates && matchResult?.candidates && (
              <>
                {/* Backdrop to close dropdown when clicking outside */}
                <div className="fixed inset-0 z-40" onClick={() => setShowCandidates(false)} />
                <div className="absolute z-50 top-full mt-1 right-0 glass-card bg-vc-surface/95 backdrop-blur-xl p-2 min-w-[280px] shadow-xl border border-white/20">
                {matchResult.candidates.map((c, i) => {
                  const age = c.voterRecord.birth_year ? new Date().getFullYear() - parseInt(c.voterRecord.birth_year) : null
                  return (
                    <button
                      key={i}
                      onClick={() => { onConfirmMatch(person.id, c.voterRecord); setShowCandidates(false) }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 rounded transition-colors"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-white">{c.voterRecord.first_name} {c.voterRecord.last_name}</span>
                        <span className="text-white/40 ml-2">{Math.round(c.score * 100)}%</span>
                      </div>
                      <div className="text-white/40 mt-0.5">
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
              </>
            )}
          </div>
        )}
        {contacted && outcomeValid && (
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1', OUTCOME_CONFIG[contactOutcome].color)}>
            {(() => { const OIcon = OUTCOME_CONFIG[contactOutcome].Icon; return <OIcon className="w-3 h-3" /> })()}
            {OUTCOME_CONFIG[contactOutcome].label}
          </span>
        )}
        {contacted && outcomeValid && isRecontact && (
          <button
            onClick={() => onRecontact(person.id)}
            className="text-[10px] text-vc-coral hover:underline font-bold"
          >
            Try again
          </button>
        )}
        {contacted && outcomeValid && contactOutcome === 'supporter' && !actionItem?.isVolunteerProspect && (
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
                className="flex-1 py-2 rounded-btn text-xs font-bold border border-white/15 text-white/70 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center justify-center gap-1.5"
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
                const smsLink = generateSmsLinkForContact(person.phone!, person.firstName, user?.name ?? '', matchResult?.segment, campaignConfig.electionDate)
                window.open(smsLink, '_blank')
                onToggleContacted(person.id, 'text')
              }}
              className="w-full py-2 rounded-btn text-xs font-bold bg-vc-teal/15 text-vc-teal border border-vc-teal/30 hover:bg-vc-teal hover:text-white transition-all flex items-center justify-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Send Text
            </button>
          ) : (
            <button
              disabled
              title="Add phone to text"
              className="w-full py-2 rounded-btn text-xs font-bold bg-white/5 text-white/20 border border-white/10 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Send Text
            </button>
          )}
        </div>
      )}

      {/* Outreach method used */}
      {contacted && outreachMethod && (
        <p className="text-[10px] text-white/60 mb-2 flex items-center gap-1">
          Via {(() => { const MIcon = OUTREACH_LABELS[outreachMethod].Icon; return <MIcon className="w-3 h-3" /> })()}
          {OUTREACH_LABELS[outreachMethod].label}
        </p>
      )}

      {/* Outcome selector */}
      {contacted && !outcomeValid && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">How did it go?</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, Icon, tip }]) => (
              <button
                key={outcome}
                onClick={() => onOutcomeSelect(person.id, outcome)}
                className="py-1.5 px-2.5 rounded-btn text-[10px] font-bold border border-white/15 text-white/70 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center gap-1"
                title={tip}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Survey questions — show after outcome is recorded */}
      {contacted && outcomeValid && contactOutcome !== 'no-answer' && contactOutcome !== 'left-message' && campaignConfig.surveyQuestions.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1">
            <ClipboardList className="w-3 h-3" />
            Quick survey
          </p>
          <div className="flex flex-wrap gap-2">
            {campaignConfig.surveyQuestions.map(q => (
              <div key={q.id} className="flex-1 min-w-[120px]">
                <label className="text-[10px] text-white/50 block mb-0.5">{q.label}</label>
                {q.type === 'select' && q.options ? (
                  <select
                    value={actionItem?.surveyResponses?.[q.id] ?? ''}
                    onChange={e => {
                      const updated = { ...(actionItem?.surveyResponses || {}), [q.id]: e.target.value }
                      onSurveyChange(person.id, updated)
                    }}
                    className="glass-input w-full px-2 py-1.5 rounded-btn text-[10px]"
                  >
                    <option value="">—</option>
                    {q.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={actionItem?.surveyResponses?.[q.id] ?? ''}
                    onChange={e => {
                      const updated = { ...(actionItem?.surveyResponses || {}), [q.id]: e.target.value }
                      onSurveyChange(person.id, updated)
                    }}
                    className="glass-input w-full px-2 py-1.5 rounded-btn text-[10px]"
                    placeholder={q.label}
                  />
                )}
              </div>
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
        className="glass-input w-full px-3 py-2 rounded-btn text-xs focus:outline-none focus:ring-2 focus:ring-vc-purple/30"
      />
    </div>
  )
}
