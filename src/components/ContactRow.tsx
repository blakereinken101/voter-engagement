'use client'
import { useState } from 'react'
import { SpreadsheetRow, OutreachMethod, ContactOutcome, SafeVoterRecord } from '@/types'
import { CATEGORIES } from '@/lib/wizard-config'
import { getVoteHistoryDetail } from '@/lib/voter-segments'
import { getRelationshipTip } from '@/lib/scripts'
import { generateSmsLinkForContact } from '@/lib/sms-templates'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

const OUTREACH_LABELS: Record<OutreachMethod, { label: string; icon: string; tip: string }> = {
  text: { label: 'Text', icon: '💬', tip: 'Send a text message — casual and low-pressure' },
  call: { label: 'Call', icon: '📞', tip: 'Give them a call — more personal than texting' },
  'one-on-one': { label: '1:1', icon: '☕', tip: 'Meet up in person — the most persuasive approach' },
}

const OUTCOME_CONFIG: Record<ContactOutcome, { label: string; icon: string; color: string; tip: string }> = {
  'supporter': { label: 'Supporter', icon: '✊', color: 'bg-rally-green text-white', tip: 'They\'re on board and will vote!' },
  'undecided': { label: 'Undecided', icon: '🤔', color: 'bg-rally-yellow text-rally-navy', tip: 'Not sure yet — follow up closer to election day' },
  'opposed': { label: 'Opposed', icon: '✋', color: 'bg-gray-200 text-rally-slate', tip: 'Not interested — no need to push further' },
  'left-message': { label: 'Left msg', icon: '📩', color: 'bg-rally-navy/10 text-rally-navy', tip: 'Left a voicemail or message — try again later' },
  'no-answer': { label: 'No answer', icon: '📵', color: 'bg-rally-navy/10 text-rally-navy', tip: 'Didn\'t pick up — try a different time or method' },
}

interface Props {
  row: SpreadsheetRow
  index: number
  onToggleContacted: (personId: string, method: OutreachMethod) => void
  onOutcomeSelect: (personId: string, outcome: ContactOutcome) => void
  onRecontact: (personId: string) => void
  onNotesChange: (personId: string, notes: string) => void
  onRemove: (personId: string) => void
  onConfirmMatch: (personId: string, voterRecord: SafeVoterRecord) => void
  onRejectMatch: (personId: string) => void
  onVolunteerRecruit: (personId: string) => void
}

export default function ContactRow({
  row, index, onToggleContacted, onOutcomeSelect, onRecontact, onNotesChange,
  onRemove, onConfirmMatch, onRejectMatch, onVolunteerRecruit,
}: Props) {
  const { person, matchResult, actionItem } = row
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [showCandidates, setShowCandidates] = useState(false)
  const [localNotes, setLocalNotes] = useState(actionItem?.notes ?? '')

  const bestMatch = matchResult?.bestMatch
  const segment = matchResult?.segment
  const voteScore = matchResult?.voteScore
  const status = matchResult?.status
  const contacted = actionItem?.contacted ?? false
  const outreachMethod = actionItem?.outreachMethod
  const contactOutcome = actionItem?.contactOutcome
  const isRecontact = contactOutcome === 'left-message' || contactOutcome === 'no-answer'
  const isNew = person.createdAt && (Date.now() - person.createdAt) < 30000

  const catConfig = CATEGORIES.find(c => c.id === person.category)
  const voteHistory = bestMatch ? getVoteHistoryDetail(bestMatch) : []
  const relationshipTip = getRelationshipTip(person.category)

  const segmentColor = segment === 'super-voter' ? 'text-rally-green' :
    segment === 'sometimes-voter' ? 'text-rally-yellow' :
    segment === 'rarely-voter' ? 'text-rally-red' : 'text-rally-slate-light'

  return (
    <>
      <tr className={clsx(
        'border-b border-gray-100 hover:bg-rally-navy/[0.02] transition-all duration-200',
        index % 2 === 1 && 'bg-rally-navy/[0.015]',
        contacted && contactOutcome && !isRecontact && 'opacity-50',
        isNew && 'bg-rally-green/[0.06] animate-fade-in'
      )}>
        {/* Name */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1 group">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-left"
            >
              <span className="font-bold text-rally-navy text-sm">
                {person.firstName} {person.lastName}
              </span>
            </button>
            {isNew && (
              <span className="text-[9px] font-bold bg-rally-green text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide animate-fade-in">
                New
              </span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-rally-slate-light text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {expanded ? '▾' : '▸'}
            </button>
            <button
              onClick={() => onRemove(person.id)}
              className="text-rally-red/30 text-[10px] hover:text-rally-red transition-colors ml-1"
              title="Remove"
            >
              ✕
            </button>
          </div>
        </td>

        {/* Category */}
        <td className="py-2.5 px-2">
          <span className="text-xs bg-rally-navy/5 text-rally-slate px-2 py-0.5 rounded-full whitespace-nowrap">
            {catConfig?.icon}
          </span>
        </td>

        {/* City */}
        <td className="py-2.5 px-2 text-xs text-rally-slate-light">
          {bestMatch?.city || person.city || '—'}
        </td>

        {/* Match Status */}
        <td className="py-2.5 px-2">
          {!matchResult && (
            <span className="text-xs text-rally-slate-light">—</span>
          )}
          {status === 'confirmed' && (
            <span className="text-[10px] font-bold text-rally-green bg-rally-green/10 px-2 py-0.5 rounded-full">Matched</span>
          )}
          {status === 'unmatched' && (
            <span className="text-[10px] font-bold text-rally-slate-light bg-gray-100 px-2 py-0.5 rounded-full">No match</span>
          )}
          {status === 'ambiguous' && (
            <div className="relative">
              <button
                onClick={() => setShowCandidates(!showCandidates)}
                className="text-[10px] font-bold text-rally-yellow bg-rally-yellow/20 px-2 py-0.5 rounded-full hover:bg-rally-yellow/30 transition-colors"
              >
                Pick ▾
              </button>
              {showCandidates && matchResult?.candidates && (
                <div className="absolute z-20 top-full mt-1 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[280px]">
                  {matchResult.candidates.map((c, i) => {
                    const age = c.voterRecord.birth_year ? new Date().getFullYear() - parseInt(c.voterRecord.birth_year) : null
                    return (
                      <button
                        key={i}
                        onClick={() => { onConfirmMatch(person.id, c.voterRecord); setShowCandidates(false) }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-rally-navy/5 rounded transition-colors"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="font-bold">{c.voterRecord.first_name} {c.voterRecord.last_name}</span>
                          <span className="text-rally-slate-light font-mono ml-2">{Math.round(c.score * 100)}%</span>
                        </div>
                        <div className="text-rally-slate-light mt-0.5">
                          {c.voterRecord.residential_address}, {c.voterRecord.city}
                          {age && <span className="ml-1">&middot; Age {age}</span>}
                        </div>
                      </button>
                    )
                  })}
                  <button
                    onClick={() => { onRejectMatch(person.id); setShowCandidates(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-rally-red hover:bg-rally-red/5 rounded transition-colors font-bold"
                  >
                    None of these
                  </button>
                </div>
              )}
            </div>
          )}
        </td>

        {/* Vote Score */}
        <td className="py-2.5 px-2 text-center">
          {voteScore !== undefined ? (
            <span className={clsx('font-mono font-bold text-sm', segmentColor)}>
              {Math.round(voteScore * 100)}%
            </span>
          ) : (
            <span className="text-xs text-rally-slate-light">—</span>
          )}
        </td>

        {/* Outreach */}
        <td className="py-2.5 px-2">
          {!contacted ? (
            <div className="flex gap-1">
              {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, { label: string; icon: string; tip: string }][]).map(([method, { icon, tip }]) => (
                <button
                  key={method}
                  onClick={() => onToggleContacted(person.id, method)}
                  className="w-7 h-7 rounded text-xs border border-gray-200 hover:border-rally-navy hover:bg-rally-navy hover:text-white transition-all flex items-center justify-center"
                  title={tip}
                >
                  {icon}
                </button>
              ))}
              <button
                disabled={!person.phone}
                onClick={() => {
                  if (person.phone) {
                    const smsUrl = generateSmsLinkForContact(
                      person.phone,
                      person.firstName,
                      user?.name ?? 'Friend',
                      segment
                    )
                    window.open(smsUrl, '_blank')
                    onToggleContacted(person.id, 'text')
                  }
                }}
                className={clsx(
                  'w-7 h-7 rounded text-xs border transition-all flex items-center justify-center',
                  person.phone
                    ? 'border-gray-200 hover:border-rally-navy hover:bg-rally-navy hover:text-white cursor-pointer'
                    : 'border-gray-100 text-gray-300 cursor-not-allowed'
                )}
                title={person.phone ? 'Send SMS with template' : 'No phone number'}
              >
                📲
              </button>
            </div>
          ) : (
            <span className="text-xs text-rally-slate-light">
              {outreachMethod && `${OUTREACH_LABELS[outreachMethod].icon}`}
            </span>
          )}
        </td>

        {/* Outcome */}
        <td className="py-2.5 px-2">
          {contacted && !contactOutcome && (
            <div className="flex gap-1 flex-wrap">
              {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { icon, tip }]) => (
                <button
                  key={outcome}
                  onClick={() => onOutcomeSelect(person.id, outcome)}
                  className="w-6 h-6 rounded text-xs border border-gray-200 hover:border-rally-navy hover:bg-rally-navy hover:text-white transition-all flex items-center justify-center"
                  title={tip}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
          {contacted && contactOutcome && (
            <div className="flex items-center gap-1">
              <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', OUTCOME_CONFIG[contactOutcome].color)}>
                {OUTCOME_CONFIG[contactOutcome].icon} {OUTCOME_CONFIG[contactOutcome].label}
              </span>
              {isRecontact && (
                <button
                  onClick={() => onRecontact(person.id)}
                  className="text-[10px] text-rally-red hover:underline"
                  title="Try again"
                >
                  ↻
                </button>
              )}
              {contactOutcome === 'supporter' && !actionItem?.isVolunteerProspect && (
                <button
                  onClick={() => onVolunteerRecruit(person.id)}
                  className="text-[10px] text-rally-navy hover:underline font-bold ml-1"
                  title="Recruit as volunteer"
                >
                  Recruit
                </button>
              )}
              {actionItem?.isVolunteerProspect && (
                <span className="text-[10px] bg-rally-navy text-white px-1.5 py-0.5 rounded-full font-bold ml-1" title="Volunteer prospect">
                  Vol
                </span>
              )}
            </div>
          )}
          {!contacted && <span className="text-xs text-rally-slate-light">—</span>}
        </td>

        {/* Notes */}
        <td className="py-2.5 px-2">
          <input
            type="text"
            value={localNotes}
            onChange={e => setLocalNotes(e.target.value)}
            onBlur={() => onNotesChange(person.id, localNotes)}
            placeholder="Notes..."
            className="w-full px-2 py-1 border border-transparent hover:border-gray-200 focus:border-rally-red rounded text-xs text-rally-slate focus:outline-none focus:ring-1 focus:ring-rally-red bg-transparent"
          />
        </td>
      </tr>

      {/* Expanded details */}
      {expanded && (
        <tr className="border-b border-gray-100 bg-rally-navy/[0.02] transition-all duration-200">
          <td colSpan={8} className="px-3 py-3">
            <div className="flex flex-wrap gap-6 text-xs animate-fade-in">
              {/* Person details */}
              <div className="space-y-1">
                <p className="font-bold text-rally-navy text-[10px] uppercase tracking-wider">Details</p>
                {person.address && <p className="text-rally-slate-light">{person.address}</p>}
                {person.city && <p className="text-rally-slate-light">{person.city}{person.zip ? `, ${person.zip}` : ''}</p>}
                {person.age && <p className="text-rally-slate-light">Age {person.age}</p>}
                {person.gender && <p className="text-rally-slate-light">{person.gender === 'M' ? 'Male' : 'Female'}</p>}
                <p className="text-rally-slate-light">{catConfig?.icon} {catConfig?.id.replace(/-/g, ' ')}</p>
              </div>

              {/* Vote history */}
              {voteHistory.length > 0 && (
                <div>
                  <p className="font-bold text-rally-navy text-[10px] uppercase tracking-wider mb-1">Vote History</p>
                  <div className="grid grid-cols-6 gap-1">
                    {voteHistory.map(({ election, year, type, voted }) => (
                      <div
                        key={election}
                        className={clsx(
                          'text-[9px] rounded p-1 text-center',
                          voted ? 'bg-rally-green text-white font-bold' : 'bg-gray-100 text-gray-400'
                        )}
                      >
                        <div>{year}</div>
                        <div>{type.slice(0, 3)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relationship tip */}
              {relationshipTip && (
                <div className="max-w-xs">
                  <p className="font-bold text-rally-navy text-[10px] uppercase tracking-wider mb-1">Tip</p>
                  <p className="text-rally-slate-light leading-relaxed">{relationshipTip}</p>
                </div>
              )}

              {/* Voter match details */}
              {bestMatch && (
                <div>
                  <p className="font-bold text-rally-navy text-[10px] uppercase tracking-wider mb-1">Voter Record</p>
                  <p className="text-rally-slate-light">{bestMatch.first_name} {bestMatch.last_name}</p>
                  <p className="text-rally-slate-light">{bestMatch.residential_address}</p>
                  <p className="text-rally-slate-light">{bestMatch.city}, {bestMatch.state} {bestMatch.zip}</p>
                  {bestMatch.birth_year && <p className="text-rally-slate-light">Born {bestMatch.birth_year}</p>}
                  <p className="text-rally-slate-light">Party: {bestMatch.party_affiliation}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
