'use client'
import { useState, useMemo } from 'react'
import { Smartphone } from 'lucide-react'
import { ActionPlanItem, OutreachMethod, ContactOutcome } from '@/types'
import { useAppContext } from '@/context/AppContext'
import { CONVERSATION_SCRIPTS } from '@/lib/scripts'
import { getVoteHistoryDetail } from '@/lib/voter-segments'
import { getRelationshipTip } from '@/lib/scripts'
import { generateSmsLinkForContact, getSmsTemplate, fillTemplate } from '@/lib/sms-templates'
import defaultCampaignConfig from '@/lib/campaign-config'
import { useAuth } from '@/context/AuthContext'
import {
  OUTCOME_CONFIG,
  OUTREACH_LABELS,
  SEGMENT_CONFIG,
  getSegmentColors,
  isRecontactOutcome,
} from '@/lib/contact-config'
import ScriptCard from './ScriptCard'
import clsx from 'clsx'

type CardStep = 'prep' | 'log'

function sortForRolodex(items: ActionPlanItem[]): ActionPlanItem[] {
  const segmentOrder: Record<string, number> = {
    'rarely-voter': 0,
    'sometimes-voter': 1,
    'super-voter': 2,
  }

  return [...items].sort((a, b) => {
    if (!a.contacted && b.contacted) return -1
    if (a.contacted && !b.contacted) return 1

    const aRecontact = isRecontactOutcome(a.contactOutcome)
    const bRecontact = isRecontactOutcome(b.contactOutcome)
    if (aRecontact && !bRecontact) return -1
    if (!aRecontact && bRecontact) return 1

    const aOrder = a.matchResult.segment ? segmentOrder[a.matchResult.segment] ?? 3 : 3
    const bOrder = b.matchResult.segment ? segmentOrder[b.matchResult.segment] ?? 3 : 3
    return aOrder - bOrder
  })
}

export default function RolodexCard() {
  const { state, toggleContacted, setContactOutcome, clearContact, updateNote, setSurveyResponses } = useAppContext()
  const { campaignConfig: authConfig } = useAuth()
  const campaignConfig = authConfig || defaultCampaignConfig
  const allSurveyQuestions = useMemo(() => {
    const custom = (campaignConfig.aiContext?.customSurveyQuestions || []).map(q => ({
      id: q.id, label: q.question, type: q.type as 'text' | 'select', options: q.options,
    }))
    return [...campaignConfig.surveyQuestions, ...custom]
  }, [campaignConfig])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [step, setStep] = useState<CardStep>('prep')
  const [selectedMethod, setSelectedMethod] = useState<OutreachMethod | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<ContactOutcome | null>(null)
  const [noteText, setNoteText] = useState('')
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({})

  const sortedItems = useMemo(() => sortForRolodex(state.actionPlanState), [state.actionPlanState])

  if (sortedItems.length === 0) return null

  const safeIndex = Math.min(currentIndex, sortedItems.length - 1)
  const item = sortedItems[safeIndex]
  const { matchResult } = item
  const { personEntry, bestMatch, voteScore, segment, status } = matchResult
  const voteHistory = bestMatch ? getVoteHistoryDetail(bestMatch) : []
  const relationshipTip = getRelationshipTip(personEntry.category)

  const totalRemaining = sortedItems.filter(i => !i.contacted || isRecontactOutcome(i.contactOutcome)).length
  const totalDone = sortedItems.filter(i => i.contacted && i.contactOutcome && !isRecontactOutcome(i.contactOutcome)).length

  const { textColor: segmentColor, dotColor: segmentDot } = getSegmentColors(segment)

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
    if (Object.values(surveyAnswers).some(v => v)) {
      setSurveyResponses(personEntry.id, surveyAnswers)
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
    setSurveyAnswers({})
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
      setSurveyAnswers({})
    }
  }

  // Guard against invalid outcome values from stale data
  const outcomeValid = item.contactOutcome && item.contactOutcome in OUTCOME_CONFIG
  const isRecontact = item.contacted && isRecontactOutcome(item.contactOutcome)
  const isFullyDone = item.contacted && outcomeValid && !isRecontact
  // If contacted but no outcome recorded (e.g. user selected method then skipped), show log step
  const needsOutcome = item.contacted && !outcomeValid

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm font-display text-white/50">
          <span className="text-vc-purple-light font-bold">{safeIndex + 1}</span> of {sortedItems.length}
        </p>
        <p className="text-sm font-display text-white/50">
          <span className="text-vc-teal font-bold">{totalDone}</span> done · <span className="text-vc-coral font-bold">{totalRemaining}</span> to go
        </p>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-white/10 rounded-full h-2 flex-1">
          <div
            className="bg-vc-teal h-2 rounded-full transition-all duration-500"
            style={{ width: `${sortedItems.length > 0 ? ((safeIndex + 1) / sortedItems.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-display text-white/40 whitespace-nowrap">
          Card {safeIndex + 1} of {sortedItems.length}
        </span>
      </div>

      {/* Card */}
      <div className={clsx(
        'glass-card p-6 transition-all',
        isFullyDone && 'opacity-75'
      )}>
        {/* Person header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={clsx('w-2.5 h-2.5 rounded-full', segmentDot)} />
            <h2 className="font-display text-2xl font-bold text-white">
              {personEntry.firstName} {personEntry.lastName}
            </h2>
          </div>
          <div className="flex items-center gap-3 mt-1 ml-5">
            {bestMatch && (
              <span className="text-sm text-white/50">{bestMatch.city}, {bestMatch.state}</span>
            )}
            {segment && SEGMENT_CONFIG[segment] && (
              <span className={clsx('text-xs font-display font-bold', SEGMENT_CONFIG[segment].textColor)}>
                {SEGMENT_CONFIG[segment].label}
              </span>
            )}
            {status === 'unmatched' && (
              <span className="text-xs font-display text-white/40">Not in voter file</span>
            )}
            {status === 'pending' && (
              <span className="text-xs font-display text-amber-400/70">Awaiting match</span>
            )}
          </div>
          {voteScore !== undefined && (
            <div className="mt-2 ml-5">
              <span className={clsx('text-2xl font-bold font-display', segmentColor)}>
                {Math.round(voteScore * 100)}%
              </span>
              <span className="text-xs text-white/40 ml-2">vote rate</span>
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
                  voted ? 'bg-vc-teal text-white font-bold' : 'bg-white/10 text-white/40'
                )}
              >
                <div>{year}</div>
                <div>{type.slice(0, 3)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Relationship tip */}
        <div className="glass rounded-lg p-3 mb-4">
          <p className="text-xs text-white/80 leading-relaxed">{relationshipTip}</p>
        </div>

        {/* Re-contact prompt */}
        {isRecontact && step === 'prep' && outcomeValid && (
          <div className="bg-vc-gold/10 border border-vc-gold/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
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
        {isFullyDone && outcomeValid && (
          <div className="bg-vc-teal/10 border border-vc-teal/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              {(() => { const { Icon } = OUTCOME_CONFIG[item.contactOutcome!]; return <Icon className="w-3.5 h-3.5" />; })()} {OUTCOME_CONFIG[item.contactOutcome!].label}
            </p>
            {item.notes && <p className="text-xs text-white/60 mt-1">{item.notes}</p>}
          </div>
        )}

        {/* Contacted but outcome not recorded — show log step */}
        {needsOutcome && step === 'prep' && (
          <div className="animate-fade-in">
            <div className="bg-vc-gold/10 border border-vc-gold/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-vc-gold">
                You marked {personEntry.firstName} as contacted but didn&apos;t record an outcome. How did it go?
              </p>
            </div>
            <p className="text-sm font-bold text-white mb-3">
              How did it go with {personEntry.firstName}?
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, Icon, color }]) => (
                <button
                  key={outcome}
                  onClick={() => {
                    setContactOutcome(personEntry.id, outcome)
                    advanceToNext()
                  }}
                  className={clsx(
                    'py-2 px-4 rounded-btn text-sm font-bold border transition-all flex items-center gap-1.5',
                    'border-white/15 text-white/60 hover:border-vc-purple hover:bg-vc-purple hover:text-white'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: Prep */}
        {step === 'prep' && !isFullyDone && !item.contacted && (
          <>
            {segment && CONVERSATION_SCRIPTS[segment] && (
              <details className="mb-4">
                <summary className="text-sm text-vc-purple-light font-bold cursor-pointer hover:text-vc-coral transition-colors">
                  Conversation guide
                </summary>
                <div className="mt-3 relative">
                  <div className="max-h-[40vh] overflow-auto">
                    <div className="max-w-prose">
                      <ScriptCard script={CONVERSATION_SCRIPTS[segment]} personName={personEntry.firstName} />
                    </div>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-vc-surface to-transparent" />
                </div>
              </details>
            )}

            {/* Send Text button */}
            {(() => {
              const smsLink = personEntry.phone
                ? generateSmsLinkForContact(personEntry.phone, personEntry.firstName, 'Volunteer', segment, campaignConfig.electionDate)
                : null
              const smsPreview = fillTemplate(getSmsTemplate(segment, campaignConfig.electionDate), personEntry.firstName, 'Volunteer')
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
                      'w-full py-3 px-4 rounded-btn text-sm font-bold transition-all flex items-center justify-center gap-2',
                      personEntry.phone
                        ? 'bg-vc-teal/15 text-vc-teal border border-vc-teal/30 hover:bg-vc-teal hover:text-white'
                        : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'
                    )}
                  >
                    <Smartphone className="w-4 h-4" /> {personEntry.phone ? 'Send Text' : 'Send Text (no phone number)'}
                  </button>
                  {personEntry.phone && (
                    <div className="mt-2 glass rounded-lg p-3">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">SMS preview</p>
                      <p className="text-xs text-white/70 leading-relaxed max-w-prose">{smsPreview}</p>
                    </div>
                  )}
                </div>
              )
            })()}

            <p className="text-sm font-bold text-white mb-3">How will you reach out?</p>
            <div className="flex gap-2">
              {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, typeof OUTREACH_LABELS[OutreachMethod]][]).map(([method, { label, Icon }]) => (
                <button
                  key={method}
                  onClick={() => handleMethodSelect(method)}
                  className="flex-1 py-3 px-4 rounded-btn text-sm font-bold border border-white/15 text-white/60 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 2: Log */}
        {step === 'log' && (
          <div className="animate-fade-in">
            <p className="text-sm font-bold text-white mb-3">
              How did it go with {personEntry.firstName}?
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { label, Icon, color }]) => (
                <button
                  key={outcome}
                  onClick={() => setSelectedOutcome(outcome)}
                  className={clsx(
                    'py-2 px-4 rounded-btn text-sm font-bold border transition-all flex items-center gap-1.5',
                    selectedOutcome === outcome
                      ? `${color} border-transparent`
                      : 'border-white/15 text-white/60 hover:border-vc-purple'
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
              className="glass-input w-full p-3 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-vc-purple/30 resize-none mb-4"
              rows={3}
            />

            {/* Survey questions */}
            {allSurveyQuestions.length > 0 && selectedOutcome && selectedOutcome !== 'no-answer' && selectedOutcome !== 'left-message' && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-bold text-vc-purple-light uppercase tracking-wider">Survey</p>
                {allSurveyQuestions.map(q => (
                  <div key={q.id}>
                    <label className="text-xs text-white/50 block mb-0.5">{q.label}</label>
                    {q.type === 'select' && q.options ? (
                      <select
                        value={surveyAnswers[q.id] ?? item.surveyResponses?.[q.id] ?? ''}
                        onChange={e => setSurveyAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="glass-input w-full px-3 py-2 rounded-btn text-sm"
                      >
                        <option value="">—</option>
                        {q.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={surveyAnswers[q.id] ?? item.surveyResponses?.[q.id] ?? ''}
                        onChange={e => setSurveyAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="glass-input w-full px-3 py-2 rounded-btn text-sm"
                        placeholder={q.label}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleSaveAndNext}
              disabled={!selectedOutcome}
              className={clsx(
                'w-full py-3 rounded-btn text-sm font-bold transition-all',
                selectedOutcome
                  ? 'bg-vc-purple text-white hover:bg-vc-purple-light shadow-glow'
                  : 'bg-white/10 text-white/20 cursor-not-allowed'
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
            'px-4 py-2 rounded-btn text-sm font-bold transition-all',
            safeIndex > 0 ? 'text-vc-purple-light hover:bg-white/10' : 'text-white/20 cursor-not-allowed'
          )}
        >
          &larr; Back
        </button>

        <button
          onClick={handleSkip}
          className="px-4 py-2 rounded-btn text-sm font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all"
        >
          Skip &rarr;
        </button>
      </div>
    </div>
  )
}
