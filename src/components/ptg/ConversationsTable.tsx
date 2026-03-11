'use client'

import { useState, useMemo } from 'react'
import type { ConversationRow, ColumnConfig, ConversationFilters } from '@/types'
import EditableCell from './EditableCell'
import MatchStatusBadge from './MatchStatusBadge'
import OrganizerSelect from './OrganizerSelect'
import clsx from 'clsx'
import { ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, Users, MessageSquare } from 'lucide-react'

interface Props {
  rows: ConversationRow[]
  columns: ColumnConfig[]
  filters: ConversationFilters
  onFiltersChange: (f: ConversationFilters) => void
  onSave: (contactId: string, field: string, value: string) => Promise<void>
  onResolveMatch?: (contactId: string) => void
  organizers?: { id: string; name: string }[]
}

/** Map column IDs to the sortBy key used by the API */
const SORTABLE: Record<string, string> = {
  name: 'name',
  contactOutcome: 'outcome',
  volunteerName: 'volunteer',
  organizerName: 'organizer',
  region: 'region',
  entryMethod: 'entryMethod',
  matchStatus: 'matchStatus',
  timestamp: 'timestamp',
}

function formatTimestamp(iso: string, tz: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso ? new Date(iso).toLocaleString() : '—'
  }
}

function tzAbbrev(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value || tz
  } catch {
    return tz
  }
}

export default function ConversationsTable({ rows, columns, filters, onFiltersChange, onSave, onResolveMatch, organizers }: Props) {
  const visibleCols = columns.filter(c => c.visible)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkOrgId, setBulkOrgId] = useState('')

  const allSelected = rows.length > 0 && selectedIds.size === rows.length
  const someSelected = selectedIds.size > 0

  // Deduplicate selected volunteer IDs for bulk reassign
  const selectedVolunteerIds = useMemo(() => {
    const volIds = new Set<string>()
    for (const row of rows) {
      if (selectedIds.has(row.contactId) && row.volunteerId) {
        volIds.add(row.volunteerId)
      }
    }
    return volIds
  }, [rows, selectedIds])

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rows.map(r => r.contactId)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkReassign = async () => {
    if (!bulkOrgId && bulkOrgId !== '') return
    // Reassign each unique volunteer
    for (const volRow of rows) {
      if (selectedIds.has(volRow.contactId) && volRow.volunteerId) {
        await onSave(volRow.contactId, 'reassign_organizer', bulkOrgId)
      }
    }
    setSelectedIds(new Set())
    setBulkOrgId('')
  }

  const toggleSort = (colId: string) => {
    const sortKey = SORTABLE[colId]
    if (!sortKey) return
    const newDir = filters.sortBy === sortKey && filters.sortDir === 'asc' ? 'desc' : 'asc'
    onFiltersChange({ ...filters, sortBy: sortKey, sortDir: newDir })
  }

  const SortIcon = ({ colId }: { colId: string }) => {
    const sortKey = SORTABLE[colId]
    if (!sortKey) return null
    if (filters.sortBy === sortKey) {
      return filters.sortDir === 'asc'
        ? <ArrowUp className="w-3 h-3 text-vc-blue-light" />
        : <ArrowDown className="w-3 h-3 text-vc-blue-light" />
    }
    return <ArrowUpDown className="w-3 h-3 text-white/15 group-hover:text-white/30" />
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.015] backdrop-blur-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#0f0f19]">
              {visibleCols.map(col => (
                <th
                  key={col.id}
                  onClick={() => toggleSort(col.id)}
                  className={clsx(
                    'px-3 py-3 text-left text-xs font-bold text-white/50 uppercase tracking-widest border-b-2 border-white/[0.08] whitespace-nowrap',
                    col.id === 'name' && 'sticky left-0 z-10 bg-[#0f0f19] min-w-[160px]',
                    SORTABLE[col.id] && 'cursor-pointer group hover:text-white/70 select-none',
                  )}
                  style={col.width ? { minWidth: col.width } : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.id === 'name' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelectAll() }}
                        className="text-white/30 hover:text-white/60 shrink-0"
                      >
                        {allSelected ? <CheckSquare className="w-4 h-4 text-vc-blue-light" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                    {col.label}
                    <SortIcon colId={col.id} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-4 py-20">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center mb-4">
                      <MessageSquare className="w-7 h-7 text-white/15" />
                    </div>
                    <p className="text-white/40 font-medium text-sm">No conversations found</p>
                    <p className="text-white/25 text-xs mt-1 max-w-[280px]">Try adjusting your filters or date range to see matching conversations.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.contactId}
                  className={clsx(
                    'border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors',
                    i % 2 === 1 && 'bg-white/[0.01]',
                    selectedIds.has(row.contactId) && 'bg-vc-blue/5',
                  )}
                >
                  {visibleCols.map(col => (
                    <td
                      key={col.id}
                      className={clsx(
                        'px-3 py-2.5',
                        col.id === 'name' && 'sticky left-0 z-10 bg-[#0d081a]/95 backdrop-blur'
                      )}
                    >
                      {col.id === 'name' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleSelect(row.contactId)}
                            className="text-white/30 hover:text-white/60 shrink-0"
                          >
                            {selectedIds.has(row.contactId)
                              ? <CheckSquare className="w-4 h-4 text-vc-blue-light" />
                              : <Square className="w-4 h-4" />
                            }
                          </button>
                          <CellContent row={row} col={col} onSave={onSave} onResolveMatch={onResolveMatch} organizers={organizers} />
                        </div>
                      ) : (
                        <CellContent row={row} col={col} onSave={onSave} onResolveMatch={onResolveMatch} organizers={organizers} />
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Floating bulk action bar */}
      {someSelected && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1025]/95 backdrop-blur-xl border border-vc-blue/30 shadow-2xl shadow-black/50 animate-slide-up">
          <span className="text-sm text-white/70 font-medium">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
            <span className="text-white/40 ml-1">({selectedVolunteerIds.size} volunteer{selectedVolunteerIds.size !== 1 ? 's' : ''})</span>
          </span>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-white/40" />
            <select
              value={bulkOrgId}
              onChange={e => setBulkOrgId(e.target.value)}
              className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white/70 outline-none"
            >
              <option value="" className="bg-[#1a1025]">Reassign to...</option>
              {organizers?.map(o => (
                <option key={o.id} value={o.id} className="bg-[#1a1025]">{o.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkReassign}
              disabled={!bulkOrgId}
              className="px-3 py-1 rounded-lg bg-vc-blue text-white text-xs font-bold disabled:opacity-30 hover:bg-vc-blue/80 transition-colors"
            >
              Reassign
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-white/30 hover:text-white/60 ml-1"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

function CellContent({ row, col, onSave, onResolveMatch, organizers }: {
  row: ConversationRow
  col: ColumnConfig
  onSave: Props['onSave']
  onResolveMatch?: (contactId: string) => void
  organizers?: { id: string; name: string }[]
}) {
  switch (col.id) {
    case 'name':
      return (
        <div className="flex -mx-1">
          <EditableCell value={row.firstName} field="first_name" contactId={row.contactId} onSave={onSave} className="font-medium px-1" />
          <EditableCell value={row.lastName} field="last_name" contactId={row.contactId} onSave={onSave} className="font-medium px-1" />
        </div>
      )
    case 'phone':
      return <EditableCell value={row.phone} field="phone" contactId={row.contactId} onSave={onSave} />
    case 'address':
      return <EditableCell value={row.address} field="address" contactId={row.contactId} onSave={onSave} />
    case 'city':
      return <EditableCell value={row.city} field="city" contactId={row.contactId} onSave={onSave} />
    case 'zip':
      return <EditableCell value={row.zip} field="zip" contactId={row.contactId} onSave={onSave} />
    case 'contactOutcome':
      return <EditableCell value={row.contactOutcome} field="contact_outcome" contactId={row.contactId} onSave={onSave} type="outcome" />
    case 'notes':
      return <EditableCell value={row.notes} field="notes" contactId={row.contactId} onSave={onSave} type="textarea" />
    case 'volunteerName':
      return <span className="text-white/50 text-sm truncate">{row.volunteerName || '—'}</span>
    case 'organizerName':
      return (
        <OrganizerSelect
          currentOrganizerId={row.organizerId}
          currentOrganizerName={row.organizerName}
          volunteerName={row.volunteerName}
          organizers={organizers || []}
          onReassign={(newOrgId) => onSave(row.contactId, 'reassign_organizer', newOrgId)}
        />
      )
    case 'turfName':
      return <span className="text-white/50 text-sm truncate">{row.turfName || '—'}</span>
    case 'region':
      return <span className="text-white/50 text-sm">{row.region || '—'}</span>
    case 'matchStatus':
      return (
        <MatchStatusBadge
          status={row.matchStatus}
          confidence={row.matchConfidence}
          onResolve={onResolveMatch ? () => onResolveMatch(row.contactId) : undefined}
        />
      )
    case 'timestamp':
      return (
        <span className="text-white/50 text-xs tabular-nums whitespace-nowrap">
          {row.timestamp ? formatTimestamp(row.timestamp, row.timezone) : '—'}
          <span className="text-white/20 ml-1">{tzAbbrev(row.timezone)}</span>
        </span>
      )
    case 'entryMethod':
      return (
        <span className={clsx(
          'inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide',
          row.entryMethod === 'scan' && 'bg-blue-500/15 text-blue-300',
          row.entryMethod === 'chatbot' && 'bg-purple-500/15 text-purple-300',
          row.entryMethod === 'manual' && 'bg-white/5 text-white/40',
          row.entryMethod === 'import' && 'bg-amber-500/15 text-amber-300',
        )}>
          {row.entryMethod}
        </span>
      )
    case 'enteredBy':
      return (
        <span className="text-white/40 text-xs">
          {row.enteredBySelf ? 'Self' : (row.enteredByName || '—')}
        </span>
      )
    case 'outreachMethod':
      return <EditableCell value={row.outreachMethod} field="outreach_method" contactId={row.contactId} onSave={onSave} />
    case 'volunteerInterest':
      return <EditableCell value={row.volunteerInterest} field="volunteer_interest" contactId={row.contactId} onSave={onSave} />
    case 'surveyResponses':
      if (!row.surveyResponses || Object.keys(row.surveyResponses).length === 0) {
        return <span className="text-white/15 text-xs">—</span>
      }
      return (
        <div className="flex flex-wrap gap-1">
          {Object.entries(row.surveyResponses).map(([q, a]) => (
            <span key={q} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/50">
              <span className="text-white/30 truncate max-w-[60px]">{q}:</span>
              <span className="text-white/70">{a}</span>
            </span>
          ))}
        </div>
      )
    default:
      return <span className="text-white/30">—</span>
  }
}
