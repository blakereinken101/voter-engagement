'use client'
import { SegmentedResults } from '@/types'
import VoterCard from './VoterCard'
import ScriptCard from './ScriptCard'
import { CONVERSATION_SCRIPTS } from '@/lib/scripts'
import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'

interface Props {
  segmented: SegmentedResults
}

type ActiveTab = 'sometimes' | 'rarely' | 'super' | 'unmatched'

export default function ResultsDashboard({ segmented }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sometimes')
  const [showScript, setShowScript] = useState(false)

  const tabs: { id: ActiveTab; label: string; count: number; activeClass: string }[] = [
    { id: 'sometimes', label: 'Need a Nudge', count: segmented.sometimesVoters.length, activeClass: 'bg-vc-gold text-vc-purple' },
    { id: 'rarely', label: 'Need You Most', count: segmented.rarelyVoters.length, activeClass: 'bg-vc-coral text-white' },
    { id: 'super', label: 'Champions', count: segmented.superVoters.length, activeClass: 'bg-vc-teal text-white' },
    { id: 'unmatched', label: 'Not Found', count: segmented.unmatched.length, activeClass: 'bg-gray-300 text-gray-700' },
  ]

  const currentResults = {
    sometimes: segmented.sometimesVoters,
    rarely: segmented.rarelyVoters,
    super: segmented.superVoters,
    unmatched: segmented.unmatched,
  }[activeTab]

  const segmentKey = activeTab === 'super' ? 'super-voter' : activeTab === 'sometimes' ? 'sometimes-voter' : 'rarely-voter'

  const segmentDescriptions = {
    super: 'These people already vote every time. Ask them to step up — volunteer, bring a friend, join you in outreach.',
    sometimes: 'These people vote in the big ones but skip midterms and locals. A personal nudge from you can change that.',
    rarely: 'These people rarely vote. Do not lecture them. Just have a real conversation and plant a seed.',
    unmatched: 'We could not find these people in the voter file. They may not be registered, or they may be in a different state.',
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-vc-purple-dark via-vc-purple to-vc-purple-light text-white px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl font-bold mb-2">Your Circle</h1>
          <p className="text-white/60 text-lg">
            {segmented.totalMatched} of {segmented.totalEntered} people matched
          </p>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold font-display text-vc-teal">{segmented.superVoters.length}</div>
              <div className="text-white/50 text-xs uppercase tracking-wider mt-1">Champions</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold font-display text-vc-gold">{segmented.sometimesVoters.length}</div>
              <div className="text-white/50 text-xs uppercase tracking-wider mt-1">Need a Nudge</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold font-display text-vc-coral">{segmented.rarelyVoters.length}</div>
              <div className="text-white/50 text-xs uppercase tracking-wider mt-1">Need You Most</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 bg-white shadow-sm z-10 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 flex gap-2 overflow-x-auto py-3">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setShowScript(false) }}
              className={clsx(
                'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                activeTab === tab.id ? tab.activeClass : 'bg-gray-100 text-vc-gray hover:bg-gray-200'
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Segment description */}
        <div className={clsx(
          'rounded-lg p-5 mb-6 border',
          activeTab === 'super' ? 'bg-vc-teal/5 border-vc-teal/20' :
            activeTab === 'sometimes' ? 'bg-vc-gold/5 border-vc-gold/20' :
              activeTab === 'rarely' ? 'bg-vc-coral/5 border-vc-coral/20' :
                'bg-gray-50 border-gray-200'
        )}>
          <p className="text-vc-slate font-medium">{segmentDescriptions[activeTab]}</p>
          {activeTab !== 'unmatched' && (
            <button
              onClick={() => setShowScript(!showScript)}
              className="text-sm font-bold text-vc-purple mt-3 hover:underline"
            >
              {showScript ? 'Hide conversation guide' : 'Show conversation guide'}
            </button>
          )}
        </div>

        {showScript && activeTab !== 'unmatched' && (
          <div className="mb-6 animate-fade-in">
            <ScriptCard script={CONVERSATION_SCRIPTS[segmentKey as keyof typeof CONVERSATION_SCRIPTS]} />
          </div>
        )}

        {/* Cards */}
        <div className="space-y-3">
          {currentResults.map(result => (
            <VoterCard key={result.personEntry.id} result={result} />
          ))}
        </div>

        {currentResults.length === 0 && (
          <div className="text-center py-16 text-vc-gray">
            <div className="text-4xl mb-3">—</div>
            <p>{activeTab === 'unmatched' ? 'Everyone was found in the voter file!' : 'No one in this category'}</p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-10">
          <Link
            href="/action-plan"
            className="inline-block bg-vc-purple text-white font-bold font-display text-lg px-10 py-4 rounded-lg hover:bg-vc-purple-light transition-all shadow-lg shadow-vc-purple/25"
          >
            Build My Action Plan
          </Link>
        </div>
      </div>
    </div>
  )
}
