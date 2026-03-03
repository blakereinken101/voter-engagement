'use client'
import { useState } from 'react'
import { ContactOutcome } from '@/types'
import { OUTCOME_CONFIG, COULDNT_REACH_OUTCOMES, RESPONSE_OUTCOMES, isRecontactOutcome } from '@/lib/contact-config'
import { RotateCcw, PhoneOff, MessageSquare } from 'lucide-react'
import clsx from 'clsx'

type Phase = 'initial' | 'couldnt-reach' | 'talked'

interface Props {
  personId: string
  firstName: string
  contacted: boolean
  contactOutcome?: ContactOutcome
  onOutcomeSelect: (personId: string, outcome: ContactOutcome) => void
  onRecontact: (personId: string) => void
}

export default function OutcomeSelector({
  personId, firstName, contacted, contactOutcome, onOutcomeSelect, onRecontact,
}: Props) {
  const [phase, setPhase] = useState<Phase>('initial')

  const outcomeValid = contactOutcome && contactOutcome in OUTCOME_CONFIG
  const isRecontact = isRecontactOutcome(contactOutcome)

  // Not contacted yet — nothing to show
  if (!contacted) return null

  // Has a valid outcome — show badge
  if (outcomeValid) {
    const { label, Icon, color } = OUTCOME_CONFIG[contactOutcome]
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className={clsx('text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1', color)}>
          <Icon className="w-3 h-3" /> {label}
        </span>
        {isRecontact && (
          <button
            onClick={() => onRecontact(personId)}
            className="text-[10px] text-vc-coral hover:underline font-bold inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Try again
          </button>
        )}
      </div>
    )
  }

  // Contacted but no outcome — two-phase selector

  // Phase 1: Did you reach them?
  if (phase === 'initial') {
    return (
      <div className="animate-fade-in">
        <p className="text-xs text-white/50 mb-2">Did you reach {firstName}?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setPhase('couldnt-reach')}
            className="flex-1 py-2 px-3 rounded-btn text-xs font-bold border border-white/15 text-white/60 hover:border-vc-coral/50 hover:bg-vc-coral/10 hover:text-white transition-all flex items-center justify-center gap-1.5"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Couldn&apos;t reach
          </button>
          <button
            onClick={() => setPhase('talked')}
            className="flex-1 py-2 px-3 rounded-btn text-xs font-bold border border-white/15 text-white/60 hover:border-vc-teal/50 hover:bg-vc-teal/10 hover:text-white transition-all flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Yes, we talked
          </button>
        </div>
      </div>
    )
  }

  // Phase 2a: Couldn't reach sub-options
  if (phase === 'couldnt-reach') {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setPhase('initial')}
            className="text-[10px] text-white/40 hover:text-white/60 transition-colors"
          >
            ← Back
          </button>
          <p className="text-xs text-white/50">What happened?</p>
        </div>
        <div className="flex gap-2">
          {COULDNT_REACH_OUTCOMES.map(outcome => {
            const { label, Icon, tip } = OUTCOME_CONFIG[outcome]
            return (
              <button
                key={outcome}
                onClick={() => { onOutcomeSelect(personId, outcome); setPhase('initial') }}
                className="flex-1 py-2 px-3 rounded-btn text-xs font-bold border border-white/15 text-white/60 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center justify-center gap-1.5"
                title={tip}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Phase 2b: Talked — response outcomes
  if (phase === 'talked') {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setPhase('initial')}
            className="text-[10px] text-white/40 hover:text-white/60 transition-colors"
          >
            ← Back
          </button>
          <p className="text-xs text-white/50">How did it go?</p>
        </div>
        <div className="flex gap-2">
          {RESPONSE_OUTCOMES.map(outcome => {
            const { label, Icon, tip } = OUTCOME_CONFIG[outcome]
            return (
              <button
                key={outcome}
                onClick={() => { onOutcomeSelect(personId, outcome); setPhase('initial') }}
                className="flex-1 py-2 px-3 rounded-btn text-xs font-bold border border-white/15 text-white/60 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center justify-center gap-1.5"
                title={tip}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}
