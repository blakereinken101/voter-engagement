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
    <div className="min-h-screen bg-vc-bg flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-vc-purple-dark via-vc-purple to-vc-purple-light text-white px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-display font-extrabold text-white text-sm tracking-tight hover:opacity-80 transition-opacity">
                VoteCircle
              </Link>
              <span className="text-white/20">|</span>
              <span className="text-xs font-bold text-white/90">
                {campaignConfig.name}
              </span>
              <span className="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded-btn">
                {campaignConfig.state}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'admin' && (
                <button
                  onClick={() => setIsAdminMode(!isAdminMode)}
                  className={`text-xs px-3 py-1.5 rounded-btn font-bold transition-all flex items-center gap-1.5 ${
                    isAdminMode
                      ? 'bg-white text-vc-purple shadow-glow'
                      : 'text-white/60 hover:text-white bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </button>
              )}
              <Link
                href="/rolodex"
                className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1.5 flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
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
                  className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-btn font-bold transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              )}
              {user && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
                  <div className="w-7 h-7 rounded-full bg-white/20 ring-2 ring-white/30 flex items-center justify-center text-[10px] font-bold text-white">
                    {userInitials}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-white leading-tight">{user.name || 'Volunteer'}</p>
                    <p className="text-[10px] text-white/50 leading-tight">{user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="text-white/40 hover:text-white/70 transition-colors p-1"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          {!isAdminMode && totalPeople > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-white/60">
                <Users className="w-3.5 h-3.5" />
                <span className="text-white font-bold">{totalPeople}</span> contacts
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <CheckCircle className="w-3.5 h-3.5 text-vc-teal" />
                <span className="text-vc-teal font-bold">{matchedCount}</span> matched
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <MessageCircle className="w-3.5 h-3.5 text-vc-gold" />
                <span className="text-vc-gold font-bold">{contactedCount}</span> contacted
              </span>
              {supporters > 0 && <span className="flex items-center gap-1 text-vc-teal"><ThumbsUp className="w-3 h-3" /> {supporters}</span>}
              {undecided > 0 && <span className="flex items-center gap-1 text-vc-gold"><HelpCircle className="w-3 h-3" /> {undecided}</span>}
              {needsFollowUp > 0 && <span className="flex items-center gap-1 text-white/70"><Clock className="w-3 h-3" /> {needsFollowUp}</span>}
              {opposed > 0 && <span className="flex items-center gap-1 text-white/40"><ThumbsDown className="w-3 h-3" /> {opposed}</span>}
              {volunteerProspects > 0 && (
                <span className="flex items-center gap-1 text-vc-coral font-bold"><Users className="w-3 h-3" /> {volunteerProspects} vol.</span>
              )}
            </div>
          )}

          {/* Error */}
          {state.error && (
            <div className="mt-2 bg-red-500/20 text-red-200 text-xs px-3 py-2 rounded-btn">
              {state.error}
            </div>
          )}
        </div>
      </header>

      {/* Personal stats */}
      {!isAdminMode && totalPeople > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-3">
          <ConversionStats />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full">
        {isAdminMode ? <AdminPanel /> : <ContactSpreadsheet />}
      </main>

      {/* Footer */}
      <footer className="text-center py-3">
        <p className="text-vc-gray/40 text-xs">
          {campaignConfig.organizationName} | {campaignConfig.name}
        </p>
      </footer>
    </div>
  )
}
