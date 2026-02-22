'use client'
import { useState } from 'react'
import { SpreadsheetRow, OutreachMethod, ContactOutcome, SafeVoterRecord } from '@/types'
import { CATEGORIES } from '@/lib/wizard-config'
import { getVoteHistoryDetail } from '@/lib/voter-segments'
import { getRelationshipTip } from '@/lib/scripts'
import { generateSmsLinkForContact } from '@/lib/sms-templates'
import defaultCampaignConfig from '@/lib/campaign-config'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'
import {
  MessageCircle,
  Phone,
  Coffee,
  ThumbsUp,
  HelpCircle,
  ThumbsDown,
  Mail,
  PhoneOff,
  Smartphone,
  X,
  RotateCcw,
  Home,
  Heart,
  Users,
  Star,
  PartyPopper,
  Building,
  Briefcase,
  Landmark,
  GraduationCap,
  Trophy,
  BookOpen,
  Search,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: Home, heart: Heart, users: Users, star: Star,
  'party-popper': PartyPopper, building: Building, briefcase: Briefcase,
  landmark: Landmark, 'graduation-cap': GraduationCap, trophy: Trophy,
  'book-open': BookOpen, coffee: Coffee, utensils: Utensils, search: Search,
}

const OUTREACH_LABELS: Record<OutreachMethod, { label: string; Icon: typeof MessageCircle; tip: string }> = {
  text: { label: 'Text', Icon: MessageCircle, tip: 'Send a text message — casual and low-pressure' },
  call: { label: 'Call', Icon: Phone, tip: 'Give them a call — more personal than texting' },
  'one-on-one': { label: '1:1', Icon: Coffee, tip: 'Meet up in person — the most persuasive approach' },
}

const OUTCOME_CONFIG: Record<ContactOutcome, { label: string; Icon: typeof MessageCircle; color: string; tip: string }> = {
  'supporter': { label: 'Supporter', Icon: ThumbsUp, color: 'bg-vc-teal text-white', tip: 'They\'re on board and will vote!' },
  'undecided': { label: 'Undecided', Icon: HelpCircle, color: 'bg-vc-gold text-vc-purple', tip: 'Not sure yet — follow up closer to election day' },
  'opposed': { label: 'Opposed', Icon: ThumbsDown, color: 'bg-white/10 text-white/60', tip: 'Not interested — no need to push further' },
  'left-message': { label: 'Left msg', Icon: Mail, color: 'bg-vc-purple/10 text-vc-purple-light', tip: 'Left a voicemail or message — try again later' },
  'no-answer': { label: 'No answer', Icon: PhoneOff, color: 'bg-vc-purple/10 text-vc-purple-light', tip: 'Didn\'t pick up — try a different time or method' },
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
  onSurveyChange: (personId: string, responses: Record<string, string>) => void
}

export default function ContactRow({
  row, index, onToggleContacted, onOutcomeSelect, onRecontact, onNotesChange,
  onRemove, onConfirmMatch, onRejectMatch, onVolunteerRecruit, onSurveyChange,
}: Props) {
  const { person, matchResult, actionItem } = row
  const { user, campaignConfig: authConfig } = useAuth()
  const campaignConfig = authConfig || defaultCampaignConfig
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
  const outcomeValid = contactOutcome && contactOutcome in OUTCOME_CONFIG
  const isRecontact = contactOutcome === 'left-message' || contactOutcome === 'no-answer'
  const isNew = person.createdAt && (Date.now() - person.createdAt) < 30000

  const catConfig = CATEGORIES.find(c => c.id === person.category)
  const voteHistory = bestMatch ? getVoteHistoryDetail(bestMatch) : []
  const relationshipTip = getRelationshipTip(person.category)

  const segmentColor = segment === 'super-voter' ? 'text-vc-teal' :
    segment === 'sometimes-voter' ? 'text-vc-gold' :
    segment === 'rarely-voter' ? 'text-vc-coral' : 'text-white/40'

  return (
    <>
      <tr className={clsx(
        'glass-row transition-all duration-200',
        contacted && contactOutcome && !isRecontact && 'opacity-75',
        isNew && 'bg-vc-teal/[0.06] animate-fade-in'
      )}>
        {/* Name */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1 group">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-left"
            >
              <span className="font-bold text-white text-lg">
                {person.firstName} {person.lastName}
              </span>
            </button>
            {isNew && (
              <span className="text-[9px] font-bold bg-vc-teal text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide animate-fade-in">
                New
              </span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-white/40 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {expanded ? '▾' : '▸'}
            </button>
            <button
              onClick={() => onRemove(person.id)}
              className="text-vc-coral/30 text-[10px] hover:text-vc-coral transition-colors ml-1"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </td>

        {/* Category */}
        <td className="py-2.5 px-2">
          <span className="text-xs bg-white/10 text-white/90 px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1">
            {catConfig?.icon && CATEGORY_ICONS[catConfig.icon] && (() => { const CatIcon = CATEGORY_ICONS[catConfig.icon]; return <CatIcon className="w-3 h-3" /> })()}
          </span>
        </td>

        {/* City */}
        <td className="py-2.5 px-2 text-xs text-white/70">
          {bestMatch?.city || person.city || '—'}
        </td>

        {/* Match Status */}
        <td className="py-2.5 px-2">
          {!matchResult && (
            <span className="text-xs text-white/50">—</span>
          )}
          {status === 'confirmed' && (
            <span className="text-[10px] font-bold text-vc-teal bg-vc-teal/10 px-2 py-0.5 rounded-full">Matched</span>
          )}
          {status === 'unmatched' && (
            <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">No match</span>
          )}
          {status === 'ambiguous' && (
            <div className="relative">
              <button
                onClick={() => setShowCandidates(!showCandidates)}
                className="text-[10px] font-bold text-vc-gold bg-vc-gold/20 px-2 py-0.5 rounded-full hover:bg-vc-gold/30 transition-colors"
              >
                Pick ▾
              </button>
              {showCandidates && matchResult?.candidates && (
                <div className="absolute z-20 top-full mt-1 left-0 glass-card rounded-lg shadow-lg border border-white/15 p-2 min-w-[280px]">
                  {matchResult.candidates.map((c, i) => {
                    const age = c.voterRecord.birth_year ? new Date().getFullYear() - parseInt(c.voterRecord.birth_year) : null
                    return (
                      <button
                        key={i}
                        onClick={() => { onConfirmMatch(person.id, c.voterRecord); setShowCandidates(false) }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 rounded transition-colors"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="font-bold text-white">{c.voterRecord.first_name} {c.voterRecord.last_name}</span>
                          <span className="text-white/40 font-display tabular-nums ml-2">{Math.round(c.score * 100)}%</span>
                        </div>
                        <div className="text-white/40 mt-0.5">
                          {c.voterRecord.residential_address}, {c.voterRecord.city}
                          {age && <span className="ml-1">&middot; Age {age}</span>}
                        </div>
                      </button>
                    )
                  })}
                  <button
                    onClick={() => { onRejectMatch(person.id); setShowCandidates(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-vc-coral hover:bg-vc-coral/5 rounded transition-colors font-bold"
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
            <span className={clsx('font-display font-bold text-sm', segmentColor)}>
              {Math.round(voteScore * 100)}%
            </span>
          ) : (
            <span className="text-xs text-white/40">—</span>
          )}
        </td>

        {/* Outreach */}
        <td className="py-2.5 px-2">
          {!contacted ? (
            <div className="flex gap-1">
              {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, { label: string; Icon: typeof MessageCircle; tip: string }][]).map(([method, { Icon, tip }]) => (
                <button
                  key={method}
                  onClick={() => onToggleContacted(person.id, method)}
                  className="w-7 h-7 rounded text-xs border bg-white/10 border-white/15 text-white/70 hover:bg-vc-purple hover:text-white hover:border-vc-purple transition-all flex items-center justify-center"
                  title={tip}
                >
                  <Icon className="w-3 h-3" />
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
                      segment,
                      campaignConfig.electionDate
                    )
                    window.open(smsUrl, '_blank')
                    onToggleContacted(person.id, 'text')
                  }
                }}
                className={clsx(
                  'w-7 h-7 rounded text-xs border transition-all flex items-center justify-center',
                  person.phone
                    ? 'bg-white/10 border-white/15 text-white/70 hover:bg-vc-purple hover:text-white hover:border-vc-purple cursor-pointer'
                    : 'border-white/10 text-white/20 cursor-not-allowed'
                )}
                title={person.phone ? 'Send SMS with template' : 'No phone number'}
              >
                <Smartphone className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-white/40">
              {outreachMethod && (() => { const OutreachIcon = OUTREACH_LABELS[outreachMethod].Icon; return <OutreachIcon className="w-3 h-3 inline" /> })()}
            </span>
          )}
        </td>

        {/* Outcome */}
        <td className="py-2.5 px-2">
          {contacted && !outcomeValid && (
            <div className="flex gap-1 flex-wrap">
              {(Object.entries(OUTCOME_CONFIG) as [ContactOutcome, typeof OUTCOME_CONFIG[ContactOutcome]][]).map(([outcome, { Icon, tip }]) => (
                <button
                  key={outcome}
                  onClick={() => onOutcomeSelect(person.id, outcome)}
                  className="w-6 h-6 rounded text-xs border bg-white/10 border-white/15 text-white/70 hover:bg-vc-purple hover:text-white hover:border-vc-purple transition-all flex items-center justify-center"
                  title={tip}
                >
                  <Icon className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
          {contacted && outcomeValid && (
            <div className="flex items-center gap-1">
              <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1', OUTCOME_CONFIG[contactOutcome].color)}>
                {(() => { const OutcomeIcon = OUTCOME_CONFIG[contactOutcome].Icon; return <OutcomeIcon className="w-3 h-3" /> })()} {OUTCOME_CONFIG[contactOutcome].label}
              </span>
              {isRecontact && (
                <button
                  onClick={() => onRecontact(person.id)}
                  className="text-[10px] text-vc-coral hover:underline"
                  title="Try again"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
              {contactOutcome === 'supporter' && !actionItem?.isVolunteerProspect && (
                <button
                  onClick={() => onVolunteerRecruit(person.id)}
                  className="text-[10px] text-vc-purple-light hover:underline font-bold ml-1"
                  title="Recruit as volunteer"
                >
                  Recruit
                </button>
              )}
              {actionItem?.isVolunteerProspect && (
                <span className="text-[10px] bg-vc-purple text-white px-1.5 py-0.5 rounded-full font-bold ml-1" title="Volunteer prospect">
                  Vol
                </span>
              )}
            </div>
          )}
          {!contacted && <span className="text-xs text-white/40">—</span>}
        </td>

        {/* Notes */}
        <td className="py-2.5 px-2">
          <div className="flex gap-1 items-center">
            <input
              type="text"
              value={localNotes}
              onChange={e => setLocalNotes(e.target.value)}
              onBlur={() => onNotesChange(person.id, localNotes)}
              onKeyDown={e => { if (e.key === 'Enter') { onNotesChange(person.id, localNotes); (e.target as HTMLInputElement).blur() } }}
              placeholder="Notes..."
              className="glass-input flex-1 px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-vc-purple/30"
            />
            {localNotes !== (actionItem?.notes ?? '') && (
              <button
                onClick={() => onNotesChange(person.id, localNotes)}
                className="text-[9px] font-bold bg-vc-purple text-white px-1.5 py-0.5 rounded hover:bg-vc-purple-light transition-colors whitespace-nowrap"
              >
                Save
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded details */}
      {expanded && (
        <tr className="border-b border-white/15 glass transition-all duration-200">
          <td colSpan={8} className="px-3 py-3">
            <div className="flex flex-wrap gap-6 text-xs animate-fade-in">
              {/* Person details */}
              <div className="space-y-1">
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
                          'text-[9px] rounded p-1 text-center',
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

              {/* Survey questions */}
              {contacted && outcomeValid && contactOutcome !== 'no-answer' && contactOutcome !== 'left-message' && campaignConfig.surveyQuestions.length > 0 && (
                <div>
                  <p className="font-bold text-vc-purple-light text-[10px] uppercase tracking-wider mb-1">Survey</p>
                  <div className="space-y-1.5">
                    {campaignConfig.surveyQuestions.map(q => (
                      <div key={q.id}>
                        <label className="text-[10px] text-white/50 block mb-0.5">{q.label}</label>
                        {q.type === 'select' && q.options ? (
                          <select
                            value={actionItem?.surveyResponses?.[q.id] ?? ''}
                            onChange={e => {
                              const updated = { ...(actionItem?.surveyResponses || {}), [q.id]: e.target.value }
                              onSurveyChange(person.id, updated)
                            }}
                            className="glass-input w-full px-2 py-1 rounded text-[10px]"
                          >
                            <option value="">—</option>
                            {q.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={actionItem?.surveyResponses?.[q.id] ?? ''}
                            onChange={e => {
                              const updated = { ...(actionItem?.surveyResponses || {}), [q.id]: e.target.value }
                              onSurveyChange(person.id, updated)
                            }}
                            className="glass-input w-full px-2 py-1 rounded text-[10px]"
                            placeholder={q.label}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
