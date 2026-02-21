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
    <div className="min-h-screen bg-rally-cream flex flex-col">
      {/* Header */}
      <header className="bg-rally-navy text-white px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-display font-bold text-white text-sm hover:text-rally-yellow transition-colors">
                VoteCircle
              </Link>
              <span className="text-white/20">|</span>
              <span className="text-xs font-bold text-rally-yellow">
                {campaignConfig.name}
              </span>
              <span className="text-xs font-mono text-white/40 bg-white/10 px-2 py-0.5 rounded">
                {campaignConfig.state}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'admin' && (
                <button
                  onClick={() => setIsAdminMode(!isAdminMode)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    isAdminMode
                      ? 'bg-rally-yellow text-rally-navy shadow-[0_0_12px_rgba(255,214,0,0.4)]'
                      : 'text-white/60 hover:text-white bg-white/10 hover:bg-white/20'
                  }`}
                >
                  Admin
                </button>
              )}
              <Link
                href="/rolodex"
                className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1.5"
              >
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
                  className="text-xs bg-rally-red text-white px-3 py-1.5 rounded-lg font-bold hover:bg-rally-red-light transition-colors"
                >
                  Export CSV
                </button>
              )}
              {user && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                    {userInitials}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-white leading-tight">{user.name || 'Volunteer'}</p>
                    <p className="text-[10px] text-white/50 leading-tight">{user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="text-[10px] text-white/40 hover:text-white/70 transition-colors px-1 py-1"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          {!isAdminMode && totalPeople > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <span className="text-white/60">
                <span className="text-white font-bold">{totalPeople}</span> contacts
              </span>
              <span className="text-white/60">
                <span className="text-rally-green font-bold">{matchedCount}</span> matched
              </span>
              <span className="text-white/60">
                <span className="text-rally-yellow font-bold">{contactedCount}</span> contacted
              </span>
              {supporters > 0 && <span className="text-rally-green">{supporters} supporters</span>}
              {undecided > 0 && <span className="text-rally-yellow">{undecided} undecided</span>}
              {needsFollowUp > 0 && <span className="text-white/70">{needsFollowUp} follow up</span>}
              {opposed > 0 && <span className="text-white/40">{opposed} opposed</span>}
              {volunteerProspects > 0 && (
                <span className="text-rally-red font-bold">{volunteerProspects} volunteers</span>
              )}
            </div>
          )}

          {/* Error */}
          {state.error && (
            <div className="mt-2 bg-rally-red/20 text-rally-red-light text-xs px-3 py-2 rounded">
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
      <footer className="text-center py-2">
        <p className="text-rally-navy/20 text-[10px] font-mono">
          {campaignConfig.organizationName} | Campaign: {campaignConfig.id}
          {state.userId && ` | Volunteer: ${state.userId}`}
        </p>
      </footer>
    </div>
  )
}
