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
import { Pencil, MapPin, ClipboardList, HelpCircle, MessageCircle, Phone, Coffee, Smartphone, ThumbsUp, ThumbsDown, Mail } from 'lucide-react'
import clsx from 'clsx'

const INTAKE_TABS: { id: IntakeMode; label: string; Icon: typeof Pencil }[] = [
  { id: 'manual', label: 'Manual', Icon: Pencil },
  { id: 'nearby', label: 'Nearby', Icon: MapPin },
  { id: 'contacts', label: 'Contacts', Icon: ClipboardList },
]

function ConversationGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-4 mt-1 mb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-vc-purple-light/70 hover:text-vc-purple-light transition-colors group"
      >
        <span className="bg-vc-purple/20 rounded-full w-5 h-5 flex items-center justify-center group-hover:bg-vc-purple/30 transition-colors">
          <HelpCircle className="w-3 h-3" />
        </span>
        <span className="font-medium">{open ? 'Hide conversation tips' : 'How do I talk to people about voting?'}</span>
      </button>
      {open && (
        <div className="mt-2 glass-card p-4 text-xs text-white/80 leading-relaxed animate-fade-in">
          <p className="font-bold text-white text-sm mb-2">Quick Conversation Guide</p>
          <div className="space-y-2">
            <p><span className="font-bold text-white">Start casual:</span> {'"Hey, I\'ve been thinking about the election and wanted to see where you\'re at."'}</p>
            <p><span className="font-bold text-white">Listen first:</span> Ask what issues matter to them before sharing your perspective.</p>
            <p><span className="font-bold text-white">Share why it matters to you:</span> Personal stories are more persuasive than facts and figures.</p>
            <p><span className="font-bold text-white">Make a specific ask:</span> {'"Would you be willing to vote on November 5th?"'} is better than {'"You should vote."'}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="font-bold text-white mb-1">Icon Guide:</p>
            <div className="grid grid-cols-2 gap-1.5">
              <span className="flex items-center gap-1.5"><MessageCircle className="w-3 h-3 text-vc-purple-light" /> <b>Text</b> — Send a text</span>
              <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-vc-purple-light" /> <b>Call</b> — Give them a call</span>
              <span className="flex items-center gap-1.5"><Coffee className="w-3 h-3 text-vc-purple-light" /> <b>1:1</b> — Meet in person</span>
              <span className="flex items-center gap-1.5"><Smartphone className="w-3 h-3 text-vc-purple-light" /> <b>SMS</b> — Auto-compose text</span>
              <span className="flex items-center gap-1.5"><ThumbsUp className="w-3 h-3 text-vc-teal" /> <b>Supporter</b> — They will vote</span>
              <span className="flex items-center gap-1.5"><HelpCircle className="w-3 h-3 text-vc-gold" /> <b>Undecided</b> — Needs follow-up</span>
              <span className="flex items-center gap-1.5"><ThumbsDown className="w-3 h-3 text-white/40" /> <b>Opposed</b> — Not interested</span>
              <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-vc-purple-light" /> <b>Left msg</b> — Try again later</span>
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
      {/* Intake mode tabs — glass pills */}
      <div className="px-4 pt-4 pb-2">
        <div className="glass-card p-1.5 inline-flex gap-1 mb-3">
          {INTAKE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setIntakeMode(tab.id)}
              className={clsx(
                'px-5 py-2.5 rounded-btn text-sm font-bold transition-all flex items-center gap-1.5',
                intakeMode === tab.id
                  ? 'bg-vc-purple text-white shadow-glow'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              )}
            >
              <tab.Icon className="w-4 h-4" /> {tab.label}
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

      {/* Filters — glass bar */}
      {rows.length > 0 && (
        <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="glass-input px-3 py-2 rounded-btn text-sm w-48"
            maxLength={100}
          />
          <select
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value as SegmentFilter)}
            className="glass-input px-3 py-2 rounded-btn text-sm"
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
            className="glass-input px-3 py-2 rounded-btn text-sm"
          >
            <option value="all">All outcomes</option>
            <option value="not-contacted">Not contacted</option>
            <option value="supporter">Supporters</option>
            <option value="undecided">Undecided</option>
            <option value="left-message">Left message</option>
            <option value="no-answer">No answer</option>
            <option value="opposed">Not interested</option>
          </select>
          <span className="text-xs text-white/60 font-display tabular-nums ml-auto">
            {sorted.length} of {rows.length}
          </span>
        </div>
      )}

      {/* Desktop table */}
      {rows.length > 0 && (
        <div className="hidden md:block flex-1 overflow-auto px-4 pb-20">
          <table className="w-full text-left border-separate" style={{ borderSpacing: '0 4px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                <th className="py-2 px-3 cursor-pointer hover:text-white/70 transition-colors" onClick={() => handleSort('name')}>
                  Name{sortIndicator('name')}
                </th>
                <th className="py-2 px-2 cursor-pointer hover:text-white/70 transition-colors" onClick={() => handleSort('category')}>
                  Cat{sortIndicator('category')}
                </th>
                <th className="py-2 px-2">City</th>
                <th className="py-2 px-2 cursor-pointer hover:text-white/70 transition-colors" onClick={() => handleSort('matchStatus')}>
                  Match{sortIndicator('matchStatus')}
                </th>
                <th className="py-2 px-2 cursor-pointer hover:text-white/70 transition-colors text-center" onClick={() => handleSort('voteScore')}>
                  Vote %{sortIndicator('voteScore')}
                </th>
                <th className="py-2 px-2">Outreach</th>
                <th className="py-2 px-2 cursor-pointer hover:text-white/70 transition-colors" onClick={() => handleSort('outcome')}>
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
          <p className="text-white/60 text-sm font-medium">
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
