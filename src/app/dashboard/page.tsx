'use client'
import { useState } from 'react'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import ContactSpreadsheet from '@/components/ContactSpreadsheet'
import AdminPanel from '@/components/admin/AdminPanel'
import ChatInterface from '@/components/ChatInterface'
import { generateVoteBuilderCSV, downloadCSV } from '@/lib/votebuilder-export'
import ConversionStats from '@/components/ConversionStats'
import VolunteerLeaderboard from '@/components/VolunteerLeaderboard'
import SocialShareBar from '@/components/SocialShareBar'
import VoterRegistrationLinks from '@/components/VoterRegistrationLinks'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import defaultCampaignConfig from '@/lib/campaign-config'
import Link from 'next/link'
import Image from 'next/image'
import type { DashboardView } from '@/types'
import ScanSheetPanel from '@/components/ScanSheetPanel'
import { Download, Shield, LogOut, Camera, Users, MessageCircle, ThumbsUp, Clock, Sparkles, Table, Calendar, ArrowLeft, ChevronsUpDown, Star, Zap } from 'lucide-react'
import { isInTargetUniverse } from '@/lib/voter-segments'

export default function DashboardPage() {
  const { state, runMatchingForUnmatched } = useAppContext()
  const { user, signOut, isAdmin, activeMembership, memberships, switchCampaign, campaignConfig: authConfig, isLoading: authLoading, hasEventsAccess, hasMessagingAccess } = useAuth()

  // Product access is enforced by middleware — no client-side redirect guard needed
  const campaignConfig = authConfig || defaultCampaignConfig
  const [view, setView] = useState<DashboardView | 'admin'>('chat')
  const [showScanSheet, setShowScanSheet] = useState(false)

  // Stats
  const totalPeople = state.personEntries.length
  const contactedCount = state.actionPlanState.filter(i => i.contacted).length
  const outcomes = state.actionPlanState.filter(i => i.contactOutcome)
  const supporters = outcomes.filter(i => i.contactOutcome === 'supporter').length
  const followUps = outcomes.filter(i =>
    i.contactOutcome === 'undecided' ||
    i.contactOutcome === 'left-message' ||
    i.contactOutcome === 'no-answer'
  ).length

  // Target universe stats
  const targetUniverseCfg = campaignConfig.aiContext?.targetUniverse
  const hasTargetConfig = targetUniverseCfg && Object.values(targetUniverseCfg).some(v => v)
  const targetsHit = hasTargetConfig
    ? state.actionPlanState.filter(i =>
        i.contacted && i.matchResult.bestMatch && isInTargetUniverse(i.matchResult.bestMatch, targetUniverseCfg)
      ).length
    : 0

  // Unmatched contacts for Run Match button
  const matchedIds = new Set(state.matchResults.map(r => r.personEntry.id))
  const unmatchedCount = state.personEntries.filter(p => !matchedIds.has(p.id)).length

  // Derive initials from user name
  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className={`cosmic-bg constellation flex flex-col safe-top ${
      view === 'chat' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'
    }`}>
      {/* Header — glass bar */}
      <header className="glass-dark border-b border-white/10 sticky top-0 z-50">
        {/* Top bar */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 md:pt-5 pb-2 md:pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-14 md:h-28 w-auto" priority />
            </Link>
            <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider bg-vc-purple/20 text-vc-purple-light border border-vc-purple/30 rounded-full">
              Relational
            </span>
            {hasEventsAccess && (
              <Link
                href="/events/manage"
                className="flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-btn text-sm font-medium text-vc-teal hover:bg-vc-teal/10 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Events</span>
              </Link>
            )}
            {hasMessagingAccess && (
              <Link
                href="/messaging"
                className="flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-btn text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Messages</span>
              </Link>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="min-w-0 text-right">
                <p className="text-sm md:text-base font-bold text-white leading-tight truncate">{user.name || 'Volunteer'}</p>
                {memberships.length > 1 ? (
                  <div className="relative">
                    <select
                      value={activeMembership?.campaignId || ''}
                      onChange={e => switchCampaign(e.target.value)}
                      className="appearance-none text-xs text-vc-purple-light bg-transparent border-none p-0 pr-4 cursor-pointer leading-tight focus:outline-none focus:ring-0 w-full text-right"
                      style={{ maxWidth: '100%' }}
                    >
                      {memberships.map(m => (
                        <option key={m.campaignId} value={m.campaignId} className="bg-vc-bg text-white">
                          {m.campaignName}
                        </option>
                      ))}
                    </select>
                    <ChevronsUpDown className="w-3 h-3 text-vc-purple-light/60 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                  <p className="text-xs text-vc-purple-light leading-tight truncate">{campaignConfig.name}</p>
                )}
              </div>
              <div className="w-9 h-9 flex-shrink-0 rounded-full bg-vc-purple/30 ring-2 ring-vc-purple/50 flex items-center justify-center text-sm font-bold text-white">
                {userInitials}
              </div>
              <button
                onClick={() => signOut()}
                className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors p-1.5"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Nav bar */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 pb-3 md:pb-4 flex flex-wrap items-center gap-1.5 md:gap-3">
          <button
            onClick={() => setView('chat')}
            className={`text-sm md:text-base px-5 py-2.5 rounded-btn font-bold transition-all flex items-center gap-2 ${
              view === 'chat'
                ? 'bg-vc-purple text-white shadow-glow'
                : 'text-white/60 hover:text-white glass hover:border-white/20'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setView('contacts')}
            className={`text-sm md:text-base px-5 py-2.5 rounded-btn font-bold transition-all flex items-center gap-2 ${
              view === 'contacts'
                ? 'bg-vc-purple text-white shadow-glow'
                : 'text-white/60 hover:text-white glass hover:border-white/20'
            }`}
          >
            <Table className="w-4 h-4" />
            Rolodex
          </button>
          {isAdmin && (
            <button
              onClick={() => setView('admin')}
              className={`text-sm md:text-base px-5 py-2.5 rounded-btn font-bold transition-all flex items-center gap-2 ${
                view === 'admin'
                  ? 'bg-vc-purple text-white shadow-glow'
                  : 'text-white/60 hover:text-white glass hover:border-white/20'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
          )}
          <button
            onClick={() => setShowScanSheet(true)}
            className="text-sm md:text-base text-white/60 hover:text-white transition-colors px-5 py-2.5 rounded-btn glass hover:border-white/20 flex items-center gap-2 font-bold"
          >
            <Camera className="w-4 h-4" />
            Scan Sheet
          </button>
          {state.actionPlanState.length > 0 && (
            <button
              onClick={() => {
                const csv = generateVoteBuilderCSV(
                  state.actionPlanState,
                  campaignConfig.state,
                  state.userId,
                  campaignConfig.id,
                  campaignConfig.name
                )
                const date = new Date().toISOString().slice(0, 10)
                downloadCSV(csv, `threshold-${campaignConfig.id}-${date}.csv`)
              }}
              className="text-sm md:text-base text-white/60 hover:text-white px-5 py-2.5 rounded-btn glass hover:border-white/20 font-bold transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}

          {unmatchedCount > 0 && (
            <button
              onClick={runMatchingForUnmatched}
              disabled={state.isLoading}
              className="text-sm md:text-base text-white/60 hover:text-white px-5 py-2.5 rounded-btn glass hover:border-white/20 font-bold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.isLoading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Matching...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Run Match
                  <span className="bg-vc-coral/80 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {unmatchedCount}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Stats — pushed right, hidden on small screens */}
          {view !== 'admin' && totalPeople > 0 && (
            <div className="hidden md:flex flex-wrap items-center gap-4 text-sm md:text-base ml-auto font-display tabular-nums">
              <span className="flex items-center gap-1.5 text-white/70">
                <Users className="w-4 h-4" />
                <span className="text-white font-bold">{totalPeople}</span>
              </span>
              <span className="flex items-center gap-1.5 text-vc-gold">
                <MessageCircle className="w-4 h-4" />
                <span className="font-bold">{contactedCount}</span>
              </span>
              {supporters > 0 && (
                <span className="flex items-center gap-1.5 text-vc-teal">
                  <ThumbsUp className="w-4 h-4" />
                  <span className="font-bold">{supporters}</span>
                </span>
              )}
              {hasTargetConfig && targetsHit > 0 && (
                <span className="flex items-center gap-1.5 text-vc-gold">
                  <Star className="w-4 h-4 fill-vc-gold" />
                  <span className="font-bold">{targetsHit}</span>
                </span>
              )}
              {followUps > 0 && (
                <span className="flex items-center gap-1.5 text-white/60">
                  <Clock className="w-4 h-4" />
                  <span className="font-bold">{followUps}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {state.error && (
          <div className="max-w-6xl mx-auto px-6 pb-3">
            <div className="bg-red-500/20 text-red-300 text-sm px-4 py-2.5 rounded-btn border border-red-500/30">
              {state.error}
            </div>
          </div>
        )}
      </header>

      {/* Personal stats + leaderboard — shown on contacts view */}
      {view === 'contacts' && totalPeople > 0 && (
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 pt-4 space-y-3">
          <ConversionStats />
          <VolunteerLeaderboard />
          <div className="grid md:grid-cols-3 gap-3">
            <SocialShareBar />
            <VoterRegistrationLinks />
            <PushNotificationToggle />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className={`flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-4 ${
        view === 'chat' ? 'min-h-0 flex flex-col overflow-hidden' : ''
      }`}>
        {view !== 'chat' && (
          <button
            onClick={() => setView('chat')}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mb-3 md:mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Chat
          </button>
        )}
        {view === 'admin' ? (
          <AdminPanel />
        ) : view === 'contacts' ? (
          <ContactSpreadsheet />
        ) : (
          <ChatInterface />
        )}
      </main>

      {/* Scan Sheet modal */}
      {showScanSheet && (
        <ScanSheetPanel onClose={() => setShowScanSheet(false)} />
      )}

      {/* Footer — hidden entirely in chat mode (the AI disclaimer serves as footer) */}
      <footer className={`text-center pt-4 pb-6 border-t border-white/5 safe-bottom ${
        view === 'chat' ? 'hidden' : ''
      }`}>
        <p className="text-white/30 text-xs">
          &copy; {new Date().getFullYear()} Vote Threshold LLC. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-1">
          <Link href="/privacy" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">Privacy Policy</Link>
          <span className="text-white/10 text-[10px]">|</span>
          <Link href="/terms" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">Terms of Service</Link>
          <span className="text-white/10 text-[10px]">|</span>
          <a href="mailto:info@thresholdvote.com" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">info@thresholdvote.com</a>
        </div>
      </footer>
    </div>
  )
}
