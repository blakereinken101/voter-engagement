'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ConversationRow, ConversationFilters, ColumnConfig } from '@/types'
import ConversationsToolbar from './ConversationsToolbar'
import ConversationsTable from './ConversationsTable'
import ConversationsPager from './ConversationsPager'
import PtgMetrics from './PtgMetrics'
import { Loader2, MessageSquare } from 'lucide-react'

const REFRESH_INTERVAL_MS = 60_000 // auto-refresh every 60 seconds

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', visible: true, width: 160 },
  { id: 'phone', label: 'Phone', visible: true, width: 115 },
  { id: 'address', label: 'Address', visible: true, width: 160 },
  { id: 'contactOutcome', label: 'Support', visible: true, width: 90 },
  { id: 'notes', label: 'Notes', visible: true, width: 150 },
  { id: 'volunteerName', label: 'Volunteer', visible: true, width: 120 },
  { id: 'organizerName', label: 'Organizer', visible: true, width: 120 },
  { id: 'region', label: 'Region', visible: true, width: 100 },
  { id: 'timestamp', label: 'Date/Time', visible: true, width: 130 },
  { id: 'entryMethod', label: 'Entry', visible: true, width: 70 },
  { id: 'surveyResponses', label: 'Survey', visible: false, width: 180 },
  { id: 'enteredBy', label: 'Entered By', visible: false, width: 110 },
  { id: 'outreachMethod', label: 'Outreach', visible: false, width: 100 },
  { id: 'volunteerInterest', label: 'Vol. Interest', visible: false, width: 90 },
  { id: 'city', label: 'City', visible: false, width: 100 },
  { id: 'zip', label: 'Zip', visible: false, width: 70 },
  { id: 'turfName', label: 'Turf', visible: false, width: 120 },
]

interface FilterOptions {
  regions: string[]
  organizers: { id: string; name: string }[]
  volunteers: { id: string; name: string }[]
  outcomes: string[]
}

export default function PtgDashboard() {
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(100)
  const [filters, setFilters] = useState<ConversationFilters>({ sortBy: 'timestamp', sortDir: 'desc' })
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ regions: [], organizers: [], volunteers: [], outcomes: [] })
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersRef = useRef(filters)
  const pageRef = useRef(page)
  filtersRef.current = filters
  pageRef.current = page

  // Load filter options once
  useEffect(() => {
    fetch('/api/admin/ptg/filters')
      .then(r => r.json())
      .then(d => setFilterOptions(d))
      .catch(() => {})
  }, [])

  // Load column config once
  useEffect(() => {
    fetch('/api/admin/ptg/column-config')
      .then(r => r.json())
      .then(d => {
        if (d.columns && Array.isArray(d.columns)) {
          // Merge saved config with defaults (handles new columns added later)
          const saved = new Map(d.columns.map((c: ColumnConfig) => [c.id, c]))
          const merged = DEFAULT_COLUMNS.map(dc => {
            const s = saved.get(dc.id)
            return s ? { ...dc, ...s } : dc
          })
          setColumns(merged)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch conversations
  const fetchData = useCallback(async (p: number, f: ConversationFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('pageSize', String(pageSize))
      if (f.search) params.set('search', f.search)
      if (f.region) params.set('region', f.region)
      if (f.organizerId) params.set('organizerId', f.organizerId)
      if (f.volunteerId) params.set('volunteerId', f.volunteerId)
      if (f.outcome) params.set('outcome', f.outcome)
      if (f.entryMethod) params.set('entryMethod', f.entryMethod)
      if (f.dateFrom) params.set('dateFrom', f.dateFrom)
      if (f.dateTo) params.set('dateTo', f.dateTo)
      if (f.sortBy) params.set('sortBy', f.sortBy)
      if (f.sortDir) params.set('sortDir', f.sortDir)

      const res = await fetch(`/api/admin/ptg/conversations?${params}`)
      const data = await res.json()
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } catch {
      setRows([])
      setTotal(0)
    }
    setLoading(false)
    setInitialLoad(false)
  }, [pageSize])

  // Debounced fetch on filter/page change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchData(page, filters)
    }, filters.search !== undefined ? 300 : 0)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [page, filters, fetchData])

  // Auto-refresh every 60 seconds (table + metrics)
  useEffect(() => {
    const id = setInterval(() => {
      fetchData(pageRef.current, filtersRef.current)
      setRefreshKey(k => k + 1)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchData])

  // Reset page on filter change
  const handleFiltersChange = (f: ConversationFilters) => {
    setPage(1)
    setFilters(f)
  }

  // Save column config
  const handleColumnsChange = (cols: ColumnConfig[]) => {
    setColumns(cols)
    fetch('/api/admin/ptg/column-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: cols.map(c => ({ id: c.id, visible: c.visible })) }),
    }).catch(() => {})
  }

  // Inline edit save
  const handleSave = async (contactId: string, field: string, value: string) => {
    // Optimistic update
    setRows(prev => prev.map(r => {
      if (r.contactId !== contactId) return r
      const fieldMap: Record<string, keyof ConversationRow> = {
        first_name: 'firstName',
        last_name: 'lastName',
        phone: 'phone',
        address: 'address',
        city: 'city',
        zip: 'zip',
        contact_outcome: 'contactOutcome',
        notes: 'notes',
        outreach_method: 'outreachMethod',
        volunteer_interest: 'volunteerInterest',
        contacted_date: 'contactedDate',
      }
      const key = fieldMap[field]
      if (key) return { ...r, [key]: value || null }
      return r
    }))

    const res = await fetch('/api/admin/ptg/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, field, value }),
    })

    if (!res.ok) {
      // Revert on error — refetch
      fetchData(page, filters)
    }
  }

  if (initialLoad) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-white/40 gap-3">
        <div className="w-12 h-12 rounded-full bg-vc-purple/10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-vc-purple-light" />
        </div>
        <span className="text-sm">Loading conversations...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vc-purple via-vc-purple to-vc-teal flex items-center justify-center shadow-lg shadow-vc-purple/20">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-vc-purple to-vc-teal opacity-20 blur-md -z-10" />
        </div>
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            Conversations
          </h2>
          <div className="text-[10px] text-white/30 font-medium tracking-widest uppercase">
            Relational Contact Sheet
          </div>
        </div>
      </div>

      <PtgMetrics refreshKey={refreshKey} />

      <ConversationsToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        filterOptions={filterOptions}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        total={total}
      />

      <div className={loading && !initialLoad ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
        <ConversationsTable
          rows={rows}
          columns={columns}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onSave={handleSave}
        />
      </div>

      <ConversationsPager
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />
    </div>
  )
}
