'use client'
import { useState } from 'react'
import { SpreadsheetRow, OutreachMethod, ContactOutcome, SafeVoterRecord, VolunteerInterest as VolInterest } from '@/types'
import { CATEGORIES } from '@/lib/wizard-config'
import { CATEGORY_ICONS, getSegmentColors, OUTCOME_CONFIG, isRecontactOutcome } from '@/lib/contact-config'
import { getVoteHistoryDetail } from '@/lib/voter-segments'
import { getRelationshipTip } from '@/lib/scripts'
import ContactItemHeader from './ContactItemHeader'
import MatchStatusBadge from './MatchStatusBadge'
import OutreachButtons from './OutreachButtons'
import OutcomeSelector from './OutcomeSelector'
import SurveyInline from './SurveyInline'
import VolunteerInterestComp from './VolunteerInterest'
import NotesInput from './NotesInput'
import EventRsvpBadges from './EventRsvpBadges'
import clsx from 'clsx'

interface Props {
  row: SpreadsheetRow
  eventRsvps?: Array<{ eventId: string; eventTitle: string; status: string; startTime: string }>
  onToggleContacted: (personId: string, method: OutreachMethod) => void
  onOutcomeSelect: (personId: string, outcome: ContactOutcome) => void
  onRecontact: (personId: string) => void
  onNotesChange: (personId: string, notes: string) => void
  onRemove: (personId: string) => void
  onConfirmMatch: (personId: string, voterRecord: SafeVoterRecord) => void
  onRejectMatch: (personId: string) => void
  onVolunteerInterest: (personId: string, interest: VolInterest) => void
  onSurveyChange: (personId: string, responses: Record<string, string>) => void
  onRematch?: (personId: string) => void
}

export default function ContactItem({
  row, eventRsvps, onToggleContacted, onOutcomeSelect, onRecontact, onNotesChange,
  onRemove, onConfirmMatch, onRejectMatch, onVolunteerInterest, onSurveyChange, onRematch,
}: Props) {
  const { person, matchResult, actionItem } = row
  const [expanded, setExpanded] = useState(false)

  const bestMatch = matchResult?.bestMatch
  const segment = matchResult?.segment
  const contacted = actionItem?.contacted ?? false
  const outreachMethod = actionItem?.outreachMethod
  const contactOutcome = actionItem?.contactOutcome
  const outcomeValid = contactOutcome && contactOutcome in OUTCOME_CONFIG
  const isRecontact = isRecontactOutcome(contactOutcome)
  const isNew = person.createdAt && (Date.now() - person.createdAt) < 30000
  const isDimmed = contacted && !!contactOutcome && !isRecontact

  const catConfig = CATEGORIES.find(c => c.id === person.category)
  const voteHistory = bestMatch ? getVoteHistoryDetail(bestMatch) : []
  const relationshipTip = getRelationshipTip(person.category)
  const { textColor } = getSegmentColors(segment)

  return (
    <div className={clsx(
      'glass-card p-4 md:p-5 transition-all duration-200',
      isDimmed && 'bg-white/[0.02]',
      isNew && 'ring-2 ring-vc-teal/30 animate-fade-in'
    )}>
      {/* ─── Header: Name, meta, score, chevron, delete ─── */}
      <ContactItemHeader
        person={person}
        matchResult={matchResult}
        isNew={!!isNew}
        isDimmed={isDimmed}
        expanded={expanded}
        onToggleExpand={() => setExpanded(!expanded)}
        onRemove={onRemove}
      />

      {/* ─── Match status row ─── */}
      <div className="mt-2 ml-4 flex items-center gap-2 flex-wrap">
        <MatchStatusBadge
          person={person}
          matchResult={matchResult}
          onConfirmMatch={onConfirmMatch}
          onRejectMatch={onRejectMatch}
          onRematch={onRematch}
        />

        {/* Outcome badge + volunteer interest (inline on this row when outcome exists) */}
        {contacted && outcomeValid && (
          <>
            <OutcomeSelector
              personId={person.id}
              firstName={person.firstName}
              contacted={contacted}
              contactOutcome={contactOutcome}
              onOutcomeSelect={onOutcomeSelect}
              onRecontact={onRecontact}
            />
            <VolunteerInterestComp
              personId={person.id}
              contactOutcome={contactOutcome}
              actionItem={actionItem}
              onVolunteerInterest={onVolunteerInterest}
            />
          </>
        )}
      </div>

      {/* ─── Progressive disclosure zone ─── */}
      <div className="mt-3 space-y-3">
        {/* Outreach buttons — only when not contacted */}
        {!contacted && (
          <OutreachButtons
            person={person}
            matchResult={matchResult}
            contacted={contacted}
            outreachMethod={outreachMethod}
            onToggleContacted={onToggleContacted}
          />
        )}

        {/* Outreach method used + Outcome selector — contacted but no outcome */}
        {contacted && !outcomeValid && (
          <div className="space-y-2">
            <OutreachButtons
              person={person}
              matchResult={matchResult}
              contacted={contacted}
              outreachMethod={outreachMethod}
              onToggleContacted={onToggleContacted}
            />
            <OutcomeSelector
              personId={person.id}
              firstName={person.firstName}
              contacted={contacted}
              contactOutcome={contactOutcome}
              onOutcomeSelect={onOutcomeSelect}
              onRecontact={onRecontact}
            />
          </div>
        )}

        {/* Survey — auto-appears after response outcome */}
        <SurveyInline
          personId={person.id}
          actionItem={actionItem}
          contacted={contacted}
          contactOutcome={contactOutcome}
          onSurveyChange={onSurveyChange}
        />

        {/* Event RSVPs */}
        <EventRsvpBadges rsvps={eventRsvps} />

        {/* Notes */}
        <NotesInput
          personId={person.id}
          initialNotes={actionItem?.notes ?? ''}
          onNotesChange={onNotesChange}
        />
      </div>

      {/* ─── Expanded details ─── */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in">
          <div className="flex flex-wrap gap-6 text-xs">
            {/* Person details */}
            <div className="space-y-1 min-w-[140px]">
              <p className="font-bold text-vc-purple-light text-[10px] uppercase tracking-wider">Details</p>
              {person.address && <p className="text-white/60">{person.address}</p>}
              {person.city && <p className="text-white/60">{person.city}{person.zip ? `, ${person.zip}` : ''}</p>}
              {person.age && <p className="text-white/60">Age {person.age}</p>}
              {person.gender && <p className="text-white/60">{person.gender === 'M' ? 'Male' : 'Female'}</p>}
              <p className="text-white/60 flex items-center gap-1">
                {catConfig?.icon && CATEGORY_ICONS[catConfig.icon] && (() => { const CatIcon = CATEGORY_ICONS[catConfig.icon]; return <CatIcon className="w-3 h-3" /> })()}
                {catConfig?.id.replace(/-/g, ' ')}
              </p>
            </div>

            {/* Vote history */}
            {voteHistory.length > 0 && (
              <div>
                <p className="font-bold text-vc-purple-light text-[10px] uppercase tracking-wider mb-1">Vote History</p>
                <div className="grid grid-cols-6 gap-1">
                  {voteHistory.map(({ election, year, type, voted }) => (
                    <div
                      key={election}
                      className={clsx(
                        'text-[9px] rounded p-1.5 text-center',
                        voted ? 'bg-vc-teal text-white font-bold' : 'bg-white/10 text-white/40'
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
                <p className="font-bold text-vc-purple-light text-[10px] uppercase tracking-wider mb-1">Tip</p>
                <p className="text-white/60 leading-relaxed">{relationshipTip}</p>
              </div>
            )}

            {/* Voter match details */}
            {bestMatch && (
              <div>
                <p className="font-bold text-vc-purple-light text-[10px] uppercase tracking-wider mb-1">Voter Record</p>
                <p className="text-white/60">{bestMatch.first_name} {bestMatch.last_name}</p>
                <p className="text-white/60">{bestMatch.residential_address}</p>
                <p className="text-white/60">{bestMatch.city}, {bestMatch.state} {bestMatch.zip}</p>
                {bestMatch.birth_year && <p className="text-white/60">Born {bestMatch.birth_year}</p>}
                <p className="text-white/60">Party: {bestMatch.party_affiliation}</p>
              </div>
            )}

            {/* Event RSVPs in expanded view (more detail) */}
            {eventRsvps && eventRsvps.length > 0 && (
              <div>
                <p className="font-bold text-vc-purple-light text-[10px] uppercase tracking-wider mb-1">Event RSVPs</p>
                <EventRsvpBadges rsvps={eventRsvps} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
