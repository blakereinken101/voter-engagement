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
import { Download, Shield, LogOut, BookOpen, Users, CheckCircle, MessageCircle, ThumbsUp, HelpCircle, Clock, ThumbsDown, Bot, Table } from 'lucide-react'

export default function DashboardPage() {
  const { state } = useAppContext()
  const { user, signOut, isAdmin, activeMembership, memberships, switchCampaign, campaignConfig: authConfig } = useAuth()
  const campaignConfig = authConfig || defaultCampaignConfig
  const [view, setView] = useState<DashboardView | 'admin'>('chat')

  // Stats
  const totalPeople = state.personEntries.length
  const matchedCount = state.matchResults.filter(r => r.status === 'confirmed').length
  const contactedCount = state.actionPlanState.filter(i => i.contacted).length
  const outcomes = state.actionPlanState.filter(i => i.contactOutcome)
  const supporters = outcomes.filter(i => i.contactOutcome === 'supporter').length
  const undecided = outcomes.filter(i => i.contactOutcome === 'undecided').length
  const needsFollowUp = outcomes.filter(i => i.contactOutcome === 'left-message' || i.contactOutcome === 'no-answer').length
  const opposed = outcomes.filter(i => i.contactOutcome === 'opposed').length

  // Derive initials from user name
  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className="min-h-screen cosmic-bg constellation flex flex-col">
      {/* Header — glass bar */}
      <header className="glass-dark border-b border-white/10">
        {/* Top bar */}
        <div className="max-w-6xl mx-auto px-6 pt-5 pb-3 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-20 md:h-28 w-auto" priority />
          </Link>
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-white leading-tight">{user.name || 'Volunteer'}</p>
                {memberships.length > 1 ? (
                  <select
                    value={activeMembership?.campaignId || ''}
                    onChange={e => switchCampaign(e.target.value)}
                    className="text-xs text-vc-purple-light bg-transparent border-none p-0 cursor-pointer leading-tight focus:outline-none focus:ring-0"
                  >
                    {memberships.map(m => (
                      <option key={m.campaignId} value={m.campaignId} className="bg-vc-bg text-white">
                        {m.campaignName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-vc-purple-light leading-tight">{campaignConfig.name}</p>
                )}
              </div>
              <div className="w-9 h-9 rounded-full bg-vc-purple/30 ring-2 ring-vc-purple/50 flex items-center justify-center text-sm font-bold text-white">
                {userInitials}
              </div>
              <button
                onClick={() => signOut()}
                className="text-white/30 hover:text-white/60 transition-colors p-1.5"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Nav bar */}
        <div className="max-w-6xl mx-auto px-6 pb-4 flex flex-wrap items-center gap-2 md:gap-3">
          <button
            onClick={() => setView('chat')}
            className={`text-sm px-5 py-2.5 rounded-btn font-bold transition-all flex items-center gap-2 ${
              view === 'chat'
                ? 'bg-vc-purple text-white shadow-glow'
                : 'text-white/60 hover:text-white glass hover:border-white/20'
            }`}
          >
            <Bot className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setView('contacts')}
            className={`text-sm px-5 py-2.5 rounded-btn font-bold transition-all flex items-center gap-2 ${
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
              className={`text-sm px-5 py-2.5 rounded-btn font-bold transition-all flex items-center gap-2 ${
                view === 'admin'
                  ? 'bg-vc-purple text-white shadow-glow'
                  : 'text-white/60 hover:text-white glass hover:border-white/20'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
          )}
          <Link
            href="/rolodex"
            className="text-sm text-white/60 hover:text-white transition-colors px-5 py-2.5 rounded-btn glass hover:border-white/20 flex items-center gap-2 font-bold"
          >
            <BookOpen className="w-4 h-4" />
            Rolodex
          </Link>
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
              className="text-sm text-white/60 hover:text-white px-5 py-2.5 rounded-btn glass hover:border-white/20 font-bold transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}

          {/* Stats — pushed right, hidden on small screens */}
          {view !== 'admin' && totalPeople > 0 && (
            <div className="hidden md:flex flex-wrap items-center gap-4 text-sm ml-auto font-display tabular-nums">
              <span className="flex items-center gap-1.5 text-white/70">
                <Users className="w-4 h-4" />
                <span className="text-white font-bold">{totalPeople}</span>
              </span>
              <span className="flex items-center gap-1.5 text-vc-teal">
                <CheckCircle className="w-4 h-4" />
                <span className="font-bold">{matchedCount}</span>
              </span>
              <span className="flex items-center gap-1.5 text-vc-gold">
                <MessageCircle className="w-4 h-4" />
                <span className="font-bold">{contactedCount}</span>
              </span>
              {supporters > 0 && <span className="flex items-center gap-1 text-vc-teal font-bold"><ThumbsUp className="w-3.5 h-3.5" /> {supporters}</span>}
              {undecided > 0 && <span className="flex items-center gap-1 text-vc-gold font-bold"><HelpCircle className="w-3.5 h-3.5" /> {undecided}</span>}
              {needsFollowUp > 0 && <span className="flex items-center gap-1 text-white/60 font-bold"><Clock className="w-3.5 h-3.5" /> {needsFollowUp}</span>}
              {opposed > 0 && <span className="flex items-center gap-1 text-white/30 font-bold"><ThumbsDown className="w-3.5 h-3.5" /> {opposed}</span>}
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
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-4">
        {view === 'admin' ? (
          <AdminPanel />
        ) : view === 'contacts' ? (
          <ContactSpreadsheet />
        ) : (
          <ChatInterface />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 border-t border-white/5">
        <p className="text-white/30 text-xs">
          &copy; {new Date().getFullYear()} Vote Threshold LLC. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-1">
          <Link href="/privacy" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">Privacy Policy</Link>
          <span className="text-white/10 text-[10px]">|</span>
          <a href="mailto:info@votethreshold.com" className="text-white/20 text-[10px] hover:text-white/40 transition-colors">info@votethreshold.com</a>
        </div>
      </footer>
    </div>
  )
}
