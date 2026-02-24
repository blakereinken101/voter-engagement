'use client'
import { useAppContext } from '@/context/AppContext'
import VoterCard from '@/components/VoterCard'
import ScriptCard from '@/components/ScriptCard'
import RelationalTopBar from '@/components/RelationalTopBar'
import { CONVERSATION_SCRIPTS } from '@/lib/scripts'
import { generateVoteBuilderCSV, downloadCSV } from '@/lib/votebuilder-export'
import { VoterSegment, OutreachMethod, ContactOutcome } from '@/types'
import Link from 'next/link'
import { ThumbsUp, HelpCircle, Mail, ThumbsDown, Download, Printer } from 'lucide-react'
import clsx from 'clsx'

const PRIORITY_ORDER: VoterSegment[] = ['rarely-voter', 'sometimes-voter', 'super-voter']

const SEGMENT_CONFIG: Record<VoterSegment, { label: string; priority: string; color: string }> = {
  'rarely-voter': { label: 'Need You Most', priority: 'Priority 1', color: 'text-vc-coral' },
  'sometimes-voter': { label: 'Need a Nudge', priority: 'Priority 2', color: 'text-vc-gold' },
  'super-voter': { label: 'Ask to Step Up', priority: 'Priority 3', color: 'text-vc-teal' },
}

export default function ActionPlanPage() {
  const { state, toggleContacted, setContactOutcome, clearContact, updateNote } = useAppContext()

  if (state.actionPlanState.length === 0) {
    return (
      <div className="min-h-screen flex flex-col cosmic-bg constellation">
        <RelationalTopBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/50">No action plan yet. <Link href="/questionnaire" className="text-vc-purple-light font-bold hover:underline">Build your list first</Link>.</p>
        </div>
      </div>
    )
  }

  const contacted = state.actionPlanState.filter(i => i.contacted).length
  const total = state.actionPlanState.length
  const percent = total > 0 ? Math.round((contacted / total) * 100) : 0

  // Outcome stats
  const outcomes = state.actionPlanState.filter(i => i.contactOutcome)
  const supporters = outcomes.filter(i => i.contactOutcome === 'supporter').length
  const undecided = outcomes.filter(i => i.contactOutcome === 'undecided').length
  const opposed = outcomes.filter(i => i.contactOutcome === 'opposed').length
  const needsFollowUp = outcomes.filter(i => i.contactOutcome === 'left-message' || i.contactOutcome === 'no-answer').length

  // Unmatched items
  const unmatchedItems = state.actionPlanState.filter(i => i.matchResult.status === 'unmatched')

  return (
    <div className="min-h-screen cosmic-bg constellation text-white">
      <RelationalTopBar />
      <header className="bg-gradient-to-r from-vc-purple-dark via-vc-purple to-vc-purple-light text-white px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/results" className="text-white/40 text-sm hover:text-white transition-colors mb-4 block">
            &larr; Back to results
          </Link>
          <h1 className="font-display text-3xl font-extrabold mb-2 tracking-tight">Your Action Plan</h1>
          <p className="text-white/60 text-lg">
            <span className="text-vc-gold font-bold">{contacted}</span> of {total} conversations ({percent}%)
          </p>
          <div className="mt-4 bg-white/10 rounded-full h-3">
            <div
              className="bg-vc-gold h-3 rounded-full transition-all duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Outcome stats */}
          {contacted > 0 && (
            <div className="flex flex-wrap gap-4 mt-3 text-xs">
              {supporters > 0 && <span className="text-vc-teal flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {supporters} supporters</span>}
              {undecided > 0 && <span className="text-vc-gold flex items-center gap-1"><HelpCircle className="w-3 h-3" /> {undecided} undecided</span>}
              {needsFollowUp > 0 && <span className="text-white/70 flex items-center gap-1"><Mail className="w-3 h-3" /> {needsFollowUp} follow up</span>}
              {opposed > 0 && <span className="text-white/40 flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> {opposed} not interested</span>}
            </div>
          )}

          {/* User ID */}
          {state.userId && (
            <p className="text-white/20 text-[10px] mt-3">ID: {state.userId}</p>
          )}
        </div>
      </header>

      {/* Mode toggle */}
      <div className="max-w-2xl mx-auto px-6 pt-6">
        <div className="flex gap-3 mb-6">
          <span className="px-4 py-2 rounded-btn text-sm font-bold bg-vc-purple text-white">
            List View
          </span>
          <Link
            href="/rolodex"
            className="px-4 py-2 rounded-btn text-sm font-bold bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          >
            Card View
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 pb-8 space-y-10">
        {PRIORITY_ORDER.map(segment => {
          const items = state.actionPlanState.filter(i => i.matchResult.segment === segment)
          if (items.length === 0) return null

          const config = SEGMENT_CONFIG[segment]
          const remaining = items.filter(i => !i.contacted || i.contactOutcome === 'left-message' || i.contactOutcome === 'no-answer').length

          return (
            <section key={segment}>
              <div className="flex items-baseline gap-3 mb-1">
                <span className={clsx('text-xs font-bold uppercase tracking-wider', config.color)}>
                  {config.priority}
                </span>
                <h2 className="font-display text-xl font-bold text-white">{config.label}</h2>
              </div>
              <p className="text-white/50 text-sm mb-4">
                {remaining} remaining
              </p>

              <details className="mb-4">
                <summary className="text-sm text-vc-purple font-bold cursor-pointer hover:opacity-80 transition-opacity">
                  Show conversation guide
                </summary>
                <div className="mt-3">
                  <ScriptCard script={CONVERSATION_SCRIPTS[segment]} />
                </div>
              </details>

              <div className="space-y-3">
                {items
                  .sort((a, b) => {
                    if (!a.contacted && b.contacted) return -1
                    if (a.contacted && !b.contacted) return 1
                    const aRecontact = a.contactOutcome === 'left-message' || a.contactOutcome === 'no-answer'
                    const bRecontact = b.contactOutcome === 'left-message' || b.contactOutcome === 'no-answer'
                    if (aRecontact && !bRecontact) return -1
                    if (!aRecontact && bRecontact) return 1
                    return 0
                  })
                  .map(item => (
                    <VoterCard
                      key={item.matchResult.personEntry.id}
                      result={item.matchResult}
                      showContactToggle
                      contacted={item.contacted}
                      outreachMethod={item.outreachMethod}
                      contactOutcome={item.contactOutcome}
                      notes={item.notes}
                      onContactToggle={(method: OutreachMethod) => toggleContacted(item.matchResult.personEntry.id, method)}
                      onOutcomeSelect={(outcome: ContactOutcome) => setContactOutcome(item.matchResult.personEntry.id, outcome)}
                      onRecontact={() => clearContact(item.matchResult.personEntry.id)}
                      onNotesChange={(notes: string) => updateNote(item.matchResult.personEntry.id, notes)}
                    />
                  ))}
              </div>
            </section>
          )
        })}

        {/* Unmatched section */}
        {unmatchedItems.length > 0 && (
          <section>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-white/40">
                Also reach out
              </span>
              <h2 className="font-display text-xl font-bold text-white">Not in Voter File</h2>
            </div>
            <p className="text-white/50 text-sm mb-4">
              {unmatchedItems.filter(i => !i.contacted).length} remaining — still worth the conversation
            </p>

            <div className="space-y-3">
              {unmatchedItems
                .sort((a, b) => Number(a.contacted) - Number(b.contacted))
                .map(item => (
                  <VoterCard
                    key={item.matchResult.personEntry.id}
                    result={item.matchResult}
                    showContactToggle
                    contacted={item.contacted}
                    outreachMethod={item.outreachMethod}
                    contactOutcome={item.contactOutcome}
                    notes={item.notes}
                    onContactToggle={(method: OutreachMethod) => toggleContacted(item.matchResult.personEntry.id, method)}
                    onOutcomeSelect={(outcome: ContactOutcome) => setContactOutcome(item.matchResult.personEntry.id, outcome)}
                    onRecontact={() => clearContact(item.matchResult.personEntry.id)}
                    onNotesChange={(notes: string) => updateNote(item.matchResult.personEntry.id, notes)}
                  />
                ))}
            </div>
          </section>
        )}
      </main>

      {/* Export + Print */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-8 no-print">
        <button
          onClick={() => {
            const csv = generateVoteBuilderCSV(state.actionPlanState, state.selectedState, state.userId)
            const date = new Date().toISOString().slice(0, 10)
            downloadCSV(csv, `threshold-export-${date}.csv`)
          }}
          className="bg-vc-purple text-white px-8 py-3 rounded-btn font-bold hover:bg-vc-purple-light transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export for VoteBuilder
        </button>
        <button
          onClick={() => window.print()}
          className="bg-white/10 border-2 border-vc-purple text-white px-8 py-3 rounded-btn font-bold hover:bg-vc-purple hover:text-white transition-all flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print This Plan
        </button>
      </div>
    </div>
  )
}
