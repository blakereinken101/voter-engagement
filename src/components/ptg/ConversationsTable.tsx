'use client'

import type { ConversationRow, ColumnConfig, ConversationFilters } from '@/types'
import EditableCell from './EditableCell'
import clsx from 'clsx'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface Props {
  rows: ConversationRow[]
  columns: ColumnConfig[]
  filters: ConversationFilters
  onFiltersChange: (f: ConversationFilters) => void
  onSave: (contactId: string, field: string, value: string) => Promise<void>
}

/** Map column IDs to the sortBy key used by the API */
const SORTABLE: Record<string, string> = {
  name: 'name',
  contactOutcome: 'outcome',
  volunteerName: 'volunteer',
  organizerName: 'organizer',
  region: 'region',
  entryMethod: 'entryMethod',
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

export default function ConversationsTable({ rows, columns, filters, onFiltersChange, onSave }: Props) {
  const visibleCols = columns.filter(c => c.visible)

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
        ? <ArrowUp className="w-3 h-3 text-vc-purple-light" />
        : <ArrowDown className="w-3 h-3 text-vc-purple-light" />
    }
    return <ArrowUpDown className="w-3 h-3 text-white/15 group-hover:text-white/30" />
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.015] backdrop-blur-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-white/[0.04]">
            {visibleCols.map(col => (
              <th
                key={col.id}
                onClick={() => toggleSort(col.id)}
                className={clsx(
                  'px-3 py-2.5 text-left text-[11px] font-bold text-white/50 uppercase tracking-wider border-b border-white/[0.08] whitespace-nowrap',
                  col.id === 'name' && 'sticky left-0 z-10 bg-[#0d081a]/95 backdrop-blur min-w-[160px]',
                  SORTABLE[col.id] && 'cursor-pointer group hover:text-white/70 select-none',
                )}
                style={col.width ? { minWidth: col.width } : undefined}
              >
                <div className="flex items-center gap-1.5">
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
              <td colSpan={visibleCols.length} className="px-4 py-16 text-center text-white/30">
                No conversations found matching your filters.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.contactId}
                className={clsx(
                  'border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors',
                  i % 2 === 1 && 'bg-white/[0.01]'
                )}
              >
                {visibleCols.map(col => (
                  <td
                    key={col.id}
                    className={clsx(
                      'px-3 py-1.5',
                      col.id === 'name' && 'sticky left-0 z-10 bg-[#0d081a]/95 backdrop-blur'
                    )}
                  >
                    <CellContent row={row} col={col} onSave={onSave} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function CellContent({ row, col, onSave }: { row: ConversationRow; col: ColumnConfig; onSave: Props['onSave'] }) {
  switch (col.id) {
    case 'name':
      return (
        <div className="flex gap-1">
          <EditableCell value={row.firstName} field="first_name" contactId={row.contactId} onSave={onSave} className="font-medium" />
          <EditableCell value={row.lastName} field="last_name" contactId={row.contactId} onSave={onSave} className="font-medium" />
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
      return <span className="text-white/50 text-sm truncate">{row.organizerName || '—'}</span>
    case 'turfName':
      return <span className="text-white/50 text-sm truncate">{row.turfName || '—'}</span>
    case 'region':
      return <span className="text-white/50 text-sm">{row.region || '—'}</span>
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
          'inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
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
