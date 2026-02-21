'use client'
import { useState, useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import { SpreadsheetRow, SortField, SortDirection, SegmentFilter, OutcomeFilter, IntakeMode } from '@/types'
import InlineAddRow from './InlineAddRow'
import ContactRow from './ContactRow'
import ContactCard from './ContactCard'
import MatchAllBar from './MatchAllBar'
import NearbyPanel from './NearbyPanel'
import ContactsPanel from './ContactsPanel'
import clsx from 'clsx'

const INTAKE_TABS: { id: IntakeMode; label: string; icon: string }[] = [
  { id: 'manual', label: 'Manual', icon: '✏️' },
  { id: 'nearby', label: 'Nearby', icon: '📍' },
  { id: 'contacts', label: 'Contacts', icon: '📋' },
]

function ConversationGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-4 mt-1 mb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-rally-navy/70 hover:text-rally-navy transition-colors group"
      >
        <span className="bg-rally-navy/10 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold group-hover:bg-rally-navy/20 transition-colors">?</span>
        <span className="font-medium">{open ? 'Hide conversation tips' : 'How do I talk to people about voting?'}</span>
      </button>
      {open && (
        <div className="mt-2 bg-rally-navy/[0.03] rounded-lg p-4 text-xs text-rally-slate leading-relaxed animate-fade-in border border-rally-navy/10">
          <p className="font-bold text-rally-navy text-sm mb-2">Quick Conversation Guide</p>
          <div className="space-y-2">
            <p><span className="font-bold">Start casual:</span> {'"Hey, I\'ve been thinking about the election and wanted to see where you\'re at."'}</p>
            <p><span className="font-bold">Listen first:</span> Ask what issues matter to them before sharing your perspective.</p>
            <p><span className="font-bold">Share why it matters to you:</span> Personal stories are more persuasive than facts and figures.</p>
            <p><span className="font-bold">Make a specific ask:</span> {'"Would you be willing to vote on November 5th?"'} is better than {'"You should vote."'}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-rally-navy/10">
            <p className="font-bold text-rally-navy mb-1">Icon Guide:</p>
            <div className="grid grid-cols-2 gap-1.5">
              <span title="Send a text message — casual and low-pressure">💬 <b>Text</b> — Send a text message</span>
              <span title="Give them a call — more personal than texting">📞 <b>Call</b> — Give them a call</span>
              <span title="Meet up in person — the most persuasive approach">☕ <b>1:1</b> — Meet in person</span>
              <span title="Send SMS with template">📲 <b>SMS</b> — Auto-compose text</span>
              <span title="They're on board and will vote!">✊ <b>Supporter</b> — They will vote</span>
              <span title="Not sure yet — follow up closer to election day">🤔 <b>Undecided</b> — Needs follow-up</span>
              <span title="Not interested — no need to push further">✋ <b>Opposed</b> — Not interested</span>
              <span title="Left a voicemail or message — try again later">📩 <b>Left msg</b> — Try again later</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ContactSpreadsheet() {
  const { state, toggleContacted, setContactOutcome, clearContact, updateNote, confirmMatch, rejectMatch, runMatchingForUnmatched, setVolunteerProspect, dispatch } = useAppContext()

  const [intakeMode, setIntakeMode] = useState<IntakeMode>('manual')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')
  const [search, setSearch] = useState('')

  // Build unified rows
  const rows: SpreadsheetRow[] = useMemo(() => {
    return state.personEntries.map(person => {
      const matchResult = state.matchResults.find(r => r.personEntry.id === person.id)
      const actionItem = state.actionPlanState.find(a => a.matchResult.personEntry.id === person.id)
      return { person, matchResult, actionItem }
    })
  }, [state.personEntries, state.matchResults, state.actionPlanState])

  // Filter
  const filtered = useMemo(() => {
    let result = rows

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        `${r.person.firstName} ${r.person.lastName}`.toLowerCase().includes(q)
      )
    }

    if (segmentFilter !== 'all') {
      if (segmentFilter === 'unmatched') {
        result = result.filter(r => !r.matchResult || r.matchResult.status === 'unmatched')
      } else {
        result = result.filter(r => r.matchResult?.segment === segmentFilter)
      }
    }

    if (outcomeFilter !== 'all') {
      if (outcomeFilter === 'not-contacted') {
        result = result.filter(r => !r.actionItem?.contacted)
      } else {
        result = result.filter(r => r.actionItem?.contactOutcome === outcomeFilter)
      }
    }

    return result
  }, [rows, search, segmentFilter, outcomeFilter])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = sortDir === 'asc' ? 1 : -1

    arr.sort((a, b) => {
      switch (sortField) {
        case 'name':
          return dir * `${a.person.lastName} ${a.person.firstName}`.localeCompare(`${b.person.lastName} ${b.person.firstName}`)
        case 'category':
          return dir * a.person.category.localeCompare(b.person.category)
        case 'matchStatus': {
          const order = { confirmed: 0, ambiguous: 1, unmatched: 2 }
          const aVal = a.matchResult?.status ? order[a.matchResult.status as keyof typeof order] ?? 3 : 3
          const bVal = b.matchResult?.status ? order[b.matchResult.status as keyof typeof order] ?? 3 : 3
          return dir * (aVal - bVal)
        }
        case 'voteScore':
          return dir * ((a.matchResult?.voteScore ?? -1) - (b.matchResult?.voteScore ?? -1))
        case 'contacted':
          return dir * (Number(a.actionItem?.contacted ?? false) - Number(b.actionItem?.contacted ?? false))
        case 'outcome': {
          const oOrder = { supporter: 0, undecided: 1, 'left-message': 2, 'no-answer': 3, opposed: 4 }
          const aO = a.actionItem?.contactOutcome ? oOrder[a.actionItem.contactOutcome as keyof typeof oOrder] ?? 5 : 5
          const bO = b.actionItem?.contactOutcome ? oOrder[b.actionItem.contactOutcome as keyof typeof oOrder] ?? 5 : 5
          return dir * (aO - bO)
        }
        default:
          return 0
      }
    })
    return arr
  }, [filtered, sortField, sortDir])

  const unmatchedCount = state.personEntries.filter(p =>
    !state.matchResults.find(r => r.personEntry.id === p.id)
  ).length

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function handleRemove(personId: string) {
    dispatch({ type: 'REMOVE_PERSON', payload: personId })
  }

  function handleVolunteerRecruit(personId: string) {
    setVolunteerProspect(personId, true)
  }

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : ''

  return (
    <div className="flex flex-col h-full">
      {/* Intake mode tabs */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-1 mb-3">
          {INTAKE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setIntakeMode(tab.id)}
              className={clsx(
                'px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-b-2',
                intakeMode === tab.id
                  ? 'bg-white text-rally-navy border-rally-red shadow-sm'
                  : 'bg-transparent text-rally-slate-light border-transparent hover:text-rally-navy hover:bg-white/50'
              )}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Mode-specific content */}
        {intakeMode === 'manual' && <InlineAddRow />}
        {intakeMode === 'nearby' && <NearbyPanel />}
        {intakeMode === 'contacts' && <ContactsPanel />}
      </div>

      {/* Conversation guide tip */}
      {rows.length > 0 && rows.length <= 60 && (
        <ConversationGuide />
      )}

      {/* Filters */}
      {rows.length > 0 && (
        <div className="px-4 py-3 flex flex-wrap gap-2 items-center border-t border-gray-200">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rally-red w-48"
            maxLength={100}
          />
          <select
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value as SegmentFilter)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rally-red"
          >
            <option value="all">All segments</option>
            <option value="super-voter">Super Voters</option>
            <option value="sometimes-voter">Sometimes Voters</option>
            <option value="rarely-voter">Rarely Voters</option>
            <option value="unmatched">Unmatched</option>
          </select>
          <select
            value={outcomeFilter}
            onChange={e => setOutcomeFilter(e.target.value as OutcomeFilter)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rally-red"
          >
            <option value="all">All outcomes</option>
            <option value="not-contacted">Not contacted</option>
            <option value="supporter">Supporters</option>
            <option value="undecided">Undecided</option>
            <option value="left-message">Left message</option>
            <option value="no-answer">No answer</option>
            <option value="opposed">Not interested</option>
          </select>
          <span className="text-xs text-rally-slate-light font-mono ml-auto">
            {sorted.length} of {rows.length}
          </span>
        </div>
      )}

      {/* Desktop table */}
      {rows.length > 0 && (
        <div className="hidden md:block flex-1 overflow-auto px-4 pb-20">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-rally-cream z-10">
              <tr className="border-b-2 border-gray-200 text-[10px] font-bold text-rally-slate-light uppercase tracking-wider">
                <th className="py-2 px-3 cursor-pointer hover:text-rally-navy transition-colors" onClick={() => handleSort('name')}>
                  Name{sortIndicator('name')}
                </th>
                <th className="py-2 px-2 cursor-pointer hover:text-rally-navy transition-colors" onClick={() => handleSort('category')}>
                  Cat{sortIndicator('category')}
                </th>
                <th className="py-2 px-2">City</th>
                <th className="py-2 px-2 cursor-pointer hover:text-rally-navy transition-colors" onClick={() => handleSort('matchStatus')}>
                  Match{sortIndicator('matchStatus')}
                </th>
                <th className="py-2 px-2 cursor-pointer hover:text-rally-navy transition-colors text-center" onClick={() => handleSort('voteScore')}>
                  Vote %{sortIndicator('voteScore')}
                </th>
                <th className="py-2 px-2">Outreach</th>
                <th className="py-2 px-2 cursor-pointer hover:text-rally-navy transition-colors" onClick={() => handleSort('outcome')}>
                  Outcome{sortIndicator('outcome')}
                </th>
                <th className="py-2 px-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <ContactRow
                  key={row.person.id}
                  row={row}
                  index={i}
                  onToggleContacted={toggleContacted}
                  onOutcomeSelect={setContactOutcome}
                  onRecontact={clearContact}
                  onNotesChange={updateNote}
                  onRemove={handleRemove}
                  onConfirmMatch={confirmMatch}
                  onRejectMatch={rejectMatch}
                  onVolunteerRecruit={handleVolunteerRecruit}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {rows.length > 0 && (
        <div className="md:hidden flex-1 overflow-auto px-4 pb-20 space-y-3">
          {sorted.map(row => (
            <ContactCard
              key={row.person.id}
              row={row}
              onToggleContacted={toggleContacted}
              onOutcomeSelect={setContactOutcome}
              onRecontact={clearContact}
              onNotesChange={updateNote}
              onRemove={handleRemove}
              onConfirmMatch={confirmMatch}
              onRejectMatch={rejectMatch}
              onVolunteerRecruit={handleVolunteerRecruit}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-rally-slate-light text-sm">
            Add your first contact above to get started.
          </p>
        </div>
      )}

      {/* Match bar */}
      <MatchAllBar
        unmatchedCount={unmatchedCount}
        isLoading={state.isLoading}
        onMatchAll={runMatchingForUnmatched}
      />
    </div>
  )
}
