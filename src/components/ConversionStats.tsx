'use client'

import { useState, useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import { VoterSegment, ContactOutcome } from '@/types'
import clsx from 'clsx'

interface SegmentStats {
  label: string
  segment: VoterSegment | 'unmatched'
  total: number
  contacted: number
  supporters: number
  undecided: number
  opposed: number
  conversionRate: number
  colorClass: string
  barColorClass: string
}

const SEGMENT_CONFIG: Record<string, { label: string; colorClass: string; barColorClass: string }> = {
  'super-voter': { label: 'Champions', colorClass: 'text-vc-teal', barColorClass: 'bg-vc-teal' },
  'sometimes-voter': { label: 'Need a Nudge', colorClass: 'text-vc-gold', barColorClass: 'bg-vc-gold' },
  'rarely-voter': { label: 'Need You Most', colorClass: 'text-vc-coral', barColorClass: 'bg-vc-coral' },
  'unmatched': { label: 'Unmatched', colorClass: 'text-white/40', barColorClass: 'bg-white/20' },
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = dates
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.abs(sorted[i - 1].getTime() - sorted[i].getTime())
    if (diff <= 48 * 60 * 60 * 1000) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// Glowing stat circle — matches the reference design
function StatCircle({ value, label, borderColor, glowColor }: {
  value: string; label: string; borderColor: string; glowColor: string
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={clsx(
          'w-24 h-24 rounded-full flex flex-col items-center justify-center',
          'bg-white/5 border-2',
          borderColor
        )}
        style={{ boxShadow: `0 0 24px ${glowColor}, inset 0 0 16px ${glowColor}` }}
      >
        <span className="font-display text-2xl font-bold text-white">{value}</span>
      </div>
      <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">{label}</span>
    </div>
  )
}

export default function ConversionStats() {
  const { state } = useAppContext()
  const [isExpanded, setIsExpanded] = useState(true)

  const stats = useMemo(() => {
    const { personEntries, matchResults, actionPlanState } = state

    const totalPeople = personEntries.length
    const totalContacted = actionPlanState.filter(a => a.contacted).length

    const segmentMap = new Map<string, SegmentStats>()

    for (const [key, cfg] of Object.entries(SEGMENT_CONFIG)) {
      segmentMap.set(key, {
        label: cfg.label,
        segment: key as VoterSegment | 'unmatched',
        total: 0,
        contacted: 0,
        supporters: 0,
        undecided: 0,
        opposed: 0,
        conversionRate: 0,
        colorClass: cfg.colorClass,
        barColorClass: cfg.barColorClass,
      })
    }

    for (const person of personEntries) {
      const matchResult = matchResults.find(r => r.personEntry.id === person.id)
      const actionItem = actionPlanState.find(a => a.matchResult.personEntry.id === person.id)
      const segmentKey = matchResult?.segment || 'unmatched'
      const entry = segmentMap.get(segmentKey)
      if (!entry) continue

      entry.total++
      if (actionItem?.contacted) {
        entry.contacted++
        if (actionItem.contactOutcome === 'supporter') entry.supporters++
        if (actionItem.contactOutcome === 'undecided') entry.undecided++
        if (actionItem.contactOutcome === 'opposed') entry.opposed++
      }
    }

    for (const entry of segmentMap.values()) {
      entry.conversionRate = entry.contacted > 0
        ? Math.min(100, Math.round((entry.supporters / entry.contacted) * 100))
        : 0
    }

    let topCategory: SegmentStats | null = null
    for (const entry of segmentMap.values()) {
      if (entry.contacted > 0) {
        if (!topCategory || entry.conversionRate > topCategory.conversionRate) {
          topCategory = entry
        }
      }
    }

    const contactedDates = actionPlanState
      .filter(a => a.contacted && a.contactedDate)
      .map(a => a.contactedDate as string)
    const streak = computeStreak(contactedDates)

    const contactPercent = totalPeople > 0
      ? Math.min(100, Math.round((totalContacted / totalPeople) * 100))
      : 0

    const segments = Array.from(segmentMap.values()).filter(s => s.total > 0)

    return { totalPeople, totalContacted, contactPercent, segments, topCategory, streak }
  }, [state])

  if (stats.totalPeople === 0) return null

  return (
    <div className="glass-card p-5 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity text-left"
      >
        <span className="text-sm font-bold text-white/70">Your Outreach Stats</span>
        <span className="text-white/30 text-xs">
          {isExpanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-5 animate-fade-in">
          {/* Glowing stat circles */}
          <div className="flex justify-center gap-6">
            <StatCircle
              value={`${stats.contactPercent}%`}
              label="Contacted"
              borderColor="border-vc-purple"
              glowColor="rgba(108,60,225,0.25)"
            />
            <StatCircle
              value={stats.topCategory ? `${stats.topCategory.conversionRate}%` : '--'}
              label={stats.topCategory ? stats.topCategory.label : 'No data'}
              borderColor="border-vc-teal"
              glowColor="rgba(20,184,166,0.25)"
            />
            <StatCircle
              value={String(stats.streak)}
              label="Contact Streak"
              borderColor="border-vc-gold"
              glowColor="rgba(245,158,11,0.25)"
            />
          </div>

          {/* Outcome tally */}
          {stats.totalContacted > 0 && (
            <div className="flex gap-3 pt-3 border-t border-white/10">
              <OutcomeBadge
                label="Supporter"
                count={stats.segments.reduce((sum, s) => sum + s.supporters, 0)}
                colorClass="bg-vc-teal/15 text-vc-teal border border-vc-teal/30"
              />
              <OutcomeBadge
                label="Undecided"
                count={stats.segments.reduce((sum, s) => sum + s.undecided, 0)}
                colorClass="bg-vc-gold/15 text-vc-gold border border-vc-gold/30"
              />
              <OutcomeBadge
                label="Opposed"
                count={stats.segments.reduce((sum, s) => sum + s.opposed, 0)}
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
