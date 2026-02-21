'use client'
import { useState, useMemo } from 'react'
import { ActionPlanItem, OutreachMethod, ContactOutcome, VoterSegment } from '@/types'
import { useAppContext } from '@/context/AppContext'
import { CONVERSATION_SCRIPTS } from '@/lib/scripts'
import { getVoteHistoryDetail } from '@/lib/voter-segments'
import { getRelationshipTip } from '@/lib/scripts'
import { generateSmsLinkForContact, getSmsTemplate, fillTemplate } from '@/lib/sms-templates'
import ScriptCard from './ScriptCard'
import clsx from 'clsx'

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

const SEGMENT_LABELS: Record<VoterSegment, { label: string; color: string }> = {
  'rarely-voter': { label: 'Rarely Votes', color: 'text-rally-red' },
  'sometimes-voter': { label: 'Sometimes Votes', color: 'text-rally-yellow' },
  'super-voter': { label: 'Super Voter', color: 'text-rally-green' },
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
        <p className="text-sm font-mono text-rally-slate-light">
          <span className="text-rally-navy font-bold">{safeIndex + 1}</span> of {sortedItems.length}
        </p>
        <p className="text-sm font-mono text-rally-slate-light">
          <span className="text-rally-green font-bold">{totalDone}</span> done · <span className="text-rally-red font-bold">{totalRemaining}</span> to go
        </p>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gray-200 rounded-full h-2 flex-1">
          <div
            className="bg-rally-green h-2 rounded-full transition-all duration-500"
            style={{ width: `${sortedItems.length > 0 ? ((safeIndex + 1) / sortedItems.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-mono text-rally-slate-light whitespace-nowrap">
          Card {safeIndex + 1} of {sortedItems.length}
        </span>
      </div>

      {/* Card */}
      <div className={clsx(
        'bg-white rounded-xl shadow-lg border-l-4 p-6 transition-all',
        status === 'unmatched' ? 'border-l-gray-300' :
          segment === 'rarely-voter' ? 'border-l-rally-red' :
            segment === 'sometimes-voter' ? 'border-l-rally-yellow' :
              segment === 'super-voter' ? 'border-l-rally-green' : 'border-l-gray-300',
        isFullyDone && 'opacity-50'
      )}>
        {/* Person header */}
        <div className="mb-4">
          <h2 className="font-display text-2xl font-bold text-rally-navy">
            {personEntry.firstName} {personEntry.lastName}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            {bestMatch && (
              <span className="text-sm text-rally-slate-light">{bestMatch.city}, {bestMatch.state}</span>
            )}
            {segment && (
              <span className={clsx('text-xs font-mono font-bold', SEGMENT_LABELS[segment].color)}>
                {SEGMENT_LABELS[segment].label}
              </span>
            )}
            {status === 'unmatched' && (
              <span className="text-xs font-mono text-rally-slate-light">Not in voter file</span>
            )}
          </div>
          {voteScore !== undefined && (
            <div className="mt-2">
              <span className={clsx(
                'text-2xl font-bold font-mono',
                segment === 'super-voter' ? 'text-rally-green' :
                  segment === 'sometimes-voter' ? 'text-rally-slate' : 'text-rally-red'
              )}>
                {Math.round(voteScore * 100)}%
              </span>
              <span className="text-xs text-rally-slate-light ml-2">vote rate</span>
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
                  voted ? 'bg-rally-green text-white font-bold' : 'bg-gray-100 text-gray-400'
                )}
              >
                <div>{year}</div>
                <div>{type.slice(0, 3)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Relationship tip */}
        <div className="bg-rally-navy/5 rounded-lg p-3 mb-4">
          <p className="text-xs text-rally-slate leading-relaxed">{relationshipTip}</p>
        </div>

        {/* Re-contact prompt */}
        {isRecontact && step === 'prep' && (
          <div className="bg-rally-yellow/10 border border-rally-yellow/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-bold text-rally-navy mb-2">
              Previously: {OUTCOME_CONFIG[item.contactOutcome!].icon} {OUTCOME_CONFIG[item.contactOutcome!].label}
            </p>
            <button
              onClick={() => {
                clearContact(personEntry.id)
              }}
              className="text-sm font-bold text-rally-red hover:underline"
            >
              Try reaching out again
            </button>
          </div>
        )}

        {/* Already done */}
        {isFullyDone && (
          <div className="bg-rally-green/10 border border-rally-green/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-bold text-rally-navy">
              {OUTCOME_CONFIG[item.contactOutcome!].icon} {OUTCOME_CONFIG[item.contactOutcome!].label}
            </p>
            {item.notes && <p className="text-xs text-rally-slate mt-1">{item.notes}</p>}
          </div>
        )}

        {/* STEP 1: Prep — conversation script + pick outreach method */}
        {step === 'prep' && !isFullyDone && !item.contacted && (
          <>
            {/* Script */}
            {segment && CONVERSATION_SCRIPTS[segment] && (
              <details className="mb-4">
                <summary className="text-sm text-rally-navy font-bold cursor-pointer hover:text-rally-red transition-colors">
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
                      'w-full py-3 px-4 rounded-lg text-sm font-bold transition-all',
                      personEntry.phone
                        ? 'bg-rally-green text-white hover:bg-rally-green/90'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {personEntry.phone ? '📲 Send Text' : '📲 Send Text (no phone number)'}
                  </button>
                  {personEntry.phone && (
                    <div className="mt-2 bg-rally-green/5 border border-rally-green/20 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-rally-slate-light uppercase tracking-wider mb-1">SMS preview</p>
                      <p className="text-xs text-rally-slate leading-relaxed max-w-prose">{smsPreview}</p>
                    </div>
                  )}
                </div>
              )
            })()}

            <p className="text-sm font-bold text-rally-navy mb-3">How will you reach out?</p>
            <div className="flex gap-2">
              {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, { label: string; icon: string }][]).map(([method, { label, icon }]) => (
                <button
                  key={method}
                  onClick={() => handleMethodSelect(method)}
                  className="flex-1 py-3 px-4 rounded-lg text-sm font-bold border-2 border-gray-200 hover:border-rally-navy hover:bg-rally-navy hover:text-white transition-all"
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 2: Log — outcome + notes */}
        {step === 'log' && (
          <div className="animate-fade-in">
            <p className="text-sm font-bold text-rally-navy mb-3">
              How did it go with {personEntry.firstName}?
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, icon, color }]) => (
                <button
                  key={outcome}
                  onClick={() => setSelectedOutcome(outcome)}
                  className={clsx(
                    'py-2 px-4 rounded-lg text-sm font-bold border-2 transition-all',
                    selectedOutcome === outcome
                      ? `${color} border-transparent`
                      : 'border-gray-200 hover:border-rally-navy'
                  )}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Notes from the conversation..."
              className="w-full p-3 border border-gray-200 rounded-lg text-sm text-rally-slate focus:outline-none focus:ring-2 focus:ring-rally-red resize-none mb-4"
              rows={3}
            />

            <button
              onClick={handleSaveAndNext}
              disabled={!selectedOutcome}
              className={clsx(
                'w-full py-3 rounded-lg text-sm font-bold transition-all',
                selectedOutcome
                  ? 'bg-rally-navy text-white hover:bg-rally-navy-light'
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
            safeIndex > 0 ? 'text-rally-navy hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
          )}
        >
          &larr; Back
        </button>

        <button
          onClick={handleSkip}
          className="px-4 py-2 rounded-lg text-sm font-bold text-rally-slate-light hover:text-rally-navy hover:bg-gray-100 transition-all"
        >
          Skip &rarr;
        </button>
      </div>
    </div>
  )
}
