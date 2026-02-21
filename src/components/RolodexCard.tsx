'use client'
import { useState, useMemo } from 'react'
import { MessageCircle, Phone, Coffee, ThumbsUp, HelpCircle, ThumbsDown, Mail, PhoneOff, Smartphone } from 'lucide-react'
import { ActionPlanItem, OutreachMethod, ContactOutcome, VoterSegment } from '@/types'
import { useAppContext } from '@/context/AppContext'
import { CONVERSATION_SCRIPTS } from '@/lib/scripts'
import { getVoteHistoryDetail } from '@/lib/voter-segments'
import { getRelationshipTip } from '@/lib/scripts'
import { generateSmsLinkForContact, getSmsTemplate, fillTemplate } from '@/lib/sms-templates'
import ScriptCard from './ScriptCard'
import clsx from 'clsx'

const OUTREACH_LABELS: Record<OutreachMethod, { label: string; Icon: typeof MessageCircle }> = {
  text: { label: 'Text', Icon: MessageCircle },
  call: { label: 'Call', Icon: Phone },
  'one-on-one': { label: '1:1 meetup', Icon: Coffee },
}

const OUTCOME_CONFIG: Record<ContactOutcome, { label: string; Icon: typeof MessageCircle; color: string }> = {
  'supporter':    { label: 'Supporter',       Icon: ThumbsUp,   color: 'bg-vc-teal text-white' },
  'undecided':    { label: 'Undecided',       Icon: HelpCircle, color: 'bg-vc-gold text-vc-purple' },
  'opposed':      { label: 'Not interested',  Icon: ThumbsDown, color: 'bg-gray-200 text-vc-slate' },
  'left-message': { label: 'Left message',    Icon: Mail,       color: 'bg-vc-purple/10 text-vc-purple' },
  'no-answer':    { label: 'No answer',       Icon: PhoneOff,   color: 'bg-vc-purple/10 text-vc-purple' },
}

const SEGMENT_LABELS: Record<VoterSegment, { label: string; color: string }> = {
  'rarely-voter': { label: 'Rarely Votes', color: 'text-vc-coral' },
  'sometimes-voter': { label: 'Sometimes Votes', color: 'text-vc-gold' },
  'super-voter': { label: 'Super Voter', color: 'text-vc-teal' },
}

type CardStep = 'prep' | 'log'

function sortForRolodex(items: ActionPlanItem[]): ActionPlanItem[] {
  const segmentOrder: Record<string, number> = {
    'rarely-voter': 0,
    'sometimes-voter': 1,
    'super-voter': 2,
  }

  return [...items].sort((a, b) => {
    // Uncontacted first
    if (!a.contacted && b.contacted) return -1
    if (a.contacted && !b.contacted) return 1

    // Among contacted: re-contact candidates before completed
    const aRecontact = a.contactOutcome === 'left-message' || a.contactOutcome === 'no-answer'
    const bRecontact = b.contactOutcome === 'left-message' || b.contactOutcome === 'no-answer'
    if (aRecontact && !bRecontact) return -1
    if (!aRecontact && bRecontact) return 1

    // By segment priority
    const aOrder = a.matchResult.segment ? segmentOrder[a.matchResult.segment] ?? 3 : 3
    const bOrder = b.matchResult.segment ? segmentOrder[b.matchResult.segment] ?? 3 : 3
    return aOrder - bOrder
  })
}

export default function RolodexCard() {
  const { state, toggleContacted, setContactOutcome, clearContact, updateNote } = useAppContext()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [step, setStep] = useState<CardStep>('prep')
  const [selectedMethod, setSelectedMethod] = useState<OutreachMethod | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<ContactOutcome | null>(null)
  const [noteText, setNoteText] = useState('')

  const sortedItems = useMemo(() => sortForRolodex(state.actionPlanState), [state.actionPlanState])

  if (sortedItems.length === 0) return null

  const safeIndex = Math.min(currentIndex, sortedItems.length - 1)
  const item = sortedItems[safeIndex]
  const { matchResult } = item
  const { personEntry, bestMatch, voteScore, segment, status } = matchResult
  const voteHistory = bestMatch ? getVoteHistoryDetail(bestMatch) : []
  const relationshipTip = getRelationshipTip(personEntry.category)

  const totalRemaining = sortedItems.filter(i => !i.contacted || i.contactOutcome === 'left-message' || i.contactOutcome === 'no-answer').length
  const totalDone = sortedItems.filter(i => i.contacted && i.contactOutcome && i.contactOutcome !== 'left-message' && i.contactOutcome !== 'no-answer').length

  function handleMethodSelect(method: OutreachMethod) {
    setSelectedMethod(method)
    toggleContacted(personEntry.id, method)
    setStep('log')
  }

  function handleSaveAndNext() {
    if (selectedOutcome) {
      setContactOutcome(personEntry.id, selectedOutcome)
    }
    if (noteText.trim()) {
      updateNote(personEntry.id, noteText.trim())
    }
    advanceToNext()
  }

  function handleSkip() {
    advanceToNext()
  }

  function advanceToNext() {
    setStep('prep')
    setSelectedMethod(null)
    setSelectedOutcome(null)
    setNoteText('')
    if (safeIndex < sortedItems.length - 1) {
      setCurrentIndex(safeIndex + 1)
    }
  }

  function handleBack() {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1)
      setStep('prep')
      setSelectedMethod(null)
      setSelectedOutcome(null)
      setNoteText('')
    }
  }

  // If this person was already contacted but needs re-contact, show re-contact prompt
  const isRecontact = item.contacted && (item.contactOutcome === 'left-message' || item.contactOutcome === 'no-answer')
  const isFullyDone = item.contacted && item.contactOutcome && !isRecontact

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm font-display text-vc-gray">
          <span className="text-vc-purple font-bold">{safeIndex + 1}</span> of {sortedItems.length}
        </p>
        <p className="text-sm font-display text-vc-gray">
          <span className="text-vc-teal font-bold">{totalDone}</span> done · <span className="text-vc-coral font-bold">{totalRemaining}</span> to go
        </p>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gray-200 rounded-full h-2 flex-1">
          <div
            className="bg-vc-teal h-2 rounded-full transition-all duration-500"
            style={{ width: `${sortedItems.length > 0 ? ((safeIndex + 1) / sortedItems.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-display text-vc-gray whitespace-nowrap">
          Card {safeIndex + 1} of {sortedItems.length}
        </span>
      </div>

      {/* Card */}
      <div className={clsx(
        'bg-white rounded-xl shadow-lg border-l-4 p-6 transition-all',
        status === 'unmatched' ? 'border-l-gray-300' :
          segment === 'rarely-voter' ? 'border-l-vc-coral' :
            segment === 'sometimes-voter' ? 'border-l-vc-gold' :
              segment === 'super-voter' ? 'border-l-vc-teal' : 'border-l-gray-300',
        isFullyDone && 'opacity-50'
      )}>
        {/* Person header */}
        <div className="mb-4">
          <h2 className="font-display text-2xl font-bold text-vc-purple">
            {personEntry.firstName} {personEntry.lastName}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            {bestMatch && (
              <span className="text-sm text-vc-gray">{bestMatch.city}, {bestMatch.state}</span>
            )}
            {segment && (
              <span className={clsx('text-xs font-display font-bold', SEGMENT_LABELS[segment].color)}>
                {SEGMENT_LABELS[segment].label}
              </span>
            )}
            {status === 'unmatched' && (
              <span className="text-xs font-display text-vc-gray">Not in voter file</span>
            )}
          </div>
          {voteScore !== undefined && (
            <div className="mt-2">
              <span className={clsx(
                'text-2xl font-bold font-display',
                segment === 'super-voter' ? 'text-vc-teal' :
                  segment === 'sometimes-voter' ? 'text-vc-slate' : 'text-vc-coral'
              )}>
                {Math.round(voteScore * 100)}%
              </span>
              <span className="text-xs text-vc-gray ml-2">vote rate</span>
            </div>
          )}
        </div>

        {/* Vote history */}
        {voteHistory.length > 0 && (
          <div className="grid grid-cols-6 gap-1 mb-4">
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
        )}

        {/* Relationship tip */}
        <div className="bg-vc-purple/5 rounded-lg p-3 mb-4">
          <p className="text-xs text-vc-slate leading-relaxed">{relationshipTip}</p>
        </div>

        {/* Re-contact prompt */}
        {isRecontact && step === 'prep' && (
          <div className="bg-vc-gold/10 border border-vc-gold/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-bold text-vc-purple mb-2 flex items-center gap-1.5">
              Previously: {(() => { const { Icon } = OUTCOME_CONFIG[item.contactOutcome!]; return <Icon className="w-3.5 h-3.5" />; })()} {OUTCOME_CONFIG[item.contactOutcome!].label}
            </p>
            <button
              onClick={() => {
                clearContact(personEntry.id)
              }}
              className="text-sm font-bold text-vc-coral hover:underline"
            >
              Try reaching out again
            </button>
          </div>
        )}

        {/* Already done */}
        {isFullyDone && (
          <div className="bg-vc-teal/10 border border-vc-teal/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-bold text-vc-purple flex items-center gap-1.5">
              {(() => { const { Icon } = OUTCOME_CONFIG[item.contactOutcome!]; return <Icon className="w-3.5 h-3.5" />; })()} {OUTCOME_CONFIG[item.contactOutcome!].label}
            </p>
            {item.notes && <p className="text-xs text-vc-slate mt-1">{item.notes}</p>}
          </div>
        )}

        {/* STEP 1: Prep — conversation script + pick outreach method */}
        {step === 'prep' && !isFullyDone && !item.contacted && (
          <>
            {/* Script */}
            {segment && CONVERSATION_SCRIPTS[segment] && (
              <details className="mb-4">
                <summary className="text-sm text-vc-purple font-bold cursor-pointer hover:text-vc-coral transition-colors">
                  Conversation guide
                </summary>
                <div className="mt-3 relative">
                  <div className="max-h-[40vh] overflow-auto">
                    <div className="max-w-prose">
                      <ScriptCard script={CONVERSATION_SCRIPTS[segment]} personName={personEntry.firstName} />
                    </div>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                </div>
              </details>
            )}

            {/* Send Text button */}
            {(() => {
              const smsLink = personEntry.phone
                ? generateSmsLinkForContact(personEntry.phone, personEntry.firstName, 'Volunteer', segment)
                : null
              const smsPreview = fillTemplate(getSmsTemplate(segment), personEntry.firstName, 'Volunteer')
              return (
                <div className="mb-4">
                  <button
                    disabled={!personEntry.phone}
                    onClick={() => {
                      if (smsLink) {
                        window.open(smsLink, '_blank')
                        handleMethodSelect('text')
                      }
                    }}
                    className={clsx(
                      'w-full py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2',
                      personEntry.phone
                        ? 'bg-vc-teal text-white hover:bg-vc-teal/90'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <Smartphone className="w-4 h-4" /> {personEntry.phone ? 'Send Text' : 'Send Text (no phone number)'}
                  </button>
                  {personEntry.phone && (
                    <div className="mt-2 bg-vc-teal/5 border border-vc-teal/20 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-vc-gray uppercase tracking-wider mb-1">SMS preview</p>
                      <p className="text-xs text-vc-slate leading-relaxed max-w-prose">{smsPreview}</p>
                    </div>
                  )}
                </div>
              )
            })()}

            <p className="text-sm font-bold text-vc-purple mb-3">How will you reach out?</p>
            <div className="flex gap-2">
              {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, { label: string; Icon: typeof MessageCircle }][]).map(([method, { label, Icon }]) => (
                <button
                  key={method}
                  onClick={() => handleMethodSelect(method)}
                  className="flex-1 py-3 px-4 rounded-lg text-sm font-bold border-2 border-gray-200 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 2: Log — outcome + notes */}
        {step === 'log' && (
          <div className="animate-fade-in">
            <p className="text-sm font-bold text-vc-purple mb-3">
              How did it go with {personEntry.firstName}?
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, Icon, color }]) => (
                <button
                  key={outcome}
                  onClick={() => setSelectedOutcome(outcome)}
                  className={clsx(
                    'py-2 px-4 rounded-lg text-sm font-bold border-2 transition-all flex items-center gap-1.5',
                    selectedOutcome === outcome
                      ? `${color} border-transparent`
                      : 'border-gray-200 hover:border-vc-purple'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Notes from the conversation..."
              className="w-full p-3 border border-gray-200 rounded-lg text-sm text-vc-slate focus:outline-none focus:ring-2 focus:ring-vc-purple/30 resize-none mb-4"
              rows={3}
            />

            <button
              onClick={handleSaveAndNext}
              disabled={!selectedOutcome}
              className={clsx(
                'w-full py-3 rounded-lg text-sm font-bold transition-all',
                selectedOutcome
                  ? 'bg-vc-purple text-white hover:bg-vc-purple-light'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              Save & Next
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={handleBack}
          disabled={safeIndex === 0}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-bold transition-all',
            safeIndex > 0 ? 'text-vc-purple hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
          )}
        >
          &larr; Back
        </button>

        <button
          onClick={handleSkip}
          className="px-4 py-2 rounded-lg text-sm font-bold text-vc-gray hover:text-vc-purple hover:bg-gray-100 transition-all"
        >
          Skip &rarr;
        </button>
      </div>
    </div>
  )
}
