'use client'

import { useState } from 'react'
import type { ConversationFilters, ColumnConfig } from '@/types'
import ColumnConfigPanel from './ColumnConfigPanel'
import { Search, SlidersHorizontal, X, Columns3 } from 'lucide-react'
import clsx from 'clsx'

interface FilterOptions {
  regions: string[]
  organizers: { id: string; name: string }[]
  volunteers: { id: string; name: string }[]
  outcomes: string[]
}

interface Props {
  filters: ConversationFilters
  onFiltersChange: (f: ConversationFilters) => void
  filterOptions: FilterOptions
  columns: ColumnConfig[]
  onColumnsChange: (cols: ColumnConfig[]) => void
  total: number
}

export default function ConversationsToolbar({ filters, onFiltersChange, filterOptions, columns, onColumnsChange, total }: Props) {
  const [showColumns, setShowColumns] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const setFilter = (key: keyof ConversationFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value || undefined })
  }

  const activeFilterCount = [
    filters.region, filters.organizerId, filters.volunteerId,
    filters.outcome, filters.entryMethod, filters.dateFrom, filters.dateTo,
  ].filter(Boolean).length

  const clearFilters = () => {
    onFiltersChange({ search: filters.search })
  }

  return (
    <div className="space-y-3">
      {/* Top row: search + actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={filters.search || ''}
            onChange={e => setFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-vc-purple/40 focus:ring-1 focus:ring-vc-purple/20 transition-all"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all',
            showFilters || activeFilterCount > 0
              ? 'bg-vc-purple/15 text-vc-purple-light border border-vc-purple/25'
              : 'text-white/40 border border-white/[0.08] hover:border-white/15 hover:text-white/60'
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-vc-purple/30 text-vc-purple-light text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        {/* Column config */}
        <div className="relative">
          <button
            onClick={() => setShowColumns(!showColumns)}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all',
              showColumns
                ? 'bg-white/10 text-white'
                : 'text-white/40 border border-white/[0.08] hover:border-white/15 hover:text-white/60'
            )}
          >
            <Columns3 className="w-3.5 h-3.5" /> Columns
          </button>
          {showColumns && (
            <ColumnConfigPanel
              columns={columns}
              onChange={onColumnsChange}
              onClose={() => setShowColumns(false)}
            />
          )}
        </div>

        {/* Total count */}
        <span className="text-xs text-white/30 tabular-nums ml-auto">
          {total.toLocaleString()} conversation{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Expanded filters row */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <FilterSelect
            label="Region"
            value={filters.region || ''}
            onChange={v => setFilter('region', v)}
            options={filterOptions.regions.map(r => ({ value: r, label: r }))}
          />
          <FilterSelect
            label="Organizer"
            value={filters.organizerId || ''}
            onChange={v => setFilter('organizerId', v)}
            options={filterOptions.organizers.map(o => ({ value: o.id, label: o.name }))}
          />
          <FilterSelect
            label="Volunteer"
            value={filters.volunteerId || ''}
            onChange={v => setFilter('volunteerId', v)}
            options={filterOptions.volunteers.map(v => ({ value: v.id, label: v.name }))}
          />
          <FilterSelect
            label="Outcome"
            value={filters.outcome || ''}
            onChange={v => setFilter('outcome', v)}
            options={filterOptions.outcomes.map(o => ({ value: o, label: o.replace('-', ' ') }))}
          />
          <FilterSelect
            label="Entry Method"
            value={filters.entryMethod || ''}
            onChange={v => setFilter('entryMethod', v)}
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'scan', label: 'Scan' },
              { value: 'chatbot', label: 'Chatbot' },
              { value: 'import', label: 'Import' },
            ]}
          />
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">From</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={e => setFilter('dateFrom', e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none focus:border-vc-purple/40"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">To</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={e => setFilter('dateTo', e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none focus:border-vc-purple/40"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[10px] text-white/30 uppercase tracking-wide font-semibold shrink-0">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none focus:border-vc-purple/40 min-w-[100px] max-w-[180px]"
      >
        <option value="" className="bg-[#1a1025]">All</option>
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-[#1a1025]">{o.label}</option>
        ))}
      </select>
    </div>
  )
}
