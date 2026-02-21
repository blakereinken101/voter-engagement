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
  'super-voter': { label: 'Champions', colorClass: 'text-rally-green', barColorClass: 'bg-rally-green' },
  'sometimes-voter': { label: 'Need a Nudge', colorClass: 'text-rally-yellow', barColorClass: 'bg-rally-yellow' },
  'rarely-voter': { label: 'Need You Most', colorClass: 'text-rally-red', barColorClass: 'bg-rally-red' },
  'unmatched': { label: 'Unmatched', colorClass: 'text-rally-slate-light', barColorClass: 'bg-gray-300' },
}

const POSITIVE_OUTCOMES: ContactOutcome[] = ['supporter']

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = dates
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.abs(sorted[i - 1].getTime() - sorted[i].getTime())
    // If contacted within 48 hours of previous, continue streak
    if (diff <= 48 * 60 * 60 * 1000) {
      streak++
    } else {
      break
    }
  }
  return streak
}

export default function ConversionStats() {
  const { state } = useAppContext()
  const [isExpanded, setIsExpanded] = useState(true)

  const stats = useMemo(() => {
    const { personEntries, matchResults, actionPlanState } = state

    const totalPeople = personEntries.length
    const totalContacted = actionPlanState.filter(a => a.contacted).length

    // Build per-segment stats
    const segmentMap = new Map<string, SegmentStats>()

    // Initialize segments
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

    // Tally each person
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

    // Calculate conversion rates (supporters / contacted)
    for (const entry of segmentMap.values()) {
      entry.conversionRate = entry.contacted > 0
        ? Math.round((entry.supporters / entry.contacted) * 100)
        : 0
    }

    // Find top category (highest conversion rate with at least 1 contact)
    let topCategory: SegmentStats | null = null
    for (const entry of segmentMap.values()) {
      if (entry.contacted > 0) {
        if (!topCategory || entry.conversionRate > topCategory.conversionRate) {
          topCategory = entry
        }
      }
    }

    // Streak: count consecutive recent contacted days
    const contactedDates = actionPlanState
      .filter(a => a.contacted && a.contactedDate)
      .map(a => a.contactedDate as string)
    const streak = computeStreak(contactedDates)

    const contactPercent = totalPeople > 0
      ? Math.round((totalContacted / totalPeople) * 100)
      : 0

    const segments = Array.from(segmentMap.values()).filter(s => s.total > 0)

    return {
      totalPeople,
      totalContacted,
      contactPercent,
      segments,
      topCategory,
      streak,
    }
  }, [state])

  if (stats.totalPeople === 0) return null

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-rally-navy/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-rally-navy">Your Outreach Stats</span>
          {!isExpanded && (
            <span className="text-xs text-rally-slate-light font-mono">
              {stats.totalContacted}/{stats.totalPeople} contacted
            </span>
          )}
        </div>
        <span className="text-rally-slate-light text-xs">
          {isExpanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {/* Summary cards row */}
          <div className="grid grid-cols-3 gap-2">
            {/* Contact progress */}
            <div className="bg-rally-navy/5 rounded-lg p-3 text-center">
              <div className="font-display text-2xl font-bold text-rally-navy">
                {stats.contactPercent}%
              </div>
              <p className="text-[10px] text-rally-slate-light mt-0.5 leading-tight">
                {stats.totalContacted} of {stats.totalPeople} contacted
              </p>
              {/* Mini progress bar */}
              <div className="mt-2 bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-rally-navy h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${stats.contactPercent}%` }}
                />
              </div>
            </div>

            {/* Top category */}
            <div className="bg-rally-navy/5 rounded-lg p-3 text-center">
              {stats.topCategory ? (
                <>
                  <div className={clsx('font-display text-2xl font-bold', stats.topCategory.colorClass)}>
                    {stats.topCategory.conversionRate}%
                  </div>
                  <p className="text-[10px] text-rally-slate-light mt-0.5 leading-tight">
                    Top: {stats.topCategory.label}
                  </p>
                  <p className="text-[8px] text-rally-slate-light mt-0.5 font-mono">
                    {stats.topCategory.supporters} supporter{stats.topCategory.supporters !== 1 ? 's' : ''}
                  </p>
                </>
              ) : (
                <>
                  <div className="font-display text-2xl font-bold text-rally-slate-light">--</div>
                  <p className="text-[10px] text-rally-slate-light mt-0.5 leading-tight">
                    No outcomes yet
                  </p>
                </>
              )}
            </div>

            {/* Streak */}
            <div className="bg-rally-navy/5 rounded-lg p-3 text-center">
              <div className="font-display text-2xl font-bold text-rally-yellow">
                {stats.streak}
              </div>
              <p className="text-[10px] text-rally-slate-light mt-0.5 leading-tight">
                Contact streak
              </p>
              <div className="flex justify-center gap-0.5 mt-1.5">
                {Array.from({ length: Math.min(stats.streak, 7) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-rally-yellow"
                  />
                ))}
                {stats.streak < 7 && Array.from({ length: 7 - Math.min(stats.streak, 7) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-2 h-2 rounded-full bg-gray-200"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Per-segment breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-rally-slate-light uppercase tracking-wider">
              By Segment
            </p>
            {stats.segments.map(seg => {
              const contactedPct = seg.total > 0 ? Math.round((seg.contacted / seg.total) * 100) : 0

              return (
                <div key={seg.segment} className="flex items-center gap-3">
                  {/* Segment label */}
                  <div className="w-28 shrink-0">
                    <span className={clsx('text-xs font-bold', seg.colorClass)}>
                      {seg.label}
                    </span>
                    <span className="text-[10px] text-rally-slate-light font-mono ml-1">
                      {seg.contacted}/{seg.total}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 bg-gray-100 rounded-full h-3 relative overflow-hidden">
                    <div
                      className={clsx('h-3 rounded-full transition-all duration-500', seg.barColorClass)}
                      style={{ width: `${contactedPct}%` }}
                    />
                    {contactedPct > 12 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white font-mono">
                        {contactedPct}%
                      </span>
                    )}
                  </div>

                  {/* Conversion rate */}
                  <div className="w-14 text-right shrink-0">
                    <span className="text-[10px] font-mono text-rally-slate-light">
                      {seg.contacted > 0 ? `${seg.conversionRate}% conv` : '--'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Outcome tally */}
          {stats.totalContacted > 0 && (
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <OutcomeBadge
                label="Supporters"
                count={stats.segments.reduce((sum, s) => sum + s.supporters, 0)}
                colorClass="bg-rally-green/10 text-rally-green"
              />
              <OutcomeBadge
                label="Undecided"
                count={stats.segments.reduce((sum, s) => sum + s.undecided, 0)}
                colorClass="bg-rally-yellow/10 text-rally-yellow"
              />
              <OutcomeBadge
                label="Opposed"
                count={stats.segments.reduce((sum, s) => sum + s.opposed, 0)}
                colorClass="bg-rally-red/10 text-rally-red"
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
    <div className={clsx('flex-1 rounded-lg px-3 py-2 text-center', colorClass)}>
      <div className="font-display text-lg font-bold">{count}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider">{label}</div>
    </div>
  )
}
