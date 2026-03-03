'use client'
import { useState } from 'react'
import { PersonEntry, MatchResult } from '@/types'
import { CATEGORIES } from '@/lib/wizard-config'
import { CATEGORY_ICONS, getSegmentColors } from '@/lib/contact-config'
import { X, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  person: PersonEntry
  matchResult?: MatchResult
  isNew: boolean
  isDimmed: boolean
  expanded: boolean
  onToggleExpand: () => void
  onRemove: (personId: string) => void
}

export default function ContactItemHeader({
  person, matchResult, isNew, isDimmed, expanded, onToggleExpand, onRemove,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false)

  const bestMatch = matchResult?.bestMatch
  const segment = matchResult?.segment
  const voteScore = matchResult?.voteScore
  const catConfig = CATEGORIES.find(c => c.id === person.category)
  const { textColor, dotColor } = getSegmentColors(segment)

  const CatIcon = catConfig?.icon ? CATEGORY_ICONS[catConfig.icon] : null

  return (
    <div className="flex items-start justify-between gap-2">
      {/* Left: name + meta */}
      <button
        onClick={onToggleExpand}
        className="flex-1 text-left min-w-0 group"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
          <span className={clsx(
            'font-bold text-base md:text-lg truncate',
            isDimmed ? 'text-white/50' : 'text-white'
          )}>
            {person.firstName} {person.lastName}
          </span>
          {isNew && (
            <span className="text-[9px] font-bold bg-vc-teal text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide animate-fade-in flex-shrink-0">
              New
            </span>
          )}
          {CatIcon && (
            <span className="text-white/40 flex-shrink-0">
              <CatIcon className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 ml-4 text-xs text-white/50">
          {(bestMatch?.city || person.city) && (
            <span>{bestMatch?.city || person.city}</span>
          )}
          {person.age && <span>Age {person.age}</span>}
        </div>
      </button>

      {/* Right: vote score + chevron + delete */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {voteScore !== undefined && (
          <span className={clsx('font-display font-bold text-lg tabular-nums', textColor)}>
            {Math.round(voteScore * 100)}%
          </span>
        )}
        <ChevronDown className={clsx(
          'w-4 h-4 text-white/30 transition-transform duration-200',
          expanded && 'rotate-180'
        )} />
        {confirmRemove ? (
          <span className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(person.id); setConfirmRemove(false) }}
              className="text-[9px] font-bold text-red-400 bg-red-500/15 hover:bg-red-500/30 px-1.5 py-0.5 rounded transition-colors"
            >
              Delete
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmRemove(false) }}
              className="text-[9px] text-white/40 hover:text-white/60 px-1 py-0.5 rounded transition-colors"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmRemove(true) }}
            className="text-vc-coral/30 hover:text-vc-coral transition-colors"
            title="Remove contact"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
