'use client'
import { SegmentedResults } from '@/types'
import VoterCard from './VoterCard'
import ScriptCard from './ScriptCard'
import { CONVERSATION_SCRIPTS } from '@/lib/scripts'
import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import {
  Trophy,
  Target,
  HeartHandshake,
  SearchX,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Users
} from 'lucide-react'

interface Props {
  segmented: SegmentedResults
}

type ActiveTab = 'sometimes' | 'rarely' | 'super' | 'unmatched'

export default function ResultsDashboard({ segmented }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sometimes')
  const [showScript, setShowScript] = useState(false)

  const tabs: { id: ActiveTab; label: string; count: number; activeClass: string; icon: React.ElementType }[] = [
    { id: 'sometimes', label: 'Need a Nudge', count: segmented.sometimesVoters.length, activeClass: 'bg-vc-gold text-vc-purple shadow-sm ring-1 ring-vc-gold/50', icon: Target },
    { id: 'rarely', label: 'Need You Most', count: segmented.rarelyVoters.length, activeClass: 'bg-vc-coral text-white shadow-sm ring-1 ring-vc-coral/50', icon: HeartHandshake },
    { id: 'super', label: 'Champions', count: segmented.superVoters.length, activeClass: 'bg-vc-teal text-white shadow-sm ring-1 ring-vc-teal/50', icon: Trophy },
    { id: 'unmatched', label: 'Not Found', count: segmented.unmatched.length, activeClass: 'bg-gray-800 text-white shadow-sm ring-1 ring-gray-800/50', icon: SearchX },
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
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-vc-purple-dark via-vc-purple to-[#4a3570] text-white px-6 py-12">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

        <div className="max-w-3xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display text-4xl font-bold">Your Circle</h1>
          </div>
          <p className="text-white/70 text-lg font-medium">
            {segmented.totalMatched} of {segmented.totalEntered} people matched
          </p>

          <div className="grid grid-cols-3 gap-3 md:gap-4 mt-8">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 shadow-xl shadow-black/10">
              <Trophy className="w-5 h-5 mx-auto mb-2 text-vc-teal" />
              <div className="text-3xl font-bold font-display text-vc-teal">{segmented.superVoters.length}</div>
              <div className="text-white/60 text-[10px] sm:text-xs uppercase tracking-wider mt-1 font-semibold">Champions</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 shadow-xl shadow-black/10">
              <Target className="w-5 h-5 mx-auto mb-2 text-vc-gold" />
              <div className="text-3xl font-bold font-display text-vc-gold">{segmented.sometimesVoters.length}</div>
              <div className="text-white/60 text-[10px] sm:text-xs uppercase tracking-wider mt-1 font-semibold">Need a Nudge</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 shadow-xl shadow-black/10">
              <HeartHandshake className="w-5 h-5 mx-auto mb-2 text-vc-coral" />
              <div className="text-3xl font-bold font-display text-vc-coral">{segmented.rarelyVoters.length}</div>
              <div className="text-white/60 text-[10px] sm:text-xs uppercase tracking-wider mt-1 font-semibold">Need You Most</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl shadow-sm z-30 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 flex gap-2 overflow-x-auto py-3 no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowScript(false) }}
                className={clsx(
                  'flex items-center gap-2 flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                  activeTab === tab.id
                    ? tab.activeClass
                    : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-gray-200'
                )}
              >
                <Icon className={clsx("w-4 h-4", activeTab !== tab.id && "opacity-50")} />
                {tab.label}
                <span className={clsx(
                  "px-2 py-0.5 rounded-full text-xs font-semibold ml-1",
                  activeTab === tab.id ? "bg-black/10" : "bg-gray-100 text-gray-500"
                )}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Segment description callout */}
        <div className={clsx(
          'rounded-xl p-5 mb-6 border flex items-start gap-3',
          activeTab === 'super' ? 'bg-vc-teal/5 border-vc-teal/20' :
            activeTab === 'sometimes' ? 'bg-vc-gold/5 border-vc-gold/20' :
              activeTab === 'rarely' ? 'bg-vc-coral/5 border-vc-coral/20' :
                'bg-gray-50 border-gray-200'
        )}>
          <MessageCircle className={clsx(
            'w-5 h-5 flex-shrink-0 mt-0.5',
            activeTab === 'super' ? 'text-vc-teal' :
              activeTab === 'sometimes' ? 'text-vc-gold' :
                activeTab === 'rarely' ? 'text-vc-coral' :
                  'text-gray-400'
          )} />
          <div>
            <p className="text-vc-slate font-medium">{segmentDescriptions[activeTab]}</p>
            {activeTab !== 'unmatched' && (
              <button
                onClick={() => setShowScript(!showScript)}
                className={clsx(
                  'inline-flex items-center gap-1.5 text-sm font-bold mt-3 px-3 py-1.5 rounded-lg transition-all',
                  activeTab === 'super' ? 'text-vc-teal bg-vc-teal/10 hover:bg-vc-teal/20' :
                    activeTab === 'sometimes' ? 'text-vc-purple bg-vc-gold/10 hover:bg-vc-gold/20' :
                      'text-vc-coral bg-vc-coral/10 hover:bg-vc-coral/20'
                )}
              >
                {showScript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showScript ? 'Hide conversation guide' : 'Show conversation guide'}
              </button>
            )}
          </div>
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
            <SearchX className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-400">
              {activeTab === 'unmatched' ? 'Everyone was found in the voter file!' : 'No one in this category'}
            </p>
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
