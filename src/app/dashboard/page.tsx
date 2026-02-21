'use client'
import { useState } from 'react'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import ContactSpreadsheet from '@/components/ContactSpreadsheet'
import AdminPanel from '@/components/admin/AdminPanel'
import { generateVoteBuilderCSV, downloadCSV } from '@/lib/votebuilder-export'
import ConversionStats from '@/components/ConversionStats'
import campaignConfig from '@/lib/campaign-config'
import Link from 'next/link'
import { Download, Shield, LogOut, BookOpen, Users, CheckCircle, MessageCircle, ThumbsUp, HelpCircle, Clock, ThumbsDown } from 'lucide-react'

export default function DashboardPage() {
  const { state } = useAppContext()
  const { user, signOut } = useAuth()
  const [isAdminMode, setIsAdminMode] = useState(false)

  // Stats
  const totalPeople = state.personEntries.length
  const matchedCount = state.matchResults.filter(r => r.status === 'confirmed').length
  const contactedCount = state.actionPlanState.filter(i => i.contacted).length
  const outcomes = state.actionPlanState.filter(i => i.contactOutcome)
  const supporters = outcomes.filter(i => i.contactOutcome === 'supporter').length
  const undecided = outcomes.filter(i => i.contactOutcome === 'undecided').length
  const needsFollowUp = outcomes.filter(i => i.contactOutcome === 'left-message' || i.contactOutcome === 'no-answer').length
  const opposed = outcomes.filter(i => i.contactOutcome === 'opposed').length
  const volunteerProspects = state.actionPlanState.filter(i => i.isVolunteerProspect).length

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
          <Link href="/" className="font-display font-extrabold text-white text-3xl tracking-tight hover:opacity-80 transition-opacity">
            VoteCircle
          </Link>
          {user && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-vc-purple/30 ring-2 ring-vc-purple/50 flex items-center justify-center text-sm font-bold text-white">
                {userInitials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-white leading-tight">{user.name || 'Volunteer'}</p>
                <p className="text-xs text-white/60 leading-tight">{user.email}</p>
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
        <div className="max-w-6xl mx-auto px-6 pb-4 flex items-center gap-3">
          {user?.role === 'admin' && (
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`text-sm px-5 py-2.5 rounded-btn font-bold transition-all flex items-center gap-2 ${
                isAdminMode
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
                downloadCSV(csv, `votecircle-${campaignConfig.id}-${date}.csv`)
              }}
              className="text-sm text-white/60 hover:text-white px-5 py-2.5 rounded-btn glass hover:border-white/20 font-bold transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}

          {/* Stats — pushed right */}
          {!isAdminMode && totalPeople > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm ml-auto font-display tabular-nums">
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

      {/* Personal stats */}
      {!isAdminMode && totalPeople > 0 && (
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 pt-4">
          <ConversionStats />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-4">
        {isAdminMode ? <AdminPanel /> : <ContactSpreadsheet />}
      </main>

      {/* Footer */}
      <footer className="text-center py-3">
        <p className="text-white/15 text-xs">
          {campaignConfig.organizationName} | {campaignConfig.name}
        </p>
      </footer>
    </div>
  )
}
