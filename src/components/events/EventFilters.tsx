'use client'

import { EVENT_TYPE_CONFIG } from '@/types/events'
import type { EventType } from '@/types/events'
import { Search } from 'lucide-react'

interface Props {
  selectedType: string
  searchQuery: string
  onTypeChange: (type: string) => void
  onSearchChange: (query: string) => void
}

export default function EventFilters({ selectedType, searchQuery, onTypeChange, onSearchChange }: Props) {
  const eventTypes = Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => onTypeChange('')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
            selectedType === ''
              ? 'bg-vc-purple/20 text-vc-purple-light border-vc-purple/40 shadow-glow'
              : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
          }`}
        >
          All Events
        </button>
        {eventTypes.map(([key, config]) => (
          <button
            key={key}
            onClick={() => onTypeChange(key === selectedType ? '' : key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
              selectedType === key
                ? `${config.bgClass} shadow-sm`
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            {config.emoji} {config.label}
          </button>
        ))}
      </div>
    </div>
  )
}
