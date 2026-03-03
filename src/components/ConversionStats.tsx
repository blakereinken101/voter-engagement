'use client'

import { useState, useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import clsx from 'clsx'

export default function ConversionStats() {
  const { state } = useAppContext()
  const [isExpanded, setIsExpanded] = useState(true)

  const stats = useMemo(() => {
    const { personEntries, actionPlanState } = state

    const totalPeople = personEntries.length
    const totalContacted = actionPlanState.filter(a => a.contacted).length
    const outcomes = actionPlanState.filter(a => a.contactOutcome)
    const supporters = outcomes.filter(a => a.contactOutcome === 'supporter').length
    const undecided = outcomes.filter(a => a.contactOutcome === 'undecided').length
    const opposed = outcomes.filter(a => a.contactOutcome === 'opposed').length

    const reachedPercent = totalPeople > 0
      ? Math.min(100, Math.round((totalContacted / totalPeople) * 100))
      : 0

    return { totalPeople, totalContacted, reachedPercent, supporters, undecided, opposed }
  }, [state])

  if (stats.totalPeople === 0) return null

  return (
    <div className="glass-card p-5 md:p-6 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity text-left"
      >
        <span className="text-sm font-bold text-white/70">Your Outreach</span>
        <span className="text-white/30 text-xs">
          {isExpanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-5 space-y-5 animate-fade-in">
          {/* Hero stats — two columns */}
          <div className="grid grid-cols-2 gap-0">
            <div className="flex flex-col items-center justify-center py-3 border-r border-white/10">
              <span className="font-display text-4xl md:text-5xl font-bold bg-gradient-to-r from-vc-purple-light to-vc-teal bg-clip-text text-transparent">
                {stats.totalPeople}
              </span>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/50 mt-1.5">
                People Rolodexed
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-3">
              <span className="font-display text-4xl md:text-5xl font-bold bg-gradient-to-r from-vc-purple-light to-vc-teal bg-clip-text text-transparent">
                {stats.totalContacted}
              </span>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/50 mt-1.5">
                Conversations
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-vc-purple via-vc-purple-light to-vc-teal transition-all duration-700 ease-out"
                style={{ width: `${stats.reachedPercent}%` }}
              />
            </div>
            <p className="text-[10px] md:text-xs text-white/40 font-medium text-right tabular-nums">
              {stats.reachedPercent}% reached
            </p>
          </div>

          {/* Outcome tally */}
          {stats.totalContacted > 0 && (
            <div className="flex gap-3 pt-3 border-t border-white/10">
              <OutcomeBadge
                label="Supporters"
                count={stats.supporters}
                colorClass="bg-vc-teal/15 text-vc-teal border border-vc-teal/30"
              />
              <OutcomeBadge
                label="Undecided"
                count={stats.undecided}
                colorClass="bg-vc-gold/15 text-vc-gold border border-vc-gold/30"
              />
              <OutcomeBadge
                label="Opposed"
                count={stats.opposed}
                colorClass="bg-vc-coral/15 text-vc-coral border border-vc-coral/30"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OutcomeBadge({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div className={clsx('flex-1 rounded-xl px-3 py-2.5 text-center', colorClass)}>
      <div className="font-display text-lg font-bold">{count}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
    </div>
  )
}
